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
        adminId: admin._id.toString(),
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

    // Fetch BU document again for full branding info
    let tenantColor: string | undefined;
    let tenantLabel: string | undefined;
    if (admin.businessUnit !== "SUPERADMIN") {
      const buDoc = await BusinessUnitModel.findOne({ name: admin.businessUnit });
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

adminAuthRouter.get("/users", adminAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { isSuperAdmin, businessUnit: tokenBU } = req;
    const requestedBU = req.query.businessUnit as string | undefined;
    const targetBU = isSuperAdmin ? requestedBU : tokenBU;

    if (!targetBU) {
      return res.status(400).json({ error: "businessUnit query parameter is required" });
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
    const { email, password, fullName } = req.body;
    const { businessUnit } = req;

    if (!email || !password || !fullName || !businessUnit) {
      return res.status(400).json({ error: "Email, password, and fullName are required" });
    }

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
      isActive: true
    });

    await user.save();
    res.status(201).json({ message: "User created successfully", user: { id: user._id, email: user.email, fullName: user.fullName } });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

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
adminAuthRouter.put("/profile", adminAuthMiddleware, logoUpload.single("logo"), async (req: AuthenticatedRequest, res: Response) => {
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

    let buDoc = await BusinessUnitModel.findOne({ name: { $regex: new RegExp(`^${businessUnit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
    if (!buDoc) {
      // BU document doesn't exist yet (admin was created without one) — bootstrap it
      const newSlug = slug || businessUnit.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      buDoc = await BusinessUnitModel.create({
        name: businessUnit,
        label: label || businessUnit,
        slug: newSlug,
        colorCode: colorCode || '#ed0000',
        logo: req.file ? `/logos/${req.file.filename}` : undefined,
        isActive: true
      });
    }

    if (label) buDoc.label = label;
    if (colorCode) buDoc.colorCode = colorCode;
    if (slug) buDoc.slug = slug.toLowerCase().replace(/\s+/g, '-');

    // Acronym update with cascading identity shift
    const oldName = buDoc.name;
    if (name && name !== oldName) {
      // Check for acronym collisions first
      const existing = await BusinessUnitModel.findOne({ name });
      if (existing) return res.status(409).json({ error: "This business acronym is already registered by another unit" });

      buDoc.name = name;
      await AdminUser.updateMany({ businessUnit: oldName }, { businessUnit: name });
    }

    if (req.file) buDoc.logo = `/logos/${req.file.filename}`;

    await buDoc.save();

    // Personal identity update
    let updatedAdmin = null;
    if (fullName) {
      updatedAdmin = await AdminUser.findByIdAndUpdate(adminId, { fullName }, { new: true });
    }

    res.json({
      message: "Infrastructure profile updated",
      businessUnit: buDoc,
      admin: updatedAdmin
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
