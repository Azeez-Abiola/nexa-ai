import express, { Request, Response } from "express";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { User, BusinessUnit } from "../models/User";
import { AdminUser } from "../models/AdminUser";
import { BusinessUnit as BusinessUnitModel } from "../models/BusinessUnit";
import { sendVerificationEmail, sendPasswordResetEmail, sendWelcomeEmail } from "../services/emailService";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth";

export const authRouter = express.Router();

interface AuthRequest {
  email: string;
  password: string;
  fullName?: string;
  businessUnit?: BusinessUnit;
}

const JWT_SECRET = process.env.NEXA_AI_JWT_SECRET || "your-secret-key-change-in-production";

/** Match tenant when `name` and admin acronym drift (same logic as profile resolve slug-as-BU). */
function sanitizeBuAsSlug(bu: string): string {
  return bu
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function findBusinessUnitDoc(businessUnit: string) {
  const asSlug = sanitizeBuAsSlug(businessUnit);
  if (asSlug) {
    const bySlug = await BusinessUnitModel.findOne({ slug: asSlug });
    if (bySlug) return bySlug;
  }
  const byName = await BusinessUnitModel.findOne({
    name: { $regex: new RegExp(`^${businessUnit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }
  });
  if (byName) return byName;
  return BusinessUnitModel.findOne({
    label: { $regex: new RegExp(`^${businessUnit.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }
  });
}

function mapTenantFromBuDoc(buDoc: {
  tenantId: string;
  slug: string;
  logo?: string;
  colorCode?: string;
  label: string;
  contactEmail?: string;
}) {
  return {
    tenantId: buDoc.tenantId,
    tenantSlug: buDoc.slug,
    tenantLogo: buDoc.logo,
    tenantColor: buDoc.colorCode,
    tenantLabel: buDoc.label,
    tenantContactEmail: buDoc.contactEmail || undefined
  };
}

/** Branding + support contact for a BU (used on GET /me and helpers). */
async function tenantProfileForBu(businessUnit: string | undefined): Promise<{
  tenantId?: string;
  tenantSlug?: string;
  tenantLogo?: string;
  tenantColor?: string;
  tenantLabel?: string;
  tenantContactEmail?: string;
}> {
  if (!businessUnit || businessUnit === "SUPERADMIN") return {};
  const buDoc = await findBusinessUnitDoc(businessUnit);
  if (!buDoc) return {};
  return mapTenantFromBuDoc(buDoc);
}

// Helper function to generate 6-digit OTP
function generateOTP(): string {
  // TODO: restore random OTP once email service (Resend) is configured
  return "123456";
}

// Helper function to generate token hash for password reset
function generateToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Verify Email endpoint
authRouter.post("/verify-email", async (req: Request<{}, {}, { email: string; otp: string }>, res: Response) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: "Email and OTP are required" });
    }

    // Find user with valid OTP
    const user = await User.findOne({
      email: email.toLowerCase(),
      emailVerificationOTP: otp,
      emailVerificationOTPExpiry: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    // Mark email as verified and clear OTP
    user.emailVerified = true;
    user.emailVerificationOTP = undefined;
    user.emailVerificationOTPExpiry = undefined;
    await user.save();

    // Fetch BU branding for the welcome email
    let tenantInfo: { label?: string; logo?: string; colorCode?: string; slug?: string } | undefined;
    if (user.businessUnit && user.businessUnit !== "SUPERADMIN") {
      const buDoc = await BusinessUnitModel.findOne({
        name: { $regex: new RegExp(`^${user.businessUnit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      });
      if (buDoc) {
        tenantInfo = {
          label: buDoc.label,
          logo: buDoc.logo,
          colorCode: buDoc.colorCode,
          slug: buDoc.slug
        };
      }
    }

    // Send welcome email tailored to the user's business unit
    try {
      await sendWelcomeEmail(user.email, user.fullName, user.businessUnit, tenantInfo);
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError);
    }

    // Auto-login: issue a JWT and return the user profile so the frontend can skip the login screen
    // and drop the newly-verified user straight into their chat interface.
    const tenant = await tenantProfileForBu(user.businessUnit);
    const payload = {
      userId: user._id,
      email: user.email,
      businessUnit: user.businessUnit,
      department: user.department,
      tenantId: tenant.tenantId,
      tenantSlug: tenant.tenantSlug,
      tenantLogo: tenant.tenantLogo,
      tenantColor: tenant.tenantColor,
      isAdmin: user.businessUnit === "SUPERADMIN"
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });

    res.json({
      message: "Email verified successfully!",
      token,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        businessUnit: user.businessUnit,
        department: user.department,
        ...tenant,
        emailVerified: true,
        isAdmin: payload.isAdmin
      }
    });
  } catch (error) {
    console.error("Verify email error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Resend Verification Email endpoint
authRouter.post("/resend-verification", async (req: Request<{}, {}, { email: string }>, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(200).json({
        message: "If an account exists with this email, a verification code will be sent shortly"
      });
    }

    // If already verified
    if (user.emailVerified) {
      return res.status(200).json({
        message: "This email is already verified. You can login now."
      });
    }

    // Generate new OTP
    const otp = generateOTP();

    user.emailVerificationOTP = otp;
    user.emailVerificationOTPExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    // Fetch BU brand color for the email
    const buDocForColor = await BusinessUnitModel.findOne({
      name: { $regex: new RegExp(`^${user.businessUnit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    });

    // Send verification email with new OTP
    try {
      await sendVerificationEmail(user.email, otp, user.fullName, user.businessUnit, buDocForColor?.colorCode);
    } catch (emailError) {
      console.error("Failed to send verification email:", emailError);
      return res.status(500).json({ error: "Failed to send verification code. Please try again." });
    }

    res.json({
      message: "Verification code sent. Please check your inbox."
    });
  } catch (error) {
    console.error("Resend verification error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Login endpoint (supports both standard Users and AdminUsers)
authRouter.post("/login", async (req: Request<{}, {}, AuthRequest>, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Try finding in User model first
    let user: any = await User.findOne({ email: email.toLowerCase() });
    let isAdminAccount = false;

    if (!user) {
      // Try AdminUser table
      user = await AdminUser.findOne({ email: email.toLowerCase() });
      if (user) isAdminAccount = true;
    }

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Check if email is verified
    if (!user.emailVerified && user.businessUnit !== "SUPERADMIN") {
      return res.status(403).json({ 
        error: "Please verify your email before logging in",
        requiresVerification: true,
        email: user.email,
        isAdminAccount
      });
    }

    // Compare password
    const passwordMatch = await bcryptjs.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    let tenant: Awaited<ReturnType<typeof tenantProfileForBu>> = {};
    if (user.businessUnit !== "SUPERADMIN") {
      const buDoc = await findBusinessUnitDoc(user.businessUnit);
      if (buDoc && buDoc.isActive === false) {
        return res.status(403).json({
          error: "This organization is not active yet. Please contact your administrator."
        });
      }
      if (buDoc) tenant = mapTenantFromBuDoc(buDoc);
    }

    const payload: any = { 
      userId: user._id, 
      email: user.email, 
      businessUnit: user.businessUnit,
      department: (user as any).department,
      tenantId: tenant.tenantId, 
      tenantSlug: tenant.tenantSlug,
      tenantLogo: tenant.tenantLogo,
      tenantColor: tenant.tenantColor,
      isAdmin: isAdminAccount || user.businessUnit === "SUPERADMIN"
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        businessUnit: user.businessUnit,
        department: user.department,
        ...tenant,
        emailVerified: user.emailVerified,
        isAdmin: payload.isAdmin
      }
    });
  } catch (error) {
    console.error("Unified login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Forgot Password endpoint
authRouter.post("/forgot-password", async (req: Request<{}, {}, { email: string }>, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Don't reveal if user exists (security best practice)
      return res.status(200).json({
        message: "If an account exists with this email, a reset link will be sent shortly"
      });
    }

    // Generate reset token
    const resetTokenRaw = crypto.randomBytes(32).toString("hex");
    const resetToken = generateToken(resetTokenRaw);

    // Set token expiry to 1 hour from now
    user.resetToken = resetToken;
    user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    // Send password reset email
    try {
      await sendPasswordResetEmail(user.email, resetTokenRaw, user.fullName);
    } catch (emailError) {
      console.error("Failed to send reset email:", emailError);
      return res.status(500).json({ error: "Failed to send password reset email. Please try again." });
    }

    res.json({
      message: "If an account exists with this email, a reset link will be sent shortly"
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Reset Password endpoint
authRouter.post("/reset-password", async (req: Request<{}, {}, { token: string; newPassword: string; email: string }>, res: Response) => {
  try {
    const { token, newPassword, email } = req.body;

    if (!token || !newPassword || !email) {
      return res.status(400).json({ error: "Token, email, and new password are required" });
    }

    // Validate password strength
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long" });
    }

    // Hash the token to compare with stored hash
    const resetTokenHash = generateToken(token);

    // Find user with valid reset token
    const user = await User.findOne({
      email: email.toLowerCase(),
      resetToken: resetTokenHash,
      resetTokenExpiry: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ error: "Reset token is invalid or has expired" });
    }

    // Hash new password
    const hashedPassword = await bcryptjs.hash(newPassword, 10);

    // Update password and clear reset token
    user.password = hashedPassword;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    res.json({
      message: "Password reset successfully. You can now login with your new password."
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/** Current employee session (tenant branding + support email). Not for admin JWTs. */
authRouter.get("/me", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.isAdmin) {
      return res.status(403).json({ error: "Use the admin console for administrator accounts." });
    }
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const tenant = await tenantProfileForBu(user.businessUnit);
    res.json({
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        businessUnit: user.businessUnit,
        department: user.department,
        ...tenant,
        emailVerified: user.emailVerified,
        isAdmin: false
      }
    });
  } catch (error) {
    console.error("GET /auth/me error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/** Employee (User) profile — not for admin JWTs */
authRouter.patch("/me", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.isAdmin) {
      return res.status(403).json({ error: "Use the admin console to update your administrator profile." });
    }
    const { fullName } = req.body as { fullName?: string };
    if (fullName === undefined) {
      return res.status(400).json({ error: "fullName is required" });
    }
    const trimmed = String(fullName).trim();
    if (trimmed.length < 1 || trimmed.length > 120) {
      return res.status(400).json({ error: "fullName must be between 1 and 120 characters" });
    }
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    user.fullName = trimmed;
    await user.save();
    const tenant = await tenantProfileForBu(user.businessUnit);
    res.json({
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        businessUnit: user.businessUnit,
        department: user.department,
        ...tenant,
        emailVerified: user.emailVerified,
        isAdmin: false
      }
    });
  } catch (error) {
    console.error("PATCH /auth/me error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/** Employee (User) password change */
authRouter.put("/me/password", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.isAdmin) {
      return res.status(403).json({ error: "Use the admin console to change your administrator password." });
    }
    const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
    if (!currentPassword || !newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: "Current password and new password (min 6 characters) are required" });
    }
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    const passwordMatch = await bcryptjs.compare(currentPassword, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }
    user.password = await bcryptjs.hash(newPassword, 10);
    await user.save();
    res.json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("PUT /auth/me/password error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
