import dotenv from "dotenv";

// Load environment variables FIRST, before any other imports
dotenv.config();

import express from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger";
import cors from "cors";
import mongoose from "mongoose";
import { json } from "body-parser";
import path from "path";
import crypto from "crypto";
import { chatRouter } from "./routes/chat";
import { adminPoliciesRouter } from "./routes/adminPolicies";
import { authRouter } from "./routes/auth";
import { adminAuthRouter } from "./routes/adminAuth";
import { conversationRouter } from "./routes/conversation";
import { conversationSharingRouter } from "./routes/conversationSharing";
import { conversationAccessRouter } from "./routes/conversationAccess";
import { conversationMentionsRouter } from "./routes/conversationMentions";
import { analyticsRouter } from "./routes/analytics";
import { provisioningRouter } from "./routes/provisioning";
import { employeeInviteRouter } from "./routes/employeeInvite";
import { adminDocumentsRouter } from "./routes/adminDocuments";
import { adminKnowledgeGroupsRouter } from "./routes/adminKnowledgeGroups";
import { adminAuditLogsRouter } from "./routes/adminAuditLogs";
import { BusinessUnit } from "./models/BusinessUnit";
import { tenantMiddleware } from "./middleware/tenant";
import { authLimiter, aiLimiter, aiDailyLimiter } from "./middleware/rateLimiter";
import logger from "./utils/logger";
import { sendContactFormInquiry, sendAccessRequestNotification, sendAccessRequestReceived, sendAccessRequestOtpEmail } from "./services/emailService";
import { TenantRequest } from "./models/TenantRequest";
import { PendingAccessRequest } from "./models/PendingAccessRequest";
import { startWorker } from "./queue/documentWorker";
import { startUserDocumentWorker } from "./queue/userDocumentWorker";
import { userDocumentsRouter } from "./routes/userDocuments";
import { documentGenerationRouter } from "./routes/documentGeneration";
import { notificationsRouter } from "./routes/notifications";
import { notifySuperAdminsAccessRequest } from "./services/notificationService";

const app = express();

const TRUSTED_ORIGIN_ROOT = process.env.TRUSTED_ORIGIN_ROOT;
if (!TRUSTED_ORIGIN_ROOT && process.env.NODE_ENV === "production") {
  throw new Error("TRUSTED_ORIGIN_ROOT must be set in production for CORS to allow the frontend");
}

function isAllowedOrigin(origin: string): boolean {
  if (process.env.NODE_ENV !== "production" && /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
    return true;
  }
  if (!TRUSTED_ORIGIN_ROOT) return false;
  try {
    const { protocol, hostname } = new URL(origin);
    if (protocol !== "https:") return false;
    return hostname === TRUSTED_ORIGIN_ROOT || hostname.endsWith(`.${TRUSTED_ORIGIN_ROOT}`);
  } catch {
    return false;
  }
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (isAllowedOrigin(origin)) return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    // Expose draft-7 rate-limit headers so the frontend can show remaining
    // message quota and a countdown to when the limit refreshes.
    exposedHeaders: ["RateLimit", "RateLimit-Policy", "Retry-After"],
  })
);
app.use(json());

// Security headers (CSP, X-Frame-Options, X-Content-Type-Options, etc). HSTS is left off here
// since the deployment's edge/proxy already sends a correct Strict-Transport-Security header —
// setting it again here risks duplicate/conflicting header values.
// frameAncestors is 'self' (not 'none') because super-admin/AskNexa.tsx embeds /user-chat in a
// same-origin iframe; blocking all framing would break that feature.
app.use(
  helmet({
    hsts: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "https://res.cloudinary.com", "data:"],
        mediaSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'self'"],
      },
    },
    frameguard: { action: "sameorigin" },
  })
);

// swagger-ui-express (mounted below at /api/docs) injects inline <script>/<style> to boot the
// UI — relax CSP for just that path rather than loosening it for the whole app.
app.use("/api/docs", (_req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:;"
  );
  next();
});

