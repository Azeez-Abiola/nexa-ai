"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADMIN_JWT_SECRET = exports.superAdminMiddleware = exports.adminAuthMiddleware = exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.NEXA_AI_JWT_SECRET || "your-secret-key-change-in-production";
const ADMIN_JWT_SECRET = process.env.NEXA_AI_ADMIN_JWT_SECRET ||
    process.env.NEXA_AI_JWT_SECRET;
exports.ADMIN_JWT_SECRET = ADMIN_JWT_SECRET;
const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
        return res.status(401).json({ error: "Authorization token required" });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        req.email = decoded.email;
        req.businessUnit = decoded.businessUnit;
        req.tenantId = decoded.tenantId;
        req.tenantSlug = decoded.tenantSlug;
        next();
    }
    catch (error) {
        res.status(401).json({ error: "Invalid or expired token" });
    }
};
exports.authMiddleware = authMiddleware;
const adminAuthMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
        return res.status(401).json({ error: "Admin authorization token required" });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, ADMIN_JWT_SECRET);
        if (!decoded.isAdmin) {
            return res.status(403).json({ error: "Admin access required" });
        }
        req.adminId = decoded.adminId;
        req.email = decoded.email;
        req.fullName = decoded.fullName;
        req.businessUnit = decoded.businessUnit;
        req.tenantId = decoded.tenantId;
        req.tenantSlug = decoded.tenantSlug;
        req.isAdmin = decoded.isAdmin;
        req.isSuperAdmin = decoded.businessUnit === "SUPERADMIN";
        next();
    }
    catch (error) {
        res.status(401).json({ error: "Invalid or expired admin token" });
    }
};
exports.adminAuthMiddleware = adminAuthMiddleware;
const superAdminMiddleware = (req, res, next) => {
    (0, exports.adminAuthMiddleware)(req, res, () => {
        if (!req.isSuperAdmin) {
            return res.status(403).json({ error: "Superadmin access required" });
        }
        next();
    });
};
exports.superAdminMiddleware = superAdminMiddleware;
