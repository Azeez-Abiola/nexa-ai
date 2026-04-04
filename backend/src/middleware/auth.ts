import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthenticatedRequest extends Request {
  userId?: string;
  email?: string;
  businessUnit?: string;
  grade?: string;
  tenantId?: string;
  tenantSlug?: string;
  adminId?: string;
  fullName?: string;
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
    const decoded = jwt.verify(token, ADMIN_JWT_SECRET!) as any;

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
  } catch (error: any) {
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
