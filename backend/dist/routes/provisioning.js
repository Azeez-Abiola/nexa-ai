"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.provisioningRouter = void 0;
const express_1 = __importDefault(require("express"));
const crypto_1 = __importDefault(require("crypto"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const BusinessUnit_1 = require("../models/BusinessUnit");
const AdminUser_1 = require("../models/AdminUser");
const AdminInvite_1 = require("../models/AdminInvite");
const auth_1 = require("../middleware/auth");
const emailService_1 = require("../services/emailService");
exports.provisioningRouter = express_1.default.Router();
// Logo upload
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
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith("image/"))
            cb(null, true);
        else
            cb(new Error("Only image files are allowed"));
    }
});
function hashToken(token) {
    return crypto_1.default.createHash("sha256").update(token).digest("hex");
}
// ─── TENANT MANAGEMENT ────────────────────────────────────────────────────────
// GET /provisioning/tenants — list all tenants
exports.provisioningRouter.get("/tenants", auth_1.superAdminMiddleware, async (_req, res) => {
    try {
        const tenants = await BusinessUnit_1.BusinessUnit.find().sort({ createdAt: -1 }).lean();
        res.json({ tenants });
    }
    catch (error) {
        console.error("List tenants error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// POST /provisioning/tenants — create a new tenant
exports.provisioningRouter.post("/tenants", auth_1.superAdminMiddleware, logoUpload.single("logo"), async (req, res) => {
    try {
        const { name, label, slug, contactEmail, emailDomain } = req.body;
        if (!name || !label || !slug) {
            return res.status(400).json({ error: "name, label and slug are required" });
        }
        // Slug validation
        if (!/^[a-z0-9-]+$/.test(slug)) {
            return res.status(400).json({ error: "Slug must be lowercase letters, numbers and hyphens only" });
        }
        // Uniqueness checks
        const [nameTaken, slugTaken] = await Promise.all([
            BusinessUnit_1.BusinessUnit.findOne({ name }),
            BusinessUnit_1.BusinessUnit.findOne({ slug })
        ]);
        if (nameTaken)
            return res.status(409).json({ error: `Tenant name "${name}" already exists` });
        if (slugTaken)
            return res.status(409).json({ error: `Slug "${slug}" is already taken` });
        const logoPath = req.file ? `/logos/${req.file.filename}` : undefined;
        const tenant = await BusinessUnit_1.BusinessUnit.create({
            name,
            label,
            slug: slug.toLowerCase(),
            logo: logoPath,
            contactEmail: contactEmail || undefined,
            isActive: true
        });
        res.status(201).json({
            message: "Tenant created successfully",
            tenant: {
                tenantId: tenant.tenantId,
                name: tenant.name,
                label: tenant.label,
                slug: tenant.slug,
                logo: tenant.logo,
                subdomain: `${tenant.slug}.nexa.ai`
            }
        });
    }
    catch (error) {
        console.error("Create tenant error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// PUT /provisioning/tenants/:id — update tenant
exports.provisioningRouter.put("/tenants/:id", auth_1.superAdminMiddleware, logoUpload.single("logo"), async (req, res) => {
    try {
        const { id } = req.params;
        const { label, slug, contactEmail, isActive } = req.body;
        const tenant = await BusinessUnit_1.BusinessUnit.findById(id);
        if (!tenant)
            return res.status(404).json({ error: "Tenant not found" });
        if (slug && slug !== tenant.slug) {
            if (!/^[a-z0-9-]+$/.test(slug)) {
                return res.status(400).json({ error: "Slug must be lowercase letters, numbers and hyphens only" });
            }
            const slugTaken = await BusinessUnit_1.BusinessUnit.findOne({ slug, _id: { $ne: id } });
            if (slugTaken)
                return res.status(409).json({ error: `Slug "${slug}" is already taken` });
            tenant.slug = slug.toLowerCase();
        }
        if (label)
            tenant.label = label;
        if (contactEmail !== undefined)
            tenant.contactEmail = contactEmail;
        if (isActive !== undefined)
            tenant.isActive = isActive === "true" || isActive === true;
        if (req.file)
            tenant.logo = `/logos/${req.file.filename}`;
        await tenant.save();
        res.json({ message: "Tenant updated", tenant });
    }
    catch (error) {
        console.error("Update tenant error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// ─── ADMIN INVITE ──────────────────────────────────────────────────────────────
// POST /provisioning/invite — SUPERADMIN invites a BU admin
exports.provisioningRouter.post("/invite", auth_1.superAdminMiddleware, async (req, res) => {
    try {
        const { email, fullName, businessUnit } = req.body;
        if (!email || !fullName || !businessUnit) {
            return res.status(400).json({ error: "email, fullName and businessUnit are required" });
        }
        // Resolve tenant
        const tenant = await BusinessUnit_1.BusinessUnit.findOne({ name: businessUnit });
        if (!tenant) {
            return res.status(404).json({ error: `Business unit "${businessUnit}" not found. Create the tenant first.` });
        }
        // Don't invite if admin already exists with this email
        const existing = await AdminUser_1.AdminUser.findOne({ email: email.toLowerCase() });
        if (existing) {
            return res.status(409).json({ error: "An admin account already exists with this email" });
        }
        // Cancel any existing pending invite for this email + BU
        await AdminInvite_1.AdminInvite.updateMany({ email: email.toLowerCase(), businessUnit, status: "pending" }, { status: "expired" });
        // Generate invite token (raw sent in email, hashed stored in DB)
        const rawToken = crypto_1.default.randomBytes(32).toString("hex");
        const hashedToken = hashToken(rawToken);
        const invite = await AdminInvite_1.AdminInvite.create({
            email: email.toLowerCase(),
            fullName,
            businessUnit,
            tenantId: tenant.tenantId,
            token: hashedToken,
            status: "pending",
            invitedBy: req.email,
            expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 hours
        });
        // Send invite email
        try {
            await (0, emailService_1.sendAdminInviteEmail)(email.toLowerCase(), fullName, businessUnit, tenant.slug, rawToken);
        }
        catch (emailError) {
            console.error("Failed to send invite email:", emailError);
            // Roll back invite if email fails
            await AdminInvite_1.AdminInvite.findByIdAndDelete(invite._id);
            return res.status(500).json({ error: "Failed to send invite email. Please try again." });
        }
        res.status(201).json({
            message: `Invite sent to ${email}`,
            invite: {
                id: invite._id,
                email: invite.email,
                fullName: invite.fullName,
                businessUnit: invite.businessUnit,
                status: invite.status,
                expiresAt: invite.expiresAt
            }
        });
    }
    catch (error) {
        console.error("Send invite error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// GET /provisioning/invites — list all invites (SUPERADMIN)
exports.provisioningRouter.get("/invites", auth_1.superAdminMiddleware, async (_req, res) => {
    try {
        const invites = await AdminInvite_1.AdminInvite.find().sort({ createdAt: -1 }).lean();
        res.json({ invites });
    }
    catch (error) {
        console.error("List invites error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// DELETE /provisioning/invites/:id — revoke a pending invite
exports.provisioningRouter.delete("/invites/:id", auth_1.superAdminMiddleware, async (_req, res) => {
    try {
        const { id } = _req.params;
        const invite = await AdminInvite_1.AdminInvite.findById(id);
        if (!invite)
            return res.status(404).json({ error: "Invite not found" });
        if (invite.status !== "pending") {
            return res.status(400).json({ error: "Only pending invites can be revoked" });
        }
        invite.status = "expired";
        await invite.save();
        res.json({ message: "Invite revoked" });
    }
    catch (error) {
        console.error("Revoke invite error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// ─── INVITE ACCEPTANCE ────────────────────────────────────────────────────────
// GET /provisioning/invite/verify?token=xxx — validate token before showing set-password form
exports.provisioningRouter.get("/invite/verify", async (req, res) => {
    try {
        const { token } = req.query;
        if (!token)
            return res.status(400).json({ error: "Token is required" });
        const invite = await AdminInvite_1.AdminInvite.findOne({
            token: hashToken(token),
            status: "pending",
            expiresAt: { $gt: new Date() }
        });
        if (!invite) {
            return res.status(400).json({ error: "Invite link is invalid or has expired" });
        }
        res.json({
            valid: true,
            email: invite.email,
            fullName: invite.fullName,
            businessUnit: invite.businessUnit
        });
    }
    catch (error) {
        console.error("Verify invite error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// POST /provisioning/invite/accept — invited admin sets their password
exports.provisioningRouter.post("/invite/accept", async (req, res) => {
    try {
        const { token, password } = req.body;
        if (!token || !password) {
            return res.status(400).json({ error: "Token and password are required" });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: "Password must be at least 6 characters" });
        }
        const invite = await AdminInvite_1.AdminInvite.findOne({
            token: hashToken(token),
            status: "pending",
            expiresAt: { $gt: new Date() }
        });
        if (!invite) {
            return res.status(400).json({ error: "Invite link is invalid or has expired" });
        }
        // Check no admin account was created already (race condition guard)
        const existing = await AdminUser_1.AdminUser.findOne({ email: invite.email });
        if (existing) {
            invite.status = "accepted";
            await invite.save();
            return res.status(409).json({ error: "An account with this email already exists. Please login." });
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
        // Create the admin account — pre-verified (no OTP needed, SUPERADMIN already vouched)
        const admin = new AdminUser_1.AdminUser({
            email: invite.email,
            fullName: invite.fullName,
            businessUnit: invite.businessUnit,
            password: hashedPassword,
            emailVerified: true
        });
        await admin.save();
        // Mark invite as accepted
        invite.status = "accepted";
        await invite.save();
        res.json({
            message: "Account created successfully. You can now log in.",
            email: admin.email,
            businessUnit: admin.businessUnit
        });
    }
    catch (error) {
        console.error("Accept invite error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
