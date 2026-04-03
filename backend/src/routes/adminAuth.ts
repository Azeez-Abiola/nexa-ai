import express, { Request, Response } from "express";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs";
import { AdminUser, type BusinessUnit } from "../models/AdminUser";
import { User } from "../models/User";
import { BusinessUnit as BusinessUnitModel } from "../models/BusinessUnit";
import { BusinessUnitEmailMapping } from "../models/BusinessUnitEmailMapping";
import { sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail } from "../services/emailService";
import { getBusinessUnitConfig } from "../config/businessUnits";
import {
  adminAuthMiddleware,
  superAdminMiddleware,
  AuthenticatedRequest
} from "../middleware/auth";

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

    if (admin.businessUnit !== "SUPERADMIN") {
      const buDoc = await BusinessUnitModel.findOne({ name: admin.businessUnit });
      if (buDoc) {
        tenantId = buDoc.tenantId;
        tenantSlug = buDoc.slug;
        tenantLogo = buDoc.logo;
      }
    }

    const token = jwt.sign(
      {
        adminId: admin._id,
        email: admin.email,
        fullName: admin.fullName,
        businessUnit: admin.businessUnit,
        tenantId,
        tenantSlug,
        isAdmin: true
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      admin: {
        id: admin._id,
        email: admin.email,
        fullName: admin.fullName,
        businessUnit: admin.businessUnit,
        tenantId,
        tenantSlug,
        tenantLogo,
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
      await sendWelcomeEmail(admin.email, admin.fullName);
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

// Get users by BU — BU admins see own BU only; SUPERADMIN can query any
adminAuthRouter.get("/users", adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { isSuperAdmin, businessUnit: tokenBU } = req;
    const requestedBU = req.query.businessUnit as string | undefined;
    const targetBU = isSuperAdmin ? requestedBU : tokenBU;

    if (!targetBU) {
      return res.status(400).json({ error: "businessUnit query parameter is required" });
    }

    const validBUs = await BusinessUnitModel.find().select("name");
    const validBUNames = validBUs.map((bu: any) => bu.name);
    if (!validBUNames.includes(targetBU)) {
      return res.status(400).json({ error: "Invalid business unit" });
    }

    const users = await User.find(
      { businessUnit: targetBU },
      { password: 0, resetToken: 0, resetTokenExpiry: 0 }
    ).sort({ createdAt: -1 });

    res.json({ users });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
