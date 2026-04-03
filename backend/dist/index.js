"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables FIRST, before any other imports
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const mongoose_1 = __importDefault(require("mongoose"));
const body_parser_1 = require("body-parser");
const path_1 = __importDefault(require("path"));
const chat_1 = require("./routes/chat");
const adminPolicies_1 = require("./routes/adminPolicies");
const auth_1 = require("./routes/auth");
const adminAuth_1 = require("./routes/adminAuth");
const conversation_1 = require("./routes/conversation");
const analytics_1 = require("./routes/analytics");
const provisioning_1 = require("./routes/provisioning");
const BusinessUnit_1 = require("./models/BusinessUnit");
const businessUnits_1 = require("./config/businessUnits");
const tenant_1 = require("./middleware/tenant");
const app = (0, express_1.default)();
// CORS configuration - allow all origins for flexibility across multiple deployments
app.use((0, cors_1.default)({
    origin: true, // Allow all origins
    credentials: true,
}));
app.use((0, body_parser_1.json)());
// Resolve tenant from subdomain on every request (e.g. ufl.nexa.ai → tenantId, businessUnit)
app.use(tenant_1.tenantMiddleware);
// Serve frontend static files from the built dist folder
// When compiled, __dirname is backend/dist — we need to go up two levels
// to reach the project root and then the frontend/dist folder.
const frontendDist = path_1.default.join(__dirname, '..', '..', 'frontend', 'dist');
const publicFolder = path_1.default.join(__dirname, '..', '..', 'public');
console.log(`Frontend dist path: ${frontendDist}`);
console.log(`Public folder path: ${publicFolder}`);
// Serve static files with proper MIME types
app.use('/assets', express_1.default.static(path_1.default.join(frontendDist, 'assets'), {
    maxAge: '1d',
    etag: false,
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        }
        else if (filePath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css; charset=utf-8');
        }
    }
}));
app.use(express_1.default.static(frontendDist));
app.use(express_1.default.static(publicFolder));
// Serve tenant logos
app.use('/logos', express_1.default.static(path_1.default.join(publicFolder, 'logos')));
// Frontend routes - serve index.html for SPA
const frontendIndex = path_1.default.join(frontendDist, 'index.html');
const cPanelFile = path_1.default.join(publicFolder, 'c-panel.html');
app.get('/', (_req, res) => res.sendFile(frontendIndex));
app.get('/index.html', (_req, res) => res.sendFile(frontendIndex));
// Super-admin control panel — canonical route
app.get('/super-admin', (_req, res) => res.sendFile(cPanelFile));
// Redirect old direct file access to the canonical route
app.get('/c-panel.html', (_req, res) => res.redirect(301, '/super-admin'));
app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
});
app.use("/api/v1/auth", auth_1.authRouter);
app.use("/api/v1/admin/auth", adminAuth_1.adminAuthRouter);
app.use("/api/v1/conversations", conversation_1.conversationRouter);
app.use("/api/v1/chat", chat_1.chatRouter);
app.use("/api/v1/admin/policies", adminPolicies_1.adminPoliciesRouter);
app.use("/api/v1/analytics", analytics_1.analyticsRouter);
app.use("/api/v1/provisioning", provisioning_1.provisioningRouter);
// Public endpoint for fetching business units (no auth required)
app.get("/api/v1/public/business-units", async (_req, res) => {
    try {
        // Fetch all business units from MongoDB
        const businessUnitsFromDB = await BusinessUnit_1.BusinessUnit.find().sort("name").lean();
        // Map to expected format
        const businessUnits = businessUnitsFromDB.map((bu) => ({
            value: bu.name,
            label: bu.label,
            name: bu.name
        }));
        res.json({ businessUnits });
    }
    catch (error) {
        console.error("Get BU list error:", error);
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
// Get business unit names only (for C-Panel sidebar)
app.get("/api/v1/public/business-unit-names", async (_req, res) => {
    try {
        const buses = await BusinessUnit_1.BusinessUnit.find().select("name");
        const names = buses.map(bu => bu.name);
        res.json({ names });
    }
    catch (error) {
        console.error("Get BU names error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// SPA fallback: serve index.html for any non-API GET path (enables client-side routes like /admin)
app.get('*', (req, res, next) => {
    if (req.method !== 'GET')
        return next();
    if (req.path.startsWith('/api/v1'))
        return next();
    if (req.path === '/super-admin')
        return next(); // handled above
    // Don't serve index.html for asset files
    if (req.path.startsWith('/assets') || req.path.includes('.'))
        return next();
    res.sendFile(frontendIndex);
});
// Only listen on a port if running as standalone (PORT env var set without being mounted)
const mongoUri = process.env.MONGODB_URI;
// Initialize default business units
const initializeDefaultBUs = async () => {
    try {
        const businessUnitData = (0, businessUnits_1.getUACNInfo)();
        const DEFAULT_BUS = businessUnitData.map(bu => ({
            name: bu.abbr,
            label: `${bu.fullName} (${bu.abbr})`,
            // Auto-generate slug from abbreviation: lowercase, replace spaces/underscores with hyphens
            slug: bu.abbr.toLowerCase().replace(/[^a-z0-9]/g, "-")
        }));
        // Insert any BUs that don't exist yet (upsert by name)
        for (const bu of DEFAULT_BUS) {
            await BusinessUnit_1.BusinessUnit.updateOne({ name: bu.name }, { $setOnInsert: bu }, { upsert: true });
        }
        // Backfill slug for any existing BUs that don't have one
        const busMissingSlug = await BusinessUnit_1.BusinessUnit.find({ slug: { $exists: false } });
        for (const bu of busMissingSlug) {
            bu.slug = bu.name.toLowerCase().replace(/[^a-z0-9]/g, "-");
            await bu.save();
        }
        console.log("Business units initialized");
    }
    catch (error) {
        console.error("Error initializing business units:", error);
    }
};
// Initialize MongoDB connection (will be used by both standalone and combined modes)
mongoose_1.default.connect(mongoUri)
    .then(async () => {
    console.log('MongoDB connected successfully');
    await initializeDefaultBUs();
})
    .catch((err) => {
    console.error("MongoDB connection error:", err);
});
const port = parseInt(process.env.PORT || "4000", 10);
// Always listen in standalone/development mode
// Only skip listening if explicitly running as a mounted sub-app
if (process.env.NODE_ENV !== 'mounted' && !process.env.MOUNTED) {
    const host = process.env.HOST || "0.0.0.0";
    app.listen(port, host, () => {
        console.log(`Nexa AI backend listening on ${host}:${port}`);
    });
}
// Export app for use as sub-app (e.g. Combined App)
exports.default = app;