// Resolve tenant from subdomain on every request (e.g. ufl.nexa.ai → tenantId, businessUnit)
app.use(tenantMiddleware);

// Trust first proxy hop (Railway / nginx) so req.ip reflects the real client IP
app.set("trust proxy", 1);

// Serve frontend static files from the built dist folder
// When compiled, __dirname is backend/dist — we need to go up two levels
// to reach the project root and then the frontend/dist folder.
const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
const publicFolder = path.join(__dirname, '..', '..', 'public');

logger.info(`Frontend dist path: ${frontendDist}`);
logger.info(`Public folder path: ${publicFolder}`);

app.use('/assets', express.static(path.join(frontendDist, 'assets'), {
  maxAge: '1d',
  etag: false,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    }
  }
}));

app.use(express.static(frontendDist));
app.use(express.static(publicFolder));

app.use('/logos', express.static(path.join(publicFolder, 'logos')));

const frontendIndex = path.join(frontendDist, 'index.html');
const cPanelFile = path.join(publicFolder, 'c-panel.html');
app.get('/', (_req, res) => res.sendFile(frontendIndex));
app.get('/index.html', (_req, res) => res.sendFile(frontendIndex));

// Super-admin control panel redirected to React SPA
// app.get('/super-admin', (_req, res) => res.sendFile(cPanelFile));
app.get('/c-panel.html', (_req, res) => res.redirect(301, '/super-admin'));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: "Nexa AI API Docs",
  swaggerOptions: { persistAuthorization: true }
}));
app.get("/api/docs.json", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

app.use("/api/v1/auth", authLimiter, authRouter);
app.use("/api/v1/admin/auth", authLimiter, adminAuthRouter);
app.use("/api/v1/conversations", aiLimiter, aiDailyLimiter);
app.use("/api/v1/conversations", conversationSharingRouter);
app.use("/api/v1/conversations", conversationAccessRouter);
app.use("/api/v1/conversations", conversationMentionsRouter);
app.use("/api/v1/conversations", conversationRouter);
app.use("/api/v1/conversations", userDocumentsRouter);
app.use("/api/v1/chat", aiLimiter, aiDailyLimiter, chatRouter);
app.use("/api/v1/admin/policies", adminPoliciesRouter);
app.use("/api/v1/admin/documents", adminDocumentsRouter);
app.use("/api/v1/admin/user-groups", adminKnowledgeGroupsRouter);
app.use("/api/v1/admin/knowledge-groups", adminKnowledgeGroupsRouter); // legacy alias
app.use("/api/v1/admin/audit-logs", adminAuditLogsRouter);
app.use("/api/v1/analytics", analyticsRouter);
app.use("/api/v1/provisioning", provisioningRouter);
app.use("/api/v1/employee-invite", employeeInviteRouter);
app.use("/api/v1", documentGenerationRouter);
app.use("/api/v1/notifications", notificationsRouter);

app.get("/api/v1/public/business-units", async (_req, res) => {
  try {
    const businessUnitsFromDB = await BusinessUnit.find().sort("name").lean();

    const businessUnits = businessUnitsFromDB.map((bu: any) => ({
      value: bu.name,
      label: bu.label,
      name: bu.name
    }));
    
    res.json({ businessUnits });
  } catch (error) {
    logger.error("Get BU list error", { error });
    res.status(500).json({ error: "Failed to fetch business units" });
  }
});

app.post("/api/v1/public/contact", async (req, res) => {
  try {
    const { name, email, company, message, intent } = req.body as Record<string, string | undefined>;
    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return res.status(400).json({ error: "Name, email, and message are required." });
    }
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
    if (!emailOk) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }
    await sendContactFormInquiry({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      company: company?.trim(),
      message: message.trim(),
      intent: intent === "demo" ? "demo" : "contact"
    });
    res.json({ ok: true, message: "Thanks — we received your message." });
  } catch (error) {
    logger.error("Public contact form error", { error });
    res.status(500).json({ error: "Could not send your message right now. Please try again later." });
  }
});

