import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthenticatedRequest extends Request {
  userId?: string;
  email?: string;
  businessUnit?: string;
  grade?: string;
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

export const authMiddleware = (
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
    req.userId = decoded.userId;
    req.email = decoded.email;
    req.businessUnit = decoded.businessUnit;
    req.grade = decoded.grade;
    req.tenantId = decoded.tenantId;
    req.tenantSlug = decoded.tenantSlug;
    req.tenantName = decoded.tenantName;
    req.isAdmin = !!decoded.isAdmin;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

export const adminAuthMiddleware = (
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

    req.adminId = (decoded.adminId || decoded.userId)?.toString();
    req.email = decoded.email;
    req.fullName = decoded.fullName;
    req.businessUnit = decoded.businessUnit;
    req.tenantId = decoded.tenantId;
    req.tenantSlug = decoded.tenantSlug;
    req.tenantName = decoded.tenantName;
    req.isAdmin = decoded.isAdmin;
    req.isSuperAdmin = decoded.businessUnit === "SUPERADMIN";
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
