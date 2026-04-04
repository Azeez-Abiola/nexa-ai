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
import { adminDocumentsRouter } from "./routes/adminDocuments";
import { adminAuditLogsRouter } from "./routes/adminAuditLogs";
import { BusinessUnit } from "./models/BusinessUnit";
import { EMPLOYEE_GRADES } from "./models/User";
import { getUACNInfo, formatBusinessUnit } from "./config/businessUnits";
import { tenantMiddleware } from "./middleware/tenant";
import logger from "./utils/logger";
import { startWorker } from "./queue/documentWorker";

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

// Super-admin control panel — canonical route
app.get('/super-admin', (_req, res) => res.sendFile(cPanelFile));
// Redirect old direct file access to the canonical route
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
app.use("/api/v1/chat", chatRouter);
app.use("/api/v1/admin/policies", adminPoliciesRouter);
app.use("/api/v1/admin/documents", adminDocumentsRouter);
app.use("/api/v1/admin/audit-logs", adminAuditLogsRouter);
app.use("/api/v1/analytics", analyticsRouter);
app.use("/api/v1/provisioning", provisioningRouter);

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
    // Fallback to default business units if MongoDB fetch fails
    const fallbackUnits = [
      { value: "GCL", label: "Grand Cereals Limited (GCL)", name: "GCL" },
      { value: "LSF", label: "Livestocks Feeds PLC (LSF)", name: "LSF" },
      { value: "CAP", label: "Chemical and Allied Products PLC (CAP)", name: "CAP" },
      { value: "UFL", label: "UAC Foods Limited (UFL)", name: "UFL" },
      { value: "CHI", label: "Chivita|Hollandia Limited (CHI)", name: "CHI" },
      { value: "UAC-Restaurants", label: "UAC Restaurants (UAC-Restaurants)", name: "UAC-Restaurants" },
      { value: "UPDC", label: "UPDC (UPDC)", name: "UPDC" }
    ];
    res.json({ businessUnits: fallbackUnits });
  }
});

// Public endpoint: employee grades for registration form
// Returns the real grades only — "ALL" is a document access-control value, not an employee grade
app.get("/api/v1/public/grades", (_req, res) => {
  res.json({ grades: EMPLOYEE_GRADES });
});

// Get business unit names only (for C-Panel sidebar)
app.get("/api/v1/public/business-unit-names", async (_req, res) => {
  try {
    const buses = await BusinessUnit.find().select("name");
    const names = buses.map(bu => bu.name);
    res.json({ names });
  } catch (error) {
    logger.error("Get BU names error", { error });
    res.status(500).json({ error: "Internal server error" });
  }
});

// SPA fallback: serve index.html for any non-API GET path (enables client-side routes like /admin)
app.get('*', (req, res, next) => {
  if (req.method !== 'GET') return next();
  if (req.path.startsWith('/api/')) return next();
  if (req.path === '/super-admin') return next(); // handled above
  // Don't serve index.html for asset files
  if (req.path.startsWith('/assets') || req.path.includes('.')) return next();
  res.sendFile(frontendIndex);
});



// Only listen on a port if running as standalone (PORT env var set without being mounted)
const mongoUri = process.env.MONGODB_URI!;

// Initialize default business units
const initializeDefaultBUs = async () => {
  try {
    const businessUnitData = getUACNInfo();
    const DEFAULT_BUS = businessUnitData.map(bu => ({
      name: bu.abbr,
      label: `${bu.fullName} (${bu.abbr})`,
      // Auto-generate slug from abbreviation: lowercase, replace spaces/underscores with hyphens
      slug: bu.abbr.toLowerCase().replace(/[^a-z0-9]/g, "-")
    }));

    // Insert any BUs that don't exist yet (upsert by name)
    for (const bu of DEFAULT_BUS) {
      await BusinessUnit.updateOne(
        { name: bu.name },
        { $setOnInsert: bu },
        { upsert: true }
      );
    }

    // Backfill slug for any existing BUs that don't have one
    const busMissingSlug = await BusinessUnit.find({ slug: { $exists: false } });
    for (const bu of busMissingSlug) {
      bu.slug = bu.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
      await bu.save();
    }

    logger.info("Business units initialized");
  } catch (error) {
    logger.error("Error initializing business units", { error });
  }
};

// Initialize MongoDB connection (will be used by both standalone and combined modes)
mongoose.connect(mongoUri)
  .then(async () => {
    logger.info("MongoDB connected successfully");
    await initializeDefaultBUs();
    startWorker();
  })
  .catch((err) => {
    logger.error("MongoDB connection error", { error: err.message });
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

