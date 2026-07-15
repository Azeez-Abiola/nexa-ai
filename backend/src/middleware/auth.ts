import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User";
import { AdminUser } from "../models/AdminUser";

export interface AuthenticatedRequest extends Request {
  userId?: string;
  email?: string;
  businessUnit?: string;
  department?: string;
  tenantId?: string;
  tenantSlug?: string;
  /** Canonical BusinessUnit.name from JWT (BU admins). */
  tenantName?: string;
  adminId?: string;
  fullName?: string;
  /** Set from JWT for unified auth (employee vs admin). */
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
}

  const JWT_SECRET = process.env.NEXA_AI_JWT_SECRET!;
  const ADMIN_JWT_SECRET = process.env.NEXA_AI_JWT_SECRET

export const authMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Authorization token required" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // Reject tokens issued before the account's last logout/password change.
    const id = (decoded.adminId || decoded.userId)?.toString();
    const account = decoded.isAdmin
      ? await AdminUser.findById(id).select("tokenVersion")
      : await User.findById(id).select("tokenVersion");
    if (!account || (account.tokenVersion || 0) !== (decoded.tokenVersion || 0)) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    // Trim BU values in case an old JWT carries legacy trailing-space drift — downstream queries
    // exact-match on these and silently return empty if the JWT value doesn't match the cleaned DB.
    req.businessUnit = typeof decoded.businessUnit === "string" ? decoded.businessUnit.trim() : decoded.businessUnit;
    req.tenantId = decoded.tenantId;
    req.tenantSlug = decoded.tenantSlug;
    req.tenantName = typeof decoded.tenantName === "string" ? decoded.tenantName.trim() : decoded.tenantName;
    req.email = decoded.email;
    req.isAdmin = !!decoded.isAdmin;

    if (decoded.isAdmin) {
      // Admin token used on a chat/employee route — allow access, treat adminId as userId
      // so all downstream conversation storage and retrieval works unchanged.
      req.adminId = id;
      req.userId = id;
      req.fullName = decoded.fullName;
    } else {
      req.userId = decoded.userId;
      req.department = decoded.department;
    }
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

export const adminAuthMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Admin authorization token required" });
  }

  try {
    const secret = process.env.NEXA_AI_JWT_SECRET;
    if (!secret) {
      console.error("CRITICAL: NEXA_AI_JWT_SECRET is not defined in environment variables");
      return res.status(500).json({ error: "Server configuration error" });
    }

    const decoded = jwt.verify(token, secret) as any;

    if (!decoded.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    // Reject tokens issued before the account's last logout/password change.
    const adminId = (decoded.adminId || decoded.userId)?.toString();
    const admin = await AdminUser.findById(adminId).select("tokenVersion");
    if (!admin || (admin.tokenVersion || 0) !== (decoded.tokenVersion || 0)) {
      return res.status(401).json({ error: "Invalid or expired admin token" });
    }

    req.adminId = adminId;
    req.email = decoded.email;
    req.fullName = decoded.fullName;
    // Trim BU so legacy tokens (signed before the DB was cleaned) still match exact-eq queries.
    req.businessUnit = typeof decoded.businessUnit === "string" ? decoded.businessUnit.trim() : decoded.businessUnit;
    req.tenantId = decoded.tenantId;
    req.tenantSlug = decoded.tenantSlug;
    req.tenantName = typeof decoded.tenantName === "string" ? decoded.tenantName.trim() : decoded.tenantName;
    req.isAdmin = decoded.isAdmin;
    req.isSuperAdmin = (decoded.businessUnit || "").trim() === "SUPERADMIN";
    next();
  } catch (error: any) {
    console.error("Admin token verification failed:", error.message);
    res.status(401).json({ error: "Invalid or expired admin token" });
  }
};

export const superAdminMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  adminAuthMiddleware(req, res, () => {
    if (!req.isSuperAdmin) {
      return res.status(403).json({ error: "Superadmin access required" });
    }
    next();
  });
};

export { ADMIN_JWT_SECRET };
