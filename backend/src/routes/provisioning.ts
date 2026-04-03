import express, { Response } from "express";
import crypto from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs";
import bcryptjs from "bcryptjs";
import { BusinessUnit } from "../models/BusinessUnit";
import { AdminUser } from "../models/AdminUser";
import { AdminInvite } from "../models/AdminInvite";
import { superAdminMiddleware, AuthenticatedRequest } from "../middleware/auth";
import { sendAdminInviteEmail } from "../services/emailService";

export const provisioningRouter = express.Router();

// Logo upload
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
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  }
});

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// ─── TENANT MANAGEMENT ────────────────────────────────────────────────────────

// GET /provisioning/tenants — list all tenants
provisioningRouter.get("/tenants", superAdminMiddleware, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const tenants = await BusinessUnit.find().sort({ createdAt: -1 }).lean();
    res.json({ tenants });
  } catch (error) {
    console.error("List tenants error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /provisioning/tenants — create a new tenant
provisioningRouter.post(
  "/tenants",
  superAdminMiddleware,
  logoUpload.single("logo"),
  async (req: AuthenticatedRequest, res: Response) => {
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
        BusinessUnit.findOne({ name }),
        BusinessUnit.findOne({ slug })
      ]);
      if (nameTaken) return res.status(409).json({ error: `Tenant name "${name}" already exists` });
      if (slugTaken) return res.status(409).json({ error: `Slug "${slug}" is already taken` });

      const logoPath = req.file ? `/logos/${req.file.filename}` : undefined;

      const tenant = await BusinessUnit.create({
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
    } catch (error) {
      console.error("Create tenant error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// PUT /provisioning/tenants/:id — update tenant
provisioningRouter.put(
  "/tenants/:id",
  superAdminMiddleware,
  logoUpload.single("logo"),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { label, slug, contactEmail, isActive } = req.body;

      const tenant = await BusinessUnit.findById(id);
      if (!tenant) return res.status(404).json({ error: "Tenant not found" });

      if (slug && slug !== tenant.slug) {
        if (!/^[a-z0-9-]+$/.test(slug)) {
          return res.status(400).json({ error: "Slug must be lowercase letters, numbers and hyphens only" });
        }
        const slugTaken = await BusinessUnit.findOne({ slug, _id: { $ne: id } });
        if (slugTaken) return res.status(409).json({ error: `Slug "${slug}" is already taken` });
        tenant.slug = slug.toLowerCase();
      }

      if (label) tenant.label = label;
      if (contactEmail !== undefined) tenant.contactEmail = contactEmail;
      if (isActive !== undefined) tenant.isActive = isActive === "true" || isActive === true;
      if (req.file) tenant.logo = `/logos/${req.file.filename}`;

      await tenant.save();

      res.json({ message: "Tenant updated", tenant });
    } catch (error) {
      console.error("Update tenant error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ─── ADMIN INVITE ──────────────────────────────────────────────────────────────

// POST /provisioning/invite — SUPERADMIN invites a BU admin
provisioningRouter.post("/invite", superAdminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, fullName, businessUnit } = req.body;

    if (!email || !fullName || !businessUnit) {
      return res.status(400).json({ error: "email, fullName and businessUnit are required" });
    }

    // Resolve tenant
    const tenant = await BusinessUnit.findOne({ name: businessUnit });
    if (!tenant) {
      return res.status(404).json({ error: `Business unit "${businessUnit}" not found. Create the tenant first.` });
    }

    // Don't invite if admin already exists with this email
    const existing = await AdminUser.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: "An admin account already exists with this email" });
    }

    // Cancel any existing pending invite for this email + BU
    await AdminInvite.updateMany(
      { email: email.toLowerCase(), businessUnit, status: "pending" },
      { status: "expired" }
    );

    // Generate invite token (raw sent in email, hashed stored in DB)
    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = hashToken(rawToken);

    const invite = await AdminInvite.create({
      email: email.toLowerCase(),
      fullName,
      businessUnit,
      tenantId: tenant.tenantId,
      token: hashedToken,
      status: "pending",
      invitedBy: req.email!,
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 hours
    });

    // Send invite email
    try {
      await sendAdminInviteEmail(email.toLowerCase(), fullName, businessUnit, tenant.slug, rawToken);
    } catch (emailError) {
      console.error("Failed to send invite email:", emailError);
      // Roll back invite if email fails
      await AdminInvite.findByIdAndDelete(invite._id);
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
  } catch (error) {
    console.error("Send invite error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /provisioning/invites — list all invites (SUPERADMIN)
provisioningRouter.get("/invites", superAdminMiddleware, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const invites = await AdminInvite.find().sort({ createdAt: -1 }).lean();
    res.json({ invites });
  } catch (error) {
    console.error("List invites error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /provisioning/invites/:id — revoke a pending invite
provisioningRouter.delete("/invites/:id", superAdminMiddleware, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = _req.params;
    const invite = await AdminInvite.findById(id);
    if (!invite) return res.status(404).json({ error: "Invite not found" });
    if (invite.status !== "pending") {
      return res.status(400).json({ error: "Only pending invites can be revoked" });
    }
    invite.status = "expired";
    await invite.save();
    res.json({ message: "Invite revoked" });
  } catch (error) {
    console.error("Revoke invite error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── INVITE ACCEPTANCE ────────────────────────────────────────────────────────

// GET /provisioning/invite/verify?token=xxx — validate token before showing set-password form
provisioningRouter.get("/invite/verify", async (req, res) => {
  try {
    const { token } = req.query as { token: string };
    if (!token) return res.status(400).json({ error: "Token is required" });

    const invite = await AdminInvite.findOne({
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
  } catch (error) {
    console.error("Verify invite error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /provisioning/invite/accept — invited admin sets their password
provisioningRouter.post("/invite/accept", async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: "Token and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const invite = await AdminInvite.findOne({
      token: hashToken(token),
      status: "pending",
      expiresAt: { $gt: new Date() }
    });

    if (!invite) {
      return res.status(400).json({ error: "Invite link is invalid or has expired" });
    }

    // Check no admin account was created already (race condition guard)
    const existing = await AdminUser.findOne({ email: invite.email });
    if (existing) {
      invite.status = "accepted";
      await invite.save();
      return res.status(409).json({ error: "An account with this email already exists. Please login." });
    }

    const hashedPassword = await bcryptjs.hash(password, 10);

    // Create the admin account — pre-verified (no OTP needed, SUPERADMIN already vouched)
    const admin = new AdminUser({
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
  } catch (error) {
    console.error("Accept invite error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
