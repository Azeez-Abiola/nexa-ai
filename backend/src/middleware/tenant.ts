import { Request, Response, NextFunction } from "express";
import { BusinessUnit } from "../models/BusinessUnit";

export interface TenantRequest extends Request {
  tenantId?: string;
  tenantSlug?: string;
  businessUnit?: string;
}

/**
 * Resolves the tenant from the subdomain (Host header).
 * e.g. ufl.nexa.ai → slug "ufl" → looks up BusinessUnit → injects tenantId + businessUnit
 *
 * Falls back gracefully if no subdomain is present (landing page, super-admin, etc.)
 */
export const tenantMiddleware = async (
  req: TenantRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const host = req.hostname; // e.g. "ufl.nexa.ai" or "localhost"

    // Extract subdomain — everything before the first dot
    const parts = host.split(".");
    const isLocalhost = host === "localhost" || host === "127.0.0.1";
    const hasSubdomain = !isLocalhost && parts.length > 2;

    if (!hasSubdomain) {
      // No subdomain — root domain or localhost, no tenant context
      return next();
    }

    const slug = parts[0].toLowerCase();

    // Skip non-tenant subdomains and hosting platform domains
    if (["www", "api", "mail", "super-admin"].includes(slug)) {
      return next();
    }
    if (host.endsWith(".railway.app") || host.endsWith(".vercel.app") || host.endsWith(".up.railway.app")) {
      return next();
    }

    const tenant = await BusinessUnit.findOne({ slug, isActive: true }).lean();

    if (!tenant) {
      return res.status(404).json({ error: `Tenant "${slug}" not found or inactive` });
    }

    req.tenantId = tenant.tenantId;
    req.tenantSlug = tenant.slug;
    req.businessUnit = tenant.name;

    next();
  } catch (error) {
    console.error("[Tenant] Resolution error:", error);
    next(); // don't block the request on tenant resolution failure
  }
};

/**
 * Middleware that requires a resolved tenant.
 * Use on routes that must be scoped to a tenant subdomain.
 */
export const requireTenant = (
  req: TenantRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.tenantId) {
    return res.status(400).json({
      error: "This endpoint must be accessed via a tenant subdomain (e.g. ufl.nexa.ai)"
    });
  }
  next();
};