// Step 1 of 2. No TenantRequest is created and no admin/requester email is sent here — only an
// OTP is emailed to workEmail. Nothing reaches the admin review queue (or the requester's own
// inbox) until ownership of that email is proven via POST /request-access/verify-otp below.
// This stops the endpoint from being used to flood the queue or spam an email the requester
// doesn't actually own.
app.post("/api/v1/public/request-access", authLimiter, async (req, res) => {
  try {
    const { companyName, workEmail, phone, employeeCount } = req.body as Record<string, string | number | undefined>;

    if (!companyName || !workEmail || !phone || employeeCount == null) {
      return res.status(400).json({ error: "companyName, workEmail, phone, and employeeCount are required" });
    }

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(workEmail).trim());
    if (!emailOk) {
      return res.status(400).json({ error: "Please enter a valid work email address" });
    }

    const count = Number(employeeCount);
    if (!Number.isInteger(count) || count < 1) {
      return res.status(400).json({ error: "employeeCount must be a positive whole number" });
    }

    const normalizedEmail = String(workEmail).trim().toLowerCase();
    const duplicate = await TenantRequest.findOne({ workEmail: normalizedEmail, status: "pending" });
    if (duplicate) {
      return res.status(409).json({ error: "A request is already pending for this email address" });
    }

    const trimmedCompanyName = String(companyName).trim();
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

    // Overwrite any previous unverified attempt for this email rather than accumulating rows.
    await PendingAccessRequest.findOneAndUpdate(
      { workEmail: normalizedEmail },
      {
        companyName: trimmedCompanyName,
        workEmail: normalizedEmail,
        phone: String(phone).trim(),
        employeeCount: count,
        otp: otpHash,
        otpExpiry: new Date(Date.now() + 10 * 60 * 1000)
      },
      { upsert: true }
    );

    try {
      await sendAccessRequestOtpEmail(normalizedEmail, otp, trimmedCompanyName);
    } catch (emailError) {
      logger.error("Access request OTP email failed", { error: emailError });
      return res.status(500).json({ error: "Failed to send confirmation code. Please try again." });
    }

    res.status(200).json({
      message: "Enter the code we sent to your email to confirm your request.",
      requiresOtp: true
    });
  } catch (error) {
    logger.error("Request access error", { error });
    res.status(500).json({ error: "Internal server error" });
  }
});

