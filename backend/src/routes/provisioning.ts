import express, { Response } from "express";
import crypto from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs";
import bcryptjs from "bcryptjs";
import { BusinessUnit } from "../models/BusinessUnit";
import { AdminUser } from "../models/AdminUser";
import { User } from "../models/User";
import { RagDocument } from "../models/RagDocument";
import { AdminInvite } from "../models/AdminInvite";
import { TenantRequest } from "../models/TenantRequest";
import { superAdminMiddleware, AuthenticatedRequest } from "../middleware/auth";
import { sendTenantCredentialsEmail, sendAccessRequestRejected } from "../services/emailService";

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
  limits: { fileSize: 10 * 1024 * 1024 },
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
    const enriched = await Promise.all(
      tenants.map(async (t: any) => {
        const [userCount, ragCount] = await Promise.all([
          User.countDocuments({ businessUnit: t.name }),
          RagDocument.countDocuments({ businessUnit: t.name, processingStatus: { $ne: "superseded" } })
        ]);
        return { ...t, userCount, ragDocumentCount: ragCount };
      })
    );
    res.json({ tenants: enriched });
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
      const { name, label, slug, contactEmail, colorCode } = req.body;

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
        colorCode: colorCode || "#ed0000",
        /** Inactive until a super-admin activates the tenant (employees cannot register until then). */
        isActive: false
      });

      // If contactEmail is provided, auto-create an Admin account
      let autoAdmin = null;
      if (contactEmail) {
        const existingAdmin = await AdminUser.findOne({ email: contactEmail.toLowerCase() });
        if (!existingAdmin) {
          const autoPassword = crypto.randomBytes(6).toString("hex"); // e.g. "a1b2c3d4e5f6"
          const hashedPassword = await bcryptjs.hash(autoPassword, 10);
          
          await AdminUser.create({
            email: contactEmail.toLowerCase(),
            fullName: label + " Administrator",
            businessUnit: name,
            password: hashedPassword,
            emailVerified: true
          });

          // Send email with credentials
          try {
            const { sendTenantCredentialsEmail } = require("../services/emailService");
            await sendTenantCredentialsEmail(
              contactEmail.toLowerCase(),
              label + " Administrator",
              name,
              tenant.slug,
              autoPassword
            );
            autoAdmin = { email: contactEmail.toLowerCase(), passwordGenerated: true };
          } catch (emailError) {
            console.error("Auto-admin email failed:", emailError);
          }
        }
      }

      res.status(201).json({
        message: "Tenant created successfully",
        tenant: {
          tenantId: tenant.tenantId,
          name: tenant.name,
          label: tenant.label,
          slug: tenant.slug,
          logo: tenant.logo,
          subdomain: `${tenant.slug}.nexa.ai`
        },
        autoAdmin
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
      const { name, label, slug, contactEmail, isActive, colorCode } = req.body;

      const tenant = await BusinessUnit.findById(id);
      if (!tenant) return res.status(404).json({ error: "Tenant not found" });

      if (name !== undefined && String(name).trim() !== "") {
        const nextName = String(name).trim();
        if (nextName !== tenant.name) {
          const nameTaken = await BusinessUnit.findOne({ name: nextName, _id: { $ne: id } });
          if (nameTaken) {
            return res.status(409).json({ error: `Tenant name "${nextName}" already exists` });
          }
          const oldName = tenant.name;
          tenant.name = nextName;
          await Promise.all([
            AdminUser.updateMany({ businessUnit: oldName }, { businessUnit: nextName }),
            User.updateMany({ businessUnit: oldName }, { businessUnit: nextName })
          ]);
        }
      }

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
      if (colorCode !== undefined) tenant.colorCode = colorCode;
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

    // Auto-generate a secure random password
    const autoPassword = crypto.randomBytes(6).toString("hex"); // e.g. "a1b2c3d4e5f6"
    const hashedPassword = await bcryptjs.hash(autoPassword, 10);

    // Create the admin account directly — status is active immediately
    const admin = await AdminUser.create({
      email: email.toLowerCase(),
      fullName,
      businessUnit,
      password: hashedPassword,
      emailVerified: true // Superadmin-created accounts are pre-verified
    });

    // Also create an AdminInvite record for auditing/logging (status: accepted)
    await AdminInvite.create({
      email: email.toLowerCase(),
      fullName,
      businessUnit,
      tenantId: tenant.tenantId,
      status: "accepted",
      invitedBy: req.email!,
      expiresAt: new Date(), // Already accepted
      token: "DIRECT-PROVISIONED"
    });

    // Send the credentials email with the auto-generated password
    try {
      await sendTenantCredentialsEmail(
        email.toLowerCase(),
        fullName,
        businessUnit,
        tenant.slug,
        autoPassword
      );
    } catch (emailError) {
      console.error("Failed to send credentials email:", emailError);
      // We don't roll back the user creation here as the account is already active, 
      // but we inform the superadmin so they can manually reset or track.
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
    console.error("Direct admin creation error:", error);
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

// ─── ACCESS REQUESTS ──────────────────────────────────────────────────────────

// GET /provisioning/access-requests — list all access requests (filterable by status)
provisioningRouter.get("/access-requests", superAdminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status } = req.query as { status?: string };
    const filter: Record<string, string> = {};
    if (status && ["pending", "rejected", "provisioned"].includes(status)) {
      filter.status = status;
    }
    const requests = await TenantRequest.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ requests });
  } catch (error) {
    console.error("List access requests error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /provisioning/access-requests/:id/reject — mark rejected and notify requester
provisioningRouter.patch("/access-requests/:id/reject", superAdminMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { note } = req.body as { note?: string };
    const request = await TenantRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ error: "Access request not found" });
    if (request.status !== "pending") {
      return res.status(400).json({ error: "Only pending requests can be rejected" });
    }
    request.status = "rejected";
    request.reviewedBy = req.email!;
    request.reviewedAt = new Date();
    if (note) request.rejectionNote = note;
    await request.save();

    sendAccessRequestRejected(request.workEmail, request.companyName, note)
      .catch(err => console.error("Rejection email failed:", err));

    res.json({ message: "Request rejected and notification sent to the company.", request });
  } catch (error) {
    console.error("Reject access request error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /provisioning/access-requests/:id/provision
// One-step: create tenant + admin account + send credentials, then mark request as provisioned.
// Works from "pending" or "approved" status so super-admin can skip the separate approve step.
provisioningRouter.post("/access-requests/:id/provision", superAdminMiddleware, logoUpload.single("logo"), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const request = await TenantRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ error: "Access request not found" });
    if (request.status === "rejected" || request.status === "provisioned") {
      return res.status(400).json({ error: `Request is already ${request.status}` });
    }

    // Allow caller to override label/slug/colorCode; fall back to sensible defaults from the request
    const label: string = String(req.body.label || request.companyName).trim();
    const colorCode: string = String(req.body.colorCode || "#ed0000").trim();

    // Generate a slug from the company name — lowercase, spaces/special chars → hyphens
    const baseSlug = request.companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    // Resolve a unique slug (append -2, -3, … on collision)
    let slug = baseSlug;
    let suffix = 2;
    while (await BusinessUnit.findOne({ slug })) {
      slug = `${baseSlug}-${suffix++}`;
    }

    // Also guard against duplicate tenant name
    const nameTaken = await BusinessUnit.findOne({ name: request.companyName });
    if (nameTaken) {
      return res.status(409).json({
        error: `A tenant named "${request.companyName}" already exists. Provision manually with a different name.`
      });
    }

    const logoPath = req.file ? `/logos/${req.file.filename}` : undefined;

    // Create the tenant — activate immediately since the request has already been vetted
    const tenant = await BusinessUnit.create({
      name: request.companyName,
      label,
      slug,
      logo: logoPath,
      contactEmail: request.workEmail,
      colorCode,
      isActive: true
    });

    // Auto-generate admin credentials
    const autoPassword = crypto.randomBytes(6).toString("hex");
    const hashedPassword = await bcryptjs.hash(autoPassword, 10);
    const adminFullName = `${request.companyName} Administrator`;

    // Prevent duplicate admin account
    const existingAdmin = await AdminUser.findOne({ email: request.workEmail });
    let admin;
    if (!existingAdmin) {
      admin = await AdminUser.create({
        email: request.workEmail,
        fullName: adminFullName,
        businessUnit: tenant.name,
        password: hashedPassword,
        emailVerified: true
      });

      // Audit record
      await AdminInvite.create({
        email: request.workEmail,
        fullName: adminFullName,
        businessUnit: tenant.name,
        tenantId: tenant.tenantId,
        status: "accepted",
        invitedBy: req.email!,
        expiresAt: new Date(),
        token: "ACCESS-REQUEST-PROVISIONED"
      });
    }

    // Send credentials email — if it fails the tenant + admin still exist; super-admin is informed
    try {
      await sendTenantCredentialsEmail(
        request.workEmail,
        adminFullName,
        tenant.name,
        tenant.slug,
        autoPassword
      );
    } catch (emailError) {
      console.error("Credentials email failed after provisioning:", emailError);
      // Mark request provisioned even on email failure — don't roll back the DB writes
      request.status = "provisioned";
      request.reviewedBy = req.email!;
      request.reviewedAt = new Date();
      request.provisionedTenantId = tenant.tenantId;
      await request.save();

      return res.status(207).json({
        message: "Tenant provisioned but credentials email could not be sent. Reset the admin password manually.",
        tenant: { tenantId: tenant.tenantId, name: tenant.name, slug: tenant.slug },
        adminEmail: request.workEmail
      });
    }

    // Mark request as provisioned and link to the new tenant
    request.status = "provisioned";
    request.reviewedBy = req.email!;
    request.reviewedAt = new Date();
    request.provisionedTenantId = tenant.tenantId;
    await request.save();

    res.status(201).json({
      message: `Tenant provisioned and credentials sent to ${request.workEmail}`,
      tenant: {
        tenantId: tenant.tenantId,
        name: tenant.name,
        label: tenant.label,
        slug: tenant.slug,
        subdomain: `${tenant.slug}.nexa.ai`,
        isActive: tenant.isActive
      },
      admin: {
        email: request.workEmail,
        fullName: adminFullName,
        existedAlready: !!existingAdmin
      },
      request: { id: request._id, status: request.status }
    });
  } catch (error) {
    console.error("Provision from request error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
