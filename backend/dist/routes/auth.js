"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = __importDefault(require("express"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const User_1 = require("../models/User");
const BusinessUnit_1 = require("../models/BusinessUnit");
const BusinessUnitEmailMapping_1 = require("../models/BusinessUnitEmailMapping");
const emailService_1 = require("../services/emailService");
exports.authRouter = express_1.default.Router();
const JWT_SECRET = process.env.NEXA_AI_JWT_SECRET || "your-secret-key-change-in-production";
// Helper function to generate 6-digit OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
// Helper function to generate token hash for password reset
function generateToken(token) {
    return crypto_1.default.createHash("sha256").update(token).digest("hex");
}
// Register endpoint (with email verification OTP)
exports.authRouter.post("/register", async (req, res) => {
    try {
        const { email, password, fullName, businessUnit } = req.body;
        if (!email || !password || !fullName || !businessUnit) {
            return res.status(400).json({ error: "Email, password, fullName, and businessUnit are required" });
        }
        // Validate password strength
        if (password.length < 6) {
            return res.status(400).json({ error: "Password must be at least 6 characters long" });
        }
        // Validate business unit exists in database
        const validBU = await BusinessUnit_1.BusinessUnit.findOne({ name: businessUnit });
        if (!validBU) {
            return res.status(400).json({ error: "Invalid business unit" });
        }
        // Validate email domain matches business unit
        const emailDomainMapping = await BusinessUnitEmailMapping_1.BusinessUnitEmailMapping.findOne({ businessUnit });
        if (emailDomainMapping) {
            const emailDomain = email.toLowerCase().split('@')[1];
            const expectedDomain = emailDomainMapping.emailDomain.toLowerCase();
            if (!emailDomain || emailDomain !== expectedDomain) {
                return res.status(400).json({
                    error: `Invalid email domain for ${businessUnit}. Your email must end with @${expectedDomain}`
                });
            }
        }
        else {
            // If a mapping exists for any business unit, all registrations must validate
            const anyMappingExists = await BusinessUnitEmailMapping_1.BusinessUnitEmailMapping.countDocuments();
            if (anyMappingExists > 0) {
                return res.status(400).json({
                    error: `Email domain mapping not configured for ${businessUnit}. Please contact your administrator to set up the email domain for this business unit.`
                });
            }
        }
        // Check if user exists
        const existingUser = await User_1.User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(409).json({ error: "User already exists" });
        }
        // Hash password
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        // Generate 6-digit OTP
        const otp = generateOTP();
        // Create user (not verified yet)
        const user = new User_1.User({
            email: email.toLowerCase(),
            password: hashedPassword,
            fullName,
            businessUnit,
            emailVerified: false,
            emailVerificationOTP: otp,
            emailVerificationOTPExpiry: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
        });
        await user.save();
        // Send verification email with OTP
        try {
            await (0, emailService_1.sendVerificationEmail)(email.toLowerCase(), otp, fullName, businessUnit);
        }
        catch (emailError) {
            console.error("Failed to send verification email:", emailError);
            // Still allow user to proceed but notify them
            return res.status(201).json({
                message: "Account created, but verification email could not be sent. Please try again or contact support.",
                user: {
                    id: user._id,
                    email: user.email,
                    fullName: user.fullName,
                    businessUnit: user.businessUnit,
                    emailVerified: user.emailVerified
                }
            });
        }
        res.status(201).json({
            message: "Account created successfully. Please check your email for the verification code.",
            user: {
                id: user._id,
                email: user.email,
                fullName: user.fullName,
                businessUnit: user.businessUnit,
                emailVerified: user.emailVerified
            }
        });
    }
    catch (error) {
        console.error("Register error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// Verify Email endpoint
exports.authRouter.post("/verify-email", async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ error: "Email and OTP are required" });
        }
        // Find user with valid OTP
        const user = await User_1.User.findOne({
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
        // Send welcome email
        try {
            await (0, emailService_1.sendWelcomeEmail)(user.email, user.fullName);
        }
        catch (emailError) {
            console.error("Failed to send welcome email:", emailError);
            // Don't fail the verification if welcome email fails
        }
        res.json({
            message: "Email verified successfully! You can now login."
        });
    }
    catch (error) {
        console.error("Verify email error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// Resend Verification Email endpoint
exports.authRouter.post("/resend-verification", async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: "Email is required" });
        }
        // Find user
        const user = await User_1.User.findOne({ email: email.toLowerCase() });
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
        // Send verification email with new OTP
        try {
            await (0, emailService_1.sendVerificationEmail)(user.email, otp, user.fullName, user.businessUnit);
        }
        catch (emailError) {
            console.error("Failed to send verification email:", emailError);
            return res.status(500).json({ error: "Failed to send verification code. Please try again." });
        }
        res.json({
            message: "Verification code sent. Please check your inbox."
        });
    }
    catch (error) {
        console.error("Resend verification error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// Login endpoint
exports.authRouter.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }
        // Find user
        const user = await User_1.User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(401).json({ error: "Invalid email or password" });
        }
        // Check if email is verified
        if (!user.emailVerified) {
            return res.status(403).json({
                error: "Please verify your email before logging in",
                requiresVerification: true,
                email: user.email
            });
        }
        // Compare password
        const passwordMatch = await bcryptjs_1.default.compare(password, user.password);
        if (!passwordMatch) {
            return res.status(401).json({ error: "Invalid email or password" });
        }
        // Fetch tenant info to embed in token
        const buDoc = await BusinessUnit_1.BusinessUnit.findOne({ name: user.businessUnit });
        const tenantId = buDoc?.tenantId;
        const tenantSlug = buDoc?.slug;
        const token = jsonwebtoken_1.default.sign({ userId: user._id, email: user.email, businessUnit: user.businessUnit, tenantId, tenantSlug }, JWT_SECRET, { expiresIn: "7d" });
        res.json({
            token,
            user: {
                id: user._id,
                email: user.email,
                fullName: user.fullName,
                businessUnit: user.businessUnit,
                tenantId,
                tenantSlug,
                tenantLogo: buDoc?.logo,
                emailVerified: user.emailVerified
            }
        });
    }
    catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// Forgot Password endpoint