// Step 2 of 2. Only once the OTP is verified does the actual TenantRequest get created and
// admins/requester notified — this is the point equivalent to the old single-step endpoint.
app.post("/api/v1/public/request-access/verify-otp", authLimiter, async (req, res) => {
  try {
    const { workEmail, otp } = req.body as Record<string, string | undefined>;

    if (!workEmail || !otp) {
      return res.status(400).json({ error: "workEmail and otp are required" });
    }

    const normalizedEmail = String(workEmail).trim().toLowerCase();
    const otpHash = crypto.createHash("sha256").update(String(otp)).digest("hex");

    const pending = await PendingAccessRequest.findOne({ workEmail: normalizedEmail });
    if (!pending || pending.otp !== otpHash || pending.otpExpiry < new Date()) {
      return res.status(401).json({ error: "Invalid or expired code" });
    }

    const duplicate = await TenantRequest.findOne({ workEmail: normalizedEmail, status: "pending" });
    if (duplicate) {
      await pending.deleteOne();
      return res.status(409).json({ error: "A request is already pending for this email address" });
    }

    const request = await TenantRequest.create({
      companyName: pending.companyName,
      workEmail: pending.workEmail,
      phone: pending.phone,
      employeeCount: pending.employeeCount
    });

    await pending.deleteOne();

    const reviewUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/admin/access-requests`;
    const submittedAt = new Date().toLocaleString("en-GB", { timeZone: "Africa/Lagos" });

    // Fire-and-forget — don't block the response on email delivery
    sendAccessRequestNotification({
      companyName: request.companyName,
      workEmail: request.workEmail,
      phone: request.phone,
      employeeCount: request.employeeCount,
      submittedAt,
      reviewUrl
    }).catch(err => logger.error("Access request notification email failed", { err }));

    sendAccessRequestReceived(request.workEmail, request.companyName)
      .catch(err => logger.error("Access request confirmation email failed", { err }));

    // In-app notification for every super-admin (fire-and-forget — never throws).
    notifySuperAdminsAccessRequest({
      companyName: request.companyName,
      workEmail: request.workEmail,
      requestId: String(request._id)
    });

    res.status(201).json({ message: "Request submitted successfully. We'll be in touch." });
  } catch (error) {
    logger.error("Request access OTP verify error", { error });
    res.status(500).json({ error: "Internal server error" });
  }
});

// Powers the C-Panel sidebar, which only needs names — not full BU records.
app.get("/api/v1/public/business-unit-names", async (_req, res) => {
  try {
    const buses = await BusinessUnit.find().select("name");
    const names = buses.map(bu => bu.name);
    res.json({ names });
  } catch (error) {
    logger.error("Get BU names error", { 
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined
    });
    res.status(500).json({ error: "Internal server error", details: error instanceof Error ? error.message : "Database error" });
  }
});

// SPA fallback: serve index.html for any non-API GET path (enables client-side routes like /admin)
app.get('*', (req, res, next) => {
  if (req.method !== 'GET') return next();
  if (req.path.startsWith('/api/')) return next();
  if (req.path.startsWith('/assets') || req.path.includes('.')) return next();
  res.sendFile(frontendIndex);
});

// Global error handler — must be registered after all routes/middleware.
// Rate-limit store failures (e.g. Redis unreachable) fail CLOSED with a 503 rather than
// silently falling through to Express's default handler, which produced the inconsistent
// block/allow behavior seen when the login rate limiter's Redis had issues.
app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Streaming (SSE) responses may already have written headers/chunks before failing internally;
  // those routes handle their own errors and don't reach here, but if headers are already sent,
  // Express requires delegating to the default handler instead of calling res.status(...) again.
  if (res.headersSent) {
    return next(err);
  }
  if (err?.isRateLimitStoreError) {
    return res.status(503).json({ error: "Service temporarily unavailable. Please try again in a moment." });
  }
  logger.error("Unhandled error", { message: err?.message, stack: err?.stack });
  res.status(500).json({ error: "Internal server error" });
});



const mongoUri = process.env.MONGODB_URI!;

const mongooseOptions = {
  connectTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 30000,
  heartbeatFrequencyMS: 10000,
  maxPoolSize: 10
};

mongoose.connect(mongoUri, mongooseOptions)
  .then(async () => {
    logger.info("MongoDB connected successfully");
    const { redisConnection } = require("./queue/connection");
    redisConnection.ping()
      .then(() => {
        logger.info("[Redis] Connection verified, starting workers");
        startWorker();
        startUserDocumentWorker();
      })
      .catch((err: any) => {
        logger.warn("[Redis] Not available, skipping background workers", { error: err.message });
      });
  })
  .catch((err) => {
    logger.error("MongoDB critical connection error", { 
      message: err.message,
      code: err.code,
      name: err.name
    });
  });

const port = parseInt(process.env.PORT || "4000", 10);

// Always listen in standalone/development mode
// Only skip listening if explicitly running as a mounted sub-app
if (process.env.NODE_ENV !== 'mounted' && !process.env.MOUNTED) {
  const host = process.env.HOST || "0.0.0.0";
  app.listen(port, host, () => {
    logger.info(`Nexa AI backend listening on ${host}:${port}`);
  });
}

// Export app for use as sub-app (e.g. Combined App)
export default app;

