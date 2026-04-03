"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminAuthRouter = void 0;
const express_1 = __importDefault(require("express"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const AdminUser_1 = require("../models/AdminUser");
const User_1 = require("../models/User");
const BusinessUnit_1 = require("../models/BusinessUnit");
const BusinessUnitEmailMapping_1 = require("../models/BusinessUnitEmailMapping");
const emailService_1 = require("../services/emailService");
const businessUnits_1 = require("../config/businessUnits");
const auth_1 = require("../middleware/auth");
// Logo upload — store in public/logos/
const logosDir = path_1.default.join(__dirname, "..", "..", "..", "public", "logos");
if (!fs_1.default.existsSync(logosDir))
    fs_1.default.mkdirSync(logosDir, { recursive: true });
const logoUpload = (0, multer_1.default)({
    storage: multer_1.default.diskStorage({
        destination: (_req, _file, cb) => cb(null, logosDir),
        filename: (_req, file, cb) => {
            const ext = path_1.default.extname(file.originalname);
            cb(null, `${Date.now()}${ext}`);
        }
    }),
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith("image/"))
            cb(null, true);
        else
            cb(new Error("Only image files are allowed for logo"));
    }
});
exports.adminAuthRouter = express_1.default.Router();
const JWT_SECRET = process.env.NEXA_AI_JWT_SECRET;
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
function generateToken(token) {
    return crypto_1.default.createHash("sha256").update(token).digest("hex");
}
// Admin Register
// Accepts multipart/form-data to support optional logo upload
// New BU payload: { email, password, fullName, businessUnit, slug, label, contactEmail, logo? }
exports.adminAuthRouter.post("/register", logoUpload.single("logo"), async (req, res) => {
    try {
        const { email, password, fullName, businessUnit, slug, label, contactEmail } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: "Password must be at least 6 characters long" });
        }
        const existingAdmin = await AdminUser_1.AdminUser.findOne({ email: email.toLowerCase() });
        if (existingAdmin) {
            return res.status(409).json({ error: "Admin already exists" });
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        const adminFullName = fullName || "Superadmin";
        // Determine admin BU
        let adminBU;
        if (businessUnit && businessUnit !== "SUPERADMIN") {
            const buConfig = (0, businessUnits_1.getBusinessUnitConfig)(businessUnit);
            if (!buConfig) {
                return res.status(400).json({ error: `Invalid business unit: ${businessUnit}` });
            }
            adminBU = buConfig.abbr;
        }
        else {
            adminBU = "SUPERADMIN";
        }
        // If BU admin — resolve or create the BusinessUnit document
        if (adminBU !== "SUPERADMIN") {
            let buDoc = await BusinessUnit_1.BusinessUnit.findOne({ name: adminBU });
            if (!buDoc) {
                // New tenant — slug required
                if (!slug) {
                    return res.status(400).json({ error: "slug is required when registering a new business unit" });
                }
                if (!/^[a-z0-9-]+$/.test(slug)) {
                    return res.status(400).json({ error: "Slug must be lowercase letters, numbers and hyphens only" });
                }
                const slugTaken = await BusinessUnit_1.BusinessUnit.findOne({ slug: slug.toLowerCase() });
                if (slugTaken) {
                    return res.status(409).json({ error: `Slug "${slug}" is already taken` });
                }
                const logoPath = req.file ? `/logos/${req.file.filename}` : undefined;
                buDoc = await BusinessUnit_1.BusinessUnit.create({
                    name: adminBU,
                    label: label || adminBU,
                    slug: slug.toLowerCase(),
                    logo: logoPath,
                    contactEmail: contactEmail || undefined,
                    isActive: true
                });
            }
            else {
                // BU exists — update slug/logo/label if provided
                if (slug) {
                    if (!/^[a-z0-9-]+$/.test(slug)) {
                        return res.status(400).json({ error: "Slug must be lowercase letters, numbers and hyphens only" });
                    }
                    const slugTaken = await BusinessUnit_1.BusinessUnit.findOne({ slug: slug.toLowerCase(), _id: { $ne: buDoc._id } });
                    if (slugTaken) {
                        return res.status(409).json({ error: `Slug "${slug}" is already taken` });
                    }
                    buDoc.slug = slug.toLowerCase();
                }
                if (req.file)
                    buDoc.logo = `/logos/${req.file.filename}`;
                if (label)
                    buDoc.label = label;
                if (contactEmail)
                    buDoc.contactEmail = contactEmail;
                await buDoc.save();
            }
            // Email domain validation
            const emailDomainMapping = await BusinessUnitEmailMapping_1.BusinessUnitEmailMapping.findOne({ businessUnit: adminBU });
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
        const admin = new AdminUser_1.AdminUser({
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
            await (0, emailService_1.sendVerificationEmail)(email.toLowerCase(), otp, adminFullName, adminBU);
        }
        catch (emailError) {
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
    }
    catch (error) {
        console.error("Admin register error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// Admin Login — embeds tenantId + slug in JWT
exports.adminAuthRouter.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }
        const admin = await AdminUser_1.AdminUser.findOne({ email: email.toLowerCase() });
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
        const passwordMatch = await bcryptjs_1.default.compare(password, admin.password);
        if (!passwordMatch) {
            return res.status(401).json({ error: "Invalid email or password" });
        }
        // Fetch tenant info to embed in token
        let tenantId;
        let tenantSlug;
        let tenantLogo;
        if (admin.businessUnit !== "SUPERADMIN") {
            const buDoc = await BusinessUnit_1.BusinessUnit.findOne({ name: admin.businessUnit });
            if (buDoc) {
                tenantId = buDoc.tenantId;
                tenantSlug = buDoc.slug;
                tenantLogo = buDoc.logo;
            }
        }
        const token = jsonwebtoken_1.default.sign({
            adminId: admin._id,
            email: admin.email,
            fullName: admin.fullName,
            businessUnit: admin.businessUnit,
            tenantId,
            tenantSlug,
            isAdmin: true
        }, JWT_SECRET, { expiresIn: "7d" });
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
    }
    catch (error) {
        console.error("Admin login error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// Verify Email
exports.adminAuthRouter.post("/verify-email", async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ error: "Email and OTP are required" });
        }
        const admin = await AdminUser_1.AdminUser.findOne({
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
            await (0, emailService_1.sendWelcomeEmail)(admin.email, admin.fullName);
        }
        catch (emailError) {
            console.error("Failed to send welcome email:", emailError);
        }
        res.json({ message: "Email verified successfully! You can now login." });
    }
    catch (error) {
        console.error("Verify email error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// Resend Verification
exports.adminAuthRouter.post("/resend-verification", async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: "Email is required" });
        }
        const admin = await AdminUser_1.AdminUser.findOne({ email: email.toLowerCase() });
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
            await (0, emailService_1.sendVerificationEmail)(admin.email, otp, admin.fullName, admin.businessUnit);
        }
        catch (emailError) {
            console.error("Failed to send verification email:", emailError);
            return res.status(500).json({ error: "Failed to send verification code. Please try again." });
        }
        res.json({ message: "Verification code sent. Please check your inbox." });
    }
    catch (error) {
        console.error("Resend verification error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// Forgot Password
exports.adminAuthRouter.post("/forgot-password", async (req, res) => {
    try {
        const { email } = req.body;
        if (!email)
            return res.status(400).json({ error: "Email is required" });
        const admin = await AdminUser_1.AdminUser.findOne({ email: email.toLowerCase() });
        if (!admin) {
            return res.status(200).json({ message: "If an account exists with this email, a reset link will be sent shortly" });
        }
        const resetTokenRaw = crypto_1.default.randomBytes(32).toString("hex");
        admin.resetToken = generateToken(resetTokenRaw);
        admin.resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);
        await admin.save();
        try {
            await (0, emailService_1.sendPasswordResetEmail)(admin.email, resetTokenRaw, admin.fullName);
        }
        catch (emailError) {
            console.error("Failed to send reset email:", emailError);
            return res.status(500).json({ error: "Failed to send password reset email. Please try again." });
        }
        res.json({ message: "If an account exists with this email, a reset link will be sent shortly" });
    }
    catch (error) {
        console.error("Forgot password error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// Reset Password
exports.adminAuthRouter.post("/reset-password", async (req, res) => {
    try {
        const { token, newPassword, email } = req.body;
        if (!token || !newPassword || !email) {
            return res.status(400).json({ error: "Token, email, and new password are required" });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: "Password must be at least 6 characters long" });
        }
        const admin = await AdminUser_1.AdminUser.findOne({
            email: email.toLowerCase(),
            resetToken: generateToken(token),
            resetTokenExpiry: { $gt: new Date() }
        });
        if (!admin) {
            return res.status(400).json({ error: "Reset token is invalid or has expired" });
        }
        admin.password = await bcryptjs_1.default.hash(newPassword, 10);
        admin.resetToken = undefined;
        admin.resetTokenExpiry = undefined;
        await admin.save();
        res.json({ message: "Password reset successfully. You can now login with your new password." });
    }
    catch (error) {
        console.error("Reset password error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// Get all BU admins — SUPERADMIN only
exports.adminAuthRouter.get("/admins", auth_1.superAdminMiddleware, async (_req, res) => {
    try {
        const admins = await AdminUser_1.AdminUser.find({}, { password: 0 }).sort({ createdAt: -1 });
        res.json({ admins });
    }
    catch (error) {
        console.error("Get admins error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// Get users by BU — BU admins see own BU only; SUPERADMIN can query any
exports.adminAuthRouter.get("/users", auth_1.adminAuthMiddleware, async (req, res) => {
    try {
        const { isSuperAdmin, businessUnit: tokenBU } = req;
        const requestedBU = req.query.businessUnit;
        const targetBU = isSuperAdmin ? requestedBU : tokenBU;
        if (!targetBU) {
            return res.status(400).json({ error: "businessUnit query parameter is required" });
        }
        const validBUs = await BusinessUnit_1.BusinessUnit.find().select("name");
        const validBUNames = validBUs.map((bu) => bu.name);
        if (!validBUNames.includes(targetBU)) {
            return res.status(400).json({ error: "Invalid business unit" });
        }
        const users = await User_1.User.find({ businessUnit: targetBU }, { password: 0, resetToken: 0, resetTokenExpiry: 0 }).sort({ createdAt: -1 });
        res.json({ users });
    }
    catch (error) {
        console.error("Get users error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
