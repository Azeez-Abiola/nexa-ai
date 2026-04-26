import dotenv from "dotenv";

// Load environment variables FIRST, before any other imports
dotenv.config();

import express from "express";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger";
import cors from "cors";
import mongoose from "mongoose";
import { json } from "body-parser";
import path from "path";
import { chatRouter } from "./routes/chat";
import { adminPoliciesRouter } from "./routes/adminPolicies";
import { authRouter } from "./routes/auth";
import { adminAuthRouter } from "./routes/adminAuth";
import { conversationRouter } from "./routes/conversation";
import { conversationSharingRouter } from "./routes/conversationSharing";
import { analyticsRouter } from "./routes/analytics";
import { provisioningRouter } from "./routes/provisioning";
import { employeeInviteRouter } from "./routes/employeeInvite";
import { adminDocumentsRouter } from "./routes/adminDocuments";
import { adminKnowledgeGroupsRouter } from "./routes/adminKnowledgeGroups";
import { adminAuditLogsRouter } from "./routes/adminAuditLogs";
import { BusinessUnit } from "./models/BusinessUnit";
import { tenantMiddleware } from "./middleware/tenant";
import logger from "./utils/logger";
import { sendContactFormInquiry, sendAccessRequestNotification, sendAccessRequestReceived } from "./services/emailService";
import { TenantRequest } from "./models/TenantRequest";
import { startWorker } from "./queue/documentWorker";
import { startUserDocumentWorker } from "./queue/userDocumentWorker";
import { userDocumentsRouter } from "./routes/userDocuments";
import { documentGenerationRouter } from "./routes/documentGeneration";

const app = express();

// CORS configuration - allow all origins for flexibility across multiple deployments
app.use(
  cors({
    origin: true, // Allow all origins
    credentials: true,
  })
);
app.use(json());

// Resolve tenant from subdomain on every request (e.g. ufl.nexa.ai → tenantId, businessUnit)
app.use(tenantMiddleware);

// Serve frontend static files from the built dist folder
// When compiled, __dirname is backend/dist — we need to go up two levels
// to reach the project root and then the frontend/dist folder.
const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
const publicFolder = path.join(__dirname, '..', '..', 'public');

logger.info(`Frontend dist path: ${frontendDist}`);
logger.info(`Public folder path: ${publicFolder}`);

// Serve static files with proper MIME types
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

// Serve tenant logos
app.use('/logos', express.static(path.join(publicFolder, 'logos')));

// Frontend routes - serve index.html for SPA
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

// ─── Swagger API Docs ─────────────────────────────────────────────────────────
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: "Nexa AI API Docs",
  swaggerOptions: { persistAuthorization: true }
}));
app.get("/api/docs.json", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/admin/auth", adminAuthRouter);
app.use("/api/v1/conversations", conversationRouter);
app.use("/api/v1/conversations", conversationSharingRouter);
app.use("/api/v1/conversations", userDocumentsRouter);
app.use("/api/v1/chat", chatRouter);
app.use("/api/v1/admin/policies", adminPoliciesRouter);
app.use("/api/v1/admin/documents", adminDocumentsRouter);
app.use("/api/v1/admin/user-groups", adminKnowledgeGroupsRouter);
app.use("/api/v1/admin/knowledge-groups", adminKnowledgeGroupsRouter); // legacy alias
app.use("/api/v1/admin/audit-logs", adminAuditLogsRouter);
app.use("/api/v1/analytics", analyticsRouter);
app.use("/api/v1/provisioning", provisioningRouter);
app.use("/api/v1/employee-invite", employeeInviteRouter);
app.use("/api/v1", documentGenerationRouter);

// Public endpoint for fetching business units (no auth required)
app.get("/api/v1/public/business-units", async (_req, res) => {
  try {
    // Fetch all business units from MongoDB
    const businessUnitsFromDB = await BusinessUnit.find().sort("name").lean();
    
    // Map to expected format
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

// Public contact form (landing page)
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

// Public endpoint: business access request (no account created — super-admin reviews and provisions)
app.post("/api/v1/public/request-access", async (req, res) => {
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

    const request = await TenantRequest.create({
      companyName: String(companyName).trim(),
      workEmail: normalizedEmail,
      phone: String(phone).trim(),
      employeeCount: count
    });

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

    res.status(201).json({ message: "Request submitted successfully. We'll be in touch." });
  } catch (error) {
    logger.error("Request access error", { error });
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get business unit names only (for C-Panel sidebar)
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
  // Don't serve index.html for asset files
  if (req.path.startsWith('/assets') || req.path.includes('.')) return next();
  res.sendFile(frontendIndex);
});



// Only listen on a port if running as standalone (PORT env var set without being mounted)
const mongoUri = process.env.MONGODB_URI!;


// Initialize MongoDB connection options for better resilience
const mongooseOptions = {
  connectTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  serverSelectionTimeoutMS: 30000,
  heartbeatFrequencyMS: 10000,
  maxPoolSize: 10
};

// Initialize MongoDB connection
mongoose.connect(mongoUri, mongooseOptions)
  .then(async () => {
    logger.info("MongoDB connected successfully");
    // Check Redis availability before starting workers
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