exports.authRouter.post("/forgot-password", async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: "Email is required" });
        }
        // Find user
        const user = await User_1.User.findOne({ email: email.toLowerCase() });
        if (!user) {
            // Don't reveal if user exists (security best practice)
            return res.status(200).json({
                message: "If an account exists with this email, a reset link will be sent shortly"
            });
        }
        // Generate reset token
        const resetTokenRaw = crypto_1.default.randomBytes(32).toString("hex");
        const resetToken = generateToken(resetTokenRaw);
        // Set token expiry to 1 hour from now
        user.resetToken = resetToken;
        user.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
        await user.save();
        // Send password reset email
        try {
            await (0, emailService_1.sendPasswordResetEmail)(user.email, resetTokenRaw, user.fullName);
        }
        catch (emailError) {
            console.error("Failed to send reset email:", emailError);
            return res.status(500).json({ error: "Failed to send password reset email. Please try again." });
        }
        res.json({
            message: "If an account exists with this email, a reset link will be sent shortly"
        });
    }
    catch (error) {
        console.error("Forgot password error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// Reset Password endpoint
exports.authRouter.post("/reset-password", async (req, res) => {
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
        const user = await User_1.User.findOne({
            email: email.toLowerCase(),
            resetToken: resetTokenHash,
            resetTokenExpiry: { $gt: new Date() }
        });
        if (!user) {
            return res.status(400).json({ error: "Reset token is invalid or has expired" });
        }
        // Hash new password
        const hashedPassword = await bcryptjs_1.default.hash(newPassword, 10);
        // Update password and clear reset token
        user.password = hashedPassword;
        user.resetToken = undefined;
        user.resetTokenExpiry = undefined;
        await user.save();
        res.json({
            message: "Password reset successfully. You can now login with your new password."
        });
    }
    catch (error) {
        console.error("Reset password error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
