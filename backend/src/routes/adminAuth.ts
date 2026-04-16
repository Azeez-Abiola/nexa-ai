import express, { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs";
import { AdminUser, type BusinessUnit } from "../models/AdminUser";
import { User, EMPLOYEE_GRADES, type EmployeeGrade } from "../models/User";
import { BusinessUnit as BusinessUnitModel } from "../models/BusinessUnit";
import { BusinessUnitEmailMapping } from "../models/BusinessUnitEmailMapping";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendTenantCredentialsEmail,
  sendEmployeeInviteEmail
} from "../services/emailService";
import { AdminInvite } from "../models/AdminInvite";
import { EmployeeInvite } from "../models/EmployeeInvite";
import { hashInviteToken } from "../utils/inviteToken";
import { getBusinessUnitConfig } from "../config/businessUnits";
import {
  adminAuthMiddleware,
  superAdminMiddleware,
  AuthenticatedRequest
} from "../middleware/auth";
import { normalizeHexToRrggbb } from "../utils/hexColor";
import {
  escapeBuRegexFragment,
  sanitizeTenantSlug,
  resolveBusinessUnitDocumentForProfile,
  resolveUserDirectoryBusinessUnit
} from "../utils/tenantResolution";

// Logo upload — store in public/logos/
const logosDir = path.join(__dirname, "..", "..", "..", "public", "logos");
if (!fs.existsSync(logosDir)) fs.mkdirSync(logosDir, { recursive: true });

const logoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, logosDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${Date.now()}${ext}`);
    }
  }),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed for logo"));
  }
});

/**
 * Find the tenant row for BU profile updates when `name` and JWT `businessUnit` are out of sync (legacy data).
 * Order: tenantId → JWT slug → acronym-as-slug → name (case-insensitive) → form slug.
 */
async function resolveBusinessUnitForProfile(req: AuthenticatedRequest, formSlug: string | undefined) {
  return resolveBusinessUnitDocumentForProfile(req, formSlug);
}

/** Ensure the resolved tenant is the one this admin belongs to (handles name vs acronym vs slug drift). */
async function adminOwnsBusinessUnitDoc(
  adminId: string,
  buDoc: { name: string; slug?: string; tenantId?: string },
  req: AuthenticatedRequest
): Promise<boolean> {
  const admin = await AdminUser.findById(adminId);
  if (!admin) return false;
  const a = (admin.businessUnit || "").trim();
  const n = (buDoc.name || "").trim();
  if (a.toLowerCase() === n.toLowerCase()) return true;
  const slug = ((buDoc.slug as string) || "").trim().toLowerCase();
  if (slug && sanitizeTenantSlug(a) === slug) return true;
  if (req.tenantSlug && slug && sanitizeTenantSlug(String(req.tenantSlug)) === slug) return true;
  if (req.tenantId && String(req.tenantId).trim() && String(buDoc.tenantId || "").trim()) {
    return String(req.tenantId).trim() === String(buDoc.tenantId).trim();
  }
  return false;
}

/** Profile route: extra links when AdminUser.businessUnit drifted from BusinessUnit.name (provisioned tenants). */
async function profileAdminOwnsTenant(
  adminId: string,
  buDoc: { name: string; slug?: string; tenantId?: string; label?: string; contactEmail?: string | null },
  req: AuthenticatedRequest
): Promise<boolean> {
  if (await adminOwnsBusinessUnitDoc(adminId, buDoc, req)) return true;
  const admin = await AdminUser.findById(adminId);
  if (!admin) return false;
  const a = (admin.businessUnit || "").trim().toLowerCase();
  const email = (admin.email || "").toLowerCase().trim();
  const contact = String(buDoc.contactEmail || "")
    .toLowerCase()
    .trim();
  if (contact && email === contact) return true;
  const lab = String(buDoc.label || "")
    .trim()
    .toLowerCase();
  if (lab && lab === a) return true;
  return false;
}

async function recoverBuFromDuplicateKeyError(err: any) {
  const kv = err?.keyValue as Record<string, unknown> | undefined;
  if (kv?.slug != null) {
    const s = sanitizeTenantSlug(String(kv.slug));
    if (s) return BusinessUnitModel.findOne({ slug: s });
  }
  if (kv?.name != null) return BusinessUnitModel.findOne({ name: String(kv.name) });
  const msg = String(err?.message || "");
  const m = msg.match(/dup key:\s*\{\s*([^:]+):\s*"([^"]+)"/);
  if (m) {
    const field = m[1].trim();
    const val = m[2];
    if (field === "slug") return BusinessUnitModel.findOne({ slug: sanitizeTenantSlug(val) });
    if (field === "name") return BusinessUnitModel.findOne({ name: val });
  }
  return null;
}

/** Admin login: match BU when stored `name` ≠ acronym (slug fallback). */
async function findBusinessUnitForAdminLogin(businessUnit: string) {
  if (!businessUnit || businessUnit === "SUPERADMIN") return null;
  const asSlug = sanitizeTenantSlug(businessUnit);
  if (asSlug) {
    const bySlug = await BusinessUnitModel.findOne({ slug: asSlug });
    if (bySlug) return bySlug;
  }
  const byName = await BusinessUnitModel.findOne({
    name: { $regex: new RegExp(`^${escapeBuRegexFragment(businessUnit)}$`, "i") }
  });
  if (byName) return byName;
  return BusinessUnitModel.findOne({
    label: { $regex: new RegExp(`^${escapeBuRegexFragment(businessUnit)}$`, "i") }
  });
}

const csvUserUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const nameOk = /\.csv$/i.test(file.originalname || "");
    const mimeOk =
      file.mimetype === "text/csv" ||
      file.mimetype === "application/csv" ||
      file.mimetype === "application/vnd.ms-excel";
    if (nameOk || mimeOk) cb(null, true);
    else cb(new Error("Upload a .csv file"));
  }
});

const GRADE_SET = new Set<string>(EMPLOYEE_GRADES);

export const adminAuthRouter = express.Router();

interface AdminAuthRequest {
  email: string;
  password: string;
  fullName?: string;
  businessUnit?: BusinessUnit;
}

const JWT_SECRET = process.env.NEXA_AI_JWT_SECRET!;

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Admin Register
// Accepts multipart/form-data to support optional logo upload
// New BU payload: { email, password, fullName, businessUnit, slug, label, contactEmail, logo? }
adminAuthRouter.post("/register", logoUpload.single("logo"), async (req: Request, res: Response) => {
  try {
    const { email, password, fullName, businessUnit, slug, label, contactEmail } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long" });
    }

    const existingAdmin = await AdminUser.findOne({ email: email.toLowerCase() });
    if (existingAdmin) {
      return res.status(409).json({ error: "Admin already exists" });
    }

    const hashedPassword = await bcryptjs.hash(password, 10);
    const adminFullName = fullName || "Superadmin";

    // Determine admin BU
    let adminBU: BusinessUnit;
    if (businessUnit && businessUnit !== "SUPERADMIN") {
      const buConfig = getBusinessUnitConfig(businessUnit);
      if (!buConfig) {
        return res.status(400).json({ error: `Invalid business unit: ${businessUnit}` });
      }
      adminBU = buConfig.abbr as BusinessUnit;
    } else {
      adminBU = "SUPERADMIN" as BusinessUnit;
    }

    // If BU admin — resolve or create the BusinessUnit document
    if (adminBU !== "SUPERADMIN") {
      let buDoc = await BusinessUnitModel.findOne({ name: adminBU });

      if (!buDoc) {
        // New tenant — slug required
        if (!slug) {
          return res.status(400).json({ error: "slug is required when registering a new business unit" });
        }
        if (!/^[a-z0-9-]+$/.test(slug)) {
          return res.status(400).json({ error: "Slug must be lowercase letters, numbers and hyphens only" });
        }
        const slugTaken = await BusinessUnitModel.findOne({ slug: slug.toLowerCase() });
        if (slugTaken) {
          return res.status(409).json({ error: `Slug "${slug}" is already taken` });
        }

        const logoPath = req.file ? `/logos/${req.file.filename}` : undefined;

        buDoc = await BusinessUnitModel.create({
          name: adminBU,
          label: label || adminBU,
          slug: slug.toLowerCase(),
          logo: logoPath,
          contactEmail: contactEmail || undefined,
          isActive: true
        });
      } else {
        // BU exists — update slug/logo/label if provided
        if (slug) {
          if (!/^[a-z0-9-]+$/.test(slug)) {
            return res.status(400).json({ error: "Slug must be lowercase letters, numbers and hyphens only" });
          }
          const slugTaken = await BusinessUnitModel.findOne({ slug: slug.toLowerCase(), _id: { $ne: buDoc._id } });
          if (slugTaken) {
            return res.status(409).json({ error: `Slug "${slug}" is already taken` });
          }
          buDoc.slug = slug.toLowerCase();
        }
        if (req.file) buDoc.logo = `/logos/${req.file.filename}`;
        if (label) buDoc.label = label;
        if (contactEmail) buDoc.contactEmail = contactEmail;
        await buDoc.save();
      }

      // Email domain validation
      const emailDomainMapping = await BusinessUnitEmailMapping.findOne({ businessUnit: adminBU });
      if (emailDomainMapping) {
        const emailDomain = email.toLowerCase().split("@")[1];
        if (!emailDomain || emailDomain !== emailDomainMapping.emailDomain.toLowerCase()) {
          return res.status(400).json({
            error: `Invalid email domain for ${adminBU}. Your email must end with @${emailDomainMapping.emailDomain}`
          });
        }
      }
    }

    const otp = generateOTP();

    const admin = new AdminUser({
      email: email.toLowerCase(),
      password: hashedPassword,
      fullName: adminFullName,
      businessUnit: adminBU,
      emailVerified: false,
      emailVerificationOTP: otp,
      emailVerificationOTPExpiry: new Date(Date.now() + 10 * 60 * 1000)
    });

    await admin.save();

    try {
      await sendVerificationEmail(email.toLowerCase(), otp, adminFullName, adminBU);
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      return res.status(201).json({
        message: "Admin account created, but verification email could not be sent.",
        user: { id: admin._id, email: admin.email, fullName: admin.fullName, businessUnit: admin.businessUnit, emailVerified: admin.emailVerified }
      });
    }

    res.status(201).json({
      message: "Admin account created successfully. Please check your email for the verification code.",
      user: { id: admin._id, email: admin.email, fullName: admin.fullName, businessUnit: admin.businessUnit, emailVerified: admin.emailVerified }
    });
  } catch (error) {
    console.error("Admin register error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Admin Login — embeds tenantId + slug in JWT
adminAuthRouter.post("/login", async (req: Request<{}, {}, AdminAuthRequest>, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const admin = await AdminUser.findOne({ email: email.toLowerCase() });
    if (!admin) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (!admin.emailVerified && admin.businessUnit !== "SUPERADMIN") {
      return res.status(403).json({
        error: "Please verify your email before logging in",
        requiresVerification: true,
        email: admin.email
      });
    }

    const passwordMatch = await bcryptjs.compare(password, admin.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Fetch tenant info to embed in token
    let tenantId: string | undefined;
    let tenantSlug: string | undefined;
    let tenantLogo: string | undefined;

    let tenantName: string | undefined;
    if (admin.businessUnit !== "SUPERADMIN") {
      const buDoc = await findBusinessUnitForAdminLogin(admin.businessUnit);
      if (buDoc) {
        tenantId = buDoc.tenantId;
        tenantSlug = buDoc.slug;
        tenantLogo = buDoc.logo;
        tenantName = buDoc.name;
      }
    }

    const token = jwt.sign(
      {
        adminId: admin._id.toString(),
        email: admin.email,
        fullName: admin.fullName,
        businessUnit: admin.businessUnit,
        tenantId,
        tenantSlug,
        tenantName,
        isAdmin: true
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Fetch BU document again for full branding info
    let tenantColor: string | undefined;
    let tenantLabel: string | undefined;
    if (admin.businessUnit !== "SUPERADMIN") {
      const buDoc = await findBusinessUnitForAdminLogin(admin.businessUnit);
      if (buDoc) {
        tenantColor = buDoc.colorCode;
        tenantLabel = buDoc.label;
      }
    }

    res.json({
      token,
      admin: {
        id: admin._id,
        email: admin.email,
        fullName: admin.fullName,
        businessUnit: admin.businessUnit,
        tenantId,
        tenantSlug,
        tenantName,
        tenantLogo,
        tenantColor,
        tenantLabel,
        emailVerified: admin.emailVerified
      }
    });
  } catch (error) {
    console.error("Admin login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Verify Email
adminAuthRouter.post("/verify-email", async (req: Request<{}, {}, { email: string; otp: string }>, res: Response) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: "Email and OTP are required" });
    }

    const admin = await AdminUser.findOne({
      email: email.toLowerCase(),
      emailVerificationOTP: otp,
      emailVerificationOTPExpiry: { $gt: new Date() }
    });

    if (!admin) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    admin.emailVerified = true;
    admin.emailVerificationOTP = undefined;
    admin.emailVerificationOTPExpiry = undefined;
    await admin.save();

    try {
      await sendWelcomeEmail(admin.email, admin.fullName, admin.businessUnit);
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError);
    }

    res.json({ message: "Email verified successfully! You can now login." });
  } catch (error) {
    console.error("Verify email error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Resend Verification
adminAuthRouter.post("/resend-verification", async (req: Request<{}, {}, { email: string }>, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const admin = await AdminUser.findOne({ email: email.toLowerCase() });
    if (!admin) {
      return res.status(200).json({ message: "If an account exists with this email, a verification code will be sent shortly" });
    }

    if (admin.emailVerified) {
      return res.status(200).json({ message: "This email is already verified. You can login now." });
    }

    const otp = generateOTP();
    admin.emailVerificationOTP = otp;
    admin.emailVerificationOTPExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await admin.save();

    try {
      await sendVerificationEmail(admin.email, otp, admin.fullName, admin.businessUnit);
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      return res.status(500).json({ error: "Failed to send verification code. Please try again." });
    }

    res.json({ message: "Verification code sent. Please check your inbox." });
  } catch (error) {
    console.error("Resend verification error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Forgot Password
adminAuthRouter.post("/forgot-password", async (req: Request<{}, {}, { email: string }>, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const admin = await AdminUser.findOne({ email: email.toLowerCase() });
    if (!admin) {
      return res.status(200).json({ message: "If an account exists with this email, a reset link will be sent shortly" });
    }

    const resetTokenRaw = crypto.randomBytes(32).toString("hex");
    admin.resetToken = generateToken(resetTokenRaw);
    admin.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
    await admin.save();

    try {
      await sendPasswordResetEmail(admin.email, resetTokenRaw, admin.fullName);
    } catch (emailError) {
      console.error("Failed to send reset email:", emailError);
      return res.status(500).json({ error: "Failed to send password reset email. Please try again." });
    }

    res.json({ message: "If an account exists with this email, a reset link will be sent shortly" });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Reset Password
adminAuthRouter.post("/reset-password", async (req: Request<{}, {}, { token: string; newPassword: string; email: string }>, res: Response) => {
  try {
    const { token, newPassword, email } = req.body;

    if (!token || !newPassword || !email) {
      return res.status(400).json({ error: "Token, email, and new password are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long" });
    }

    const admin = await AdminUser.findOne({
      email: email.toLowerCase(),
      resetToken: generateToken(token),
      resetTokenExpiry: { $gt: new Date() }
    });

    if (!admin) {
      return res.status(400).json({ error: "Reset token is invalid or has expired" });
    }

    admin.password = await bcryptjs.hash(newPassword, 10);
    admin.resetToken = undefined;
    admin.resetTokenExpiry = undefined;
    await admin.save();

    res.json({ message: "Password reset successfully. You can now login with your new password." });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get all BU admins — SUPERADMIN only
adminAuthRouter.get("/admins", superAdminMiddleware, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const admins = await AdminUser.find({}, { password: 0 }).sort({ createdAt: -1 });
    res.json({ admins });
  } catch (error) {
    console.error("Get admins error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

adminAuthRouter.get("/users", adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { isSuperAdmin } = req;
    const requestedBU = req.query.businessUnit as string | undefined;
    const targetBU = await resolveUserDirectoryBusinessUnit(req, requestedBU);

    if (!targetBU) {
      return res.status(400).json({
        error: isSuperAdmin
          ? "Pass ?businessUnit= with the tenant name, label, or slug (not SUPERADMIN), or pick a tenant in the console."
          : "Could not resolve your business unit for the user directory. Sign out and back in, or contact support."
      });
    }

    const users = await User.find(
      { businessUnit: targetBU },
      { password: 0, resetToken: 0, resetTokenExpiry: 0 }
    ).sort({ createdAt: -1 });

    res.json({ users });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ error: "Internal server error", message: error instanceof Error ? error.message : "Unknown error" });
  }
});

// Create User — BU admins can create users for their BU
adminAuthRouter.post("/users", adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, password, fullName, grade: rawGrade } = req.body;
    const { businessUnit } = req;

    if (!email || !password || !fullName || !businessUnit) {
      return res.status(400).json({ error: "Email, password, and fullName are required" });
    }

    const grade = (typeof rawGrade === "string" && GRADE_SET.has(rawGrade) ? rawGrade : "Analyst") as EmployeeGrade;

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ error: "User already exists" });
    }

    const hashedPassword = await bcryptjs.hash(password, 10);
    const user = new User({
      email: email.toLowerCase(),
      password: hashedPassword,
      fullName,
      businessUnit,
      grade,
      emailVerified: true
    });

    await user.save();

    const buDoc = await BusinessUnitModel.findOne({ name: businessUnit });
    const tenantInfo = buDoc
      ? {
          label: buDoc.label,
          logo: buDoc.logo,
          colorCode: buDoc.colorCode,
          slug: buDoc.slug
        }
      : undefined;
    try {
      await sendWelcomeEmail(user.email, user.fullName, user.businessUnit, tenantInfo, { adminCreated: true });
    } catch (emailErr) {
      console.error("Welcome email failed (single user create):", emailErr);
    }

    res.status(201).json({ message: "User created successfully", user: { id: user._id, email: user.email, fullName: user.fullName } });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

const EMPLOYEE_INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

// Invite employee — BU admins only; signed token email (business unit cannot be forged).
adminAuthRouter.post("/invite-employee", adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { businessUnit, isSuperAdmin, email: inviterEmail, fullName: inviterName } = req;
    if (!businessUnit || businessUnit === "SUPERADMIN" || isSuperAdmin) {
      return res.status(403).json({
        error: "Only business unit administrators can invite employees for their unit."
      });
    }

    const { email, fullName } = req.body;
    if (!email || !fullName) {
      return res.status(400).json({ error: "email and fullName are required" });
    }

    const tenant = await BusinessUnitModel.findOne({ name: businessUnit });
    if (!tenant) {
      return res.status(404).json({ error: "Your business unit is not registered as a tenant." });
    }
    if (tenant.isActive === false) {
      return res.status(403).json({
        error: "This organization is not active yet and cannot send employee invites."
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const emailDomainMapping = await BusinessUnitEmailMapping.findOne({ businessUnit });
    if (emailDomainMapping) {
      const emailDomain = normalizedEmail.split("@")[1];
      const expectedDomain = emailDomainMapping.emailDomain.toLowerCase();
      if (!emailDomain || emailDomain !== expectedDomain) {
        return res.status(400).json({
          error: `Email must end with @${expectedDomain} for ${businessUnit}.`
        });
      }
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ error: "A user with this email already exists." });
    }

    const pending = await EmployeeInvite.findOne({
      email: normalizedEmail,
      businessUnit,
      status: "pending",
      expiresAt: { $gt: new Date() }
    });
    if (pending) {
      return res.status(409).json({
        error: "An invitation is already pending for this email."
      });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashInviteToken(rawToken);

    await EmployeeInvite.create({
      email: normalizedEmail,
      fullName: fullName.trim(),
      businessUnit,
      tenantId: tenant.tenantId,
      token: tokenHash,
      status: "pending",
      invitedBy: inviterEmail || "unknown",
      expiresAt: new Date(Date.now() + EMPLOYEE_INVITE_EXPIRY_MS)
    });

    const inviterLabel = inviterName || inviterEmail || "Your administrator";

    try {
      await sendEmployeeInviteEmail(
        normalizedEmail,
        fullName.trim(),
        tenant.label,
        inviterLabel,
        rawToken,
        7
      );
    } catch (emailError) {
      await EmployeeInvite.deleteOne({ token: tokenHash, status: "pending" });
      console.error("Employee invite email failed:", emailError);
      return res.status(500).json({
        error: "Could not send the invitation email. Check email configuration or try again."
      });
    }

    res.status(201).json({
      message: `Invitation sent to ${normalizedEmail}`,
      expiresInDays: 7
    });
  } catch (error) {
    console.error("Invite employee error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Bulk-create chat users from CSV — BU admins only (same business unit as token)
adminAuthRouter.post(
  "/users/bulk-csv",
  adminAuthMiddleware,
  csvUserUpload.single("file"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { businessUnit, isSuperAdmin } = req;
      if (!businessUnit || businessUnit === "SUPERADMIN" || isSuperAdmin) {
        return res.status(403).json({ error: "Only business unit administrators can import users" });
      }
      if (!req.file?.buffer) {
        return res.status(400).json({ error: "CSV file is required (field name: file)" });
      }

      const text = req.file.buffer.toString("utf8").replace(/^\uFEFF/, "");
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
      if (lines.length < 2) {
        return res.status(400).json({ error: "CSV must include a header row and at least one data row" });
      }

      const headerCells = lines[0].split(",").map((c) =>
        c
          .trim()
          .replace(/^"|"$/g, "")
          .toLowerCase()
          .replace(/\s+/g, "")
      );
      const col = (key: string, ...aliases: string[]) => {
        const keys = [key, ...aliases];
        for (const k of keys) {
          const i = headerCells.indexOf(k);
          if (i >= 0) return i;
        }
        return -1;
      };

      const iName = col("fullname", "full_name", "name");
      const iEmail = col("email");
      const iPass = col("password");
      const iGrade = col("grade");
      if (iName < 0 || iEmail < 0) {
        return res.status(400).json({
          error: "CSV header must include fullName (or name) and email columns"
        });
      }

      const buDoc = await BusinessUnitModel.findOne({ name: businessUnit });
      const tenantInfo = buDoc
        ? {
            label: buDoc.label,
            logo: buDoc.logo,
            colorCode: buDoc.colorCode,
            slug: buDoc.slug
          }
        : undefined;

      const created: { email: string; fullName: string }[] = [];
      const failed: { line: number; email?: string; error: string }[] = [];

      for (let r = 1; r < lines.length; r++) {
        const row = lines[r].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        const fullName = row[iName]?.trim();
        const email = row[iEmail]?.trim().toLowerCase();
        const passwordCell = iPass >= 0 ? row[iPass]?.trim() : "";
        const gradeCell = iGrade >= 0 ? row[iGrade]?.trim() : "";
        const lineNo = r + 1;

        if (!fullName || !email) {
          failed.push({ line: lineNo, email, error: "Missing fullName or email" });
          continue;
        }

        const grade = (gradeCell && GRADE_SET.has(gradeCell) ? gradeCell : "Analyst") as EmployeeGrade;
        const generated =
          !passwordCell || passwordCell.length < 6;
        const password = generated
          ? crypto.randomBytes(8).toString("base64url").slice(0, 12)
          : passwordCell;

        try {
          const existingUser = await User.findOne({ email });
          if (existingUser) {
            failed.push({ line: lineNo, email, error: "User already exists" });
            continue;
          }
          const hashedPassword = await bcryptjs.hash(password, 10);
          const user = new User({
            email,
            password: hashedPassword,
            fullName,
            businessUnit,
            grade,
            emailVerified: true
          });
          await user.save();
          created.push({ email, fullName });
          try {
            await sendWelcomeEmail(
              user.email,
              user.fullName,
              user.businessUnit,
              tenantInfo,
              generated ? { initialPassword: password } : { adminCreated: true }
            );
          } catch (emailErr) {
            console.error(`Welcome email failed for ${email}:`, emailErr);
          }
        } catch (err: any) {
          failed.push({
            line: lineNo,
            email,
            error: err?.message || "Create failed"
          });
        }
      }

      res.status(201).json({
        message: `Imported ${created.length} user(s); ${failed.length} row(s) skipped or failed`,
        created,
        failed
      });
    } catch (error: any) {
      console.error("Bulk CSV import error:", error);
      if (error?.message === "Upload a .csv file") {
        return res.status(400).json({ error: error.message });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Delete User — BU admins can delete users from their BU
adminAuthRouter.delete("/users/:id", adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { businessUnit, isSuperAdmin } = req;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (!isSuperAdmin && user.businessUnit !== businessUnit) {
      return res.status(403).json({ error: "Access denied: User belongs to another business unit" });
    }

    await User.findByIdAndDelete(id);
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update Profile — BU admins can update their BU logo, label, or color
adminAuthRouter.put(
  "/profile",
  adminAuthMiddleware,
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    logoUpload.single("logo")(req, res, (err: unknown) => {
      if (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        return res.status(400).json({ error: msg });
      }
      next();
    });
  },
  async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { businessUnit, adminId } = req;
    const { label, colorCode, fullName, name, slug } = req.body;

    if (!adminId) {
      console.error("Profile update rejected: No adminId in request. Identity context:", { businessUnit, reqAdminId: req.adminId });
      return res.status(401).json({ error: "Authentication session has expired. Please log in again." });
    }

    if (!businessUnit || businessUnit === "SUPERADMIN") {
      console.warn("Profile update rejected: SUPERADMIN or no BU. Context:", { businessUnit, adminId });
      return res.status(403).json({ error: "Only business unit admins can update profiles via this route" });
    }

    let buDoc = await resolveBusinessUnitForProfile(req, slug);
    const adminRow = await AdminUser.findById(adminId);
    if (!buDoc && adminRow?.email) {
      buDoc = await BusinessUnitModel.findOne({ contactEmail: adminRow.email.toLowerCase().trim() });
    }
    if (buDoc) {
      const owns = await profileAdminOwnsTenant(adminId!, buDoc, req);
      if (!owns) {
        return res.status(403).json({
          error: "Resolved tenant does not match your administrator account. Sign out and back in, or contact support."
        });
      }
    }
    if (!buDoc) {
      const rawSlug = slug || businessUnit.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const newSlug = sanitizeTenantSlug(rawSlug) || sanitizeTenantSlug(businessUnit) || "tenant";
      try {
        buDoc = await BusinessUnitModel.create({
          name: businessUnit,
          label: label || businessUnit,
          slug: newSlug,
          colorCode: normalizeHexToRrggbb(colorCode || "#ed0000"),
          logo: req.file ? `/logos/${req.file.filename}` : undefined,
          isActive: true
        });
      } catch (createErr: any) {
        if (createErr?.code === 11000) {
          const recovered = await recoverBuFromDuplicateKeyError(createErr);
          if (recovered && (await profileAdminOwnsTenant(adminId!, recovered, req))) {
            buDoc = recovered;
          } else {
            return res.status(409).json({
              error:
                "Your tenant already exists in the database but your admin account did not match it automatically. Fix: (1) In Super Admin → Tenants, set this BU’s Contact email to your admin login email, or set Business label exactly to your admin “Business acronym” field, or align BusinessUnit name with that acronym. (2) Fill Subdomain slug on this form to match the tenant’s slug, save again. (3) Or ask a super admin to set AdminUser.businessUnit to the exact BusinessUnit.name value."
            });
          }
        } else {
          throw createErr;
        }
      }
    }

    if (label) buDoc.label = label;
    if (colorCode !== undefined && String(colorCode).trim() !== "") {
      buDoc.colorCode = normalizeHexToRrggbb(String(colorCode));
    }

    if (slug !== undefined && String(slug).trim() !== "") {
      const s = sanitizeTenantSlug(String(slug));
      if (!s || !/^[a-z0-9-]+$/.test(s)) {
        return res.status(400).json({
          error: "Slug may only use lowercase letters, numbers, and hyphens (no spaces or special characters)."
        });
      }
      const slugTaken = await BusinessUnitModel.findOne({ slug: s, _id: { $ne: buDoc._id } });
      if (slugTaken) {
        return res.status(409).json({ error: "That slug is already in use by another organization." });
      }
      buDoc.slug = s;
    }

    // BusinessUnit.name (canonical scope for User / groups) — UI may still show legacy acronym in JWT; do not
    // treat "same as label" as a rename attempt.
    const oldName = buDoc.name;
    const bodyName = name !== undefined ? String(name).trim() : "";
    if (bodyName) {
      const sameAsStoredName =
        bodyName.toLowerCase() === String(oldName || "").trim().toLowerCase();
      const sameAsLabel =
        bodyName.toLowerCase() === String(buDoc.label || "").trim().toLowerCase();
      if (!sameAsStoredName && !sameAsLabel) {
        const existing = await BusinessUnitModel.findOne({
          name: bodyName,
          _id: { $ne: buDoc._id }
        });
        if (existing) {
          return res.status(409).json({
            error: "This business name is already registered by another organization."
          });
        }
        buDoc.name = bodyName;
        await AdminUser.updateMany({ businessUnit: oldName }, { businessUnit: bodyName });
        await User.updateMany({ businessUnit: oldName }, { businessUnit: bodyName });
      }
    }

    if (req.file) buDoc.logo = `/logos/${req.file.filename}`;

    try {
      await buDoc.save();
    } catch (saveErr: any) {
      if (saveErr?.name === "ValidationError") {
        return res.status(400).json({ error: saveErr.message || "Invalid profile data" });
      }
      if (saveErr?.code === 11000) {
        return res.status(409).json({ error: "That business name or slug is already in use." });
      }
      throw saveErr;
    }

    // Personal identity update
    let updatedAdmin = null;
    if (fullName && String(fullName).trim() !== "") {
      if (!mongoose.Types.ObjectId.isValid(adminId)) {
        return res.status(400).json({ error: "Invalid administrator id in session. Please sign in again." });
      }
      updatedAdmin = await AdminUser.findByIdAndUpdate(adminId, { fullName: String(fullName).trim() }, { new: true });
    }

    res.json({
      message: "Infrastructure profile updated",
      businessUnit: buDoc.toJSON(),
      admin: updatedAdmin ? (updatedAdmin as { toJSON: () => object }).toJSON() : null
    });
  } catch (error: any) {
    console.error("Infrastructure Profile Update Failure:", error);
    res.status(500).json({
      error: "An internal diagnostic error occurred during profile synchronization",
      details: error.message
    });
  }
});

// Change Password — Admin can change their own password
adminAuthRouter.put("/change-password", adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { adminId } = req;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "Current password and new password (min 6 chars) are required" });
    }

    const admin = await AdminUser.findById(adminId);
    if (!admin) return res.status(404).json({ error: "Admin not found" });

    const passwordMatch = await bcryptjs.compare(currentPassword, admin.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid current password" });
    }

    admin.password = await bcryptjs.hash(newPassword, 10);
    await admin.save();

    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Invite / provision another administrator for the same business unit (BU admins only)
adminAuthRouter.post("/invite-peer-admin", adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const bu = req.businessUnit;
    if (!bu || bu === "SUPERADMIN") {
      return res.status(403).json({
        error: "Only business unit administrators can invite peer admins for their unit."
      });
    }

    const { email, fullName } = req.body;
    if (!email || !fullName) {
      return res.status(400).json({ error: "email and fullName are required" });
    }

    const tenant = await BusinessUnitModel.findOne({ name: bu });
    if (!tenant) {
      return res.status(404).json({
        error: "Your business unit is not registered as a tenant. Contact support."
      });
    }

    const existing = await AdminUser.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: "An admin account already exists with this email" });
    }

    const autoPassword = crypto.randomBytes(6).toString("hex");
    const hashedPassword = await bcryptjs.hash(autoPassword, 10);

    const admin = await AdminUser.create({
      email: email.toLowerCase(),
      fullName,
      businessUnit: bu,
      password: hashedPassword,
      emailVerified: true
    });

    await AdminInvite.create({
      email: email.toLowerCase(),
      fullName,
      businessUnit: bu,
      tenantId: tenant.tenantId,
      status: "accepted",
      invitedBy: req.email!,
      expiresAt: new Date(),
      token: "BU-ADMIN-INVITE"
    });

    try {
      await sendTenantCredentialsEmail(
        email.toLowerCase(),
        fullName,
        bu,
        tenant.slug,
        autoPassword
      );
    } catch (emailError) {
      console.error("Failed to send credentials email:", emailError);
      return res.status(500).json({
        message: `Admin account created for ${email}, but credentials email failed.`,
        error: "Failed to send email. You may need to manually reset the password."
      });
    }

    res.status(201).json({
      message: `Admin account created and credentials sent to ${email}`,
      admin: {
        id: admin._id,
        email: admin.email,
        fullName: admin.fullName,
        businessUnit: admin.businessUnit,
        status: "active"
      }
    });
  } catch (error) {
    console.error("BU peer admin invite error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Toggle Admin Status — SUPERADMIN only
adminAuthRouter.patch("/:id/toggle-status", superAdminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const admin = await AdminUser.findById(id);
    if (!admin) return res.status(404).json({ error: "Admin not found" });

    if (admin.businessUnit === "SUPERADMIN" && admin.email === "abiolaazeez@gmail.com") {
      return res.status(403).json({ error: "Cannot deactivate primary superadmin" });
    }

    admin.isActive = !admin.isActive;
    await admin.save();

    res.json({ message: `Admin ${admin.isActive ? "activated" : "deactivated"} successfully`, isActive: admin.isActive });
  } catch (error) {
    console.error("Toggle admin status error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create Admin Direct — SUPERADMIN only
adminAuthRouter.post("/create-direct", superAdminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, password, fullName, businessUnit } = req.body;

    if (!email || !password || !fullName || !businessUnit) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const existingAdmin = await AdminUser.findOne({ email: email.toLowerCase() });
    if (existingAdmin) return res.status(409).json({ error: "Admin already exists" });

    const hashedPassword = await bcryptjs.hash(password, 10);
    const admin = new AdminUser({
      email: email.toLowerCase(),
      password: hashedPassword,
      fullName,
      businessUnit,
      emailVerified: true, // Direct creation usually bypasses OTP
      isActive: true
    });

    await admin.save();
    res.status(201).json({ message: "Admin created successfully", admin: { id: admin._id, email: admin.email, fullName: admin.fullName, businessUnit: admin.businessUnit } });
  } catch (error) {
    console.error("Direct admin creation error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Email Domain Mappings — SUPERADMIN only
adminAuthRouter.get("/email-domains", superAdminMiddleware, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const domains = await BusinessUnitEmailMapping.find().sort({ emailDomain: 1 });
    res.json({ domains: domains.map(d => ({ _id: d._id, domain: d.emailDomain, businessUnit: d.businessUnit })) });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch domains" });
  }
});

adminAuthRouter.post("/email-domains", superAdminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { domain, businessUnit } = req.body;
    if (!domain || !businessUnit) return res.status(400).json({ error: "Domain and Business Unit required" });

    const existing = await BusinessUnitEmailMapping.findOne({ emailDomain: domain.toLowerCase() });
    if (existing) return res.status(409).json({ error: "Domain is already mapped" });

    await BusinessUnitEmailMapping.create({
      businessUnit,
      emailDomain: domain.toLowerCase()
    });
    res.status(201).json({ message: "Domain mapping created" });
  } catch (error) {
    res.status(500).json({ error: "Failed to create domain mapping" });
  }
});

adminAuthRouter.delete("/email-domains/:id", superAdminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await BusinessUnitEmailMapping.findByIdAndDelete(id);
    res.json({ message: "Domain mapping deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete domain mapping" });
  }
});

// Email Domain Mappings — SUPERADMIN only
adminAuthRouter.get("/email-domains", superAdminMiddleware, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const domains = await BusinessUnitEmailMapping.find().sort({ emailDomain: 1 });
    res.json({ domains: domains.map(d => ({ _id: d._id, domain: d.emailDomain, businessUnit: d.businessUnit })) });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch domains" });
  }
});

adminAuthRouter.post("/email-domains", superAdminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { domain, businessUnit } = req.body;
    if (!domain || !businessUnit) return res.status(400).json({ error: "Domain and Business Unit required" });

    const existing = await BusinessUnitEmailMapping.findOne({ emailDomain: domain.toLowerCase() });
    if (existing) return res.status(409).json({ error: "Domain is already mapped" });

    await BusinessUnitEmailMapping.create({
      businessUnit,
      emailDomain: domain.toLowerCase()
    });
    res.status(201).json({ message: "Domain mapping created" });
  } catch (error) {
    res.status(500).json({ error: "Failed to create domain mapping" });
  }
});

adminAuthRouter.delete("/email-domains/:id", superAdminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await BusinessUnitEmailMapping.findByIdAndDelete(id);
    res.json({ message: "Domain mapping deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete domain mapping" });
  }
});
