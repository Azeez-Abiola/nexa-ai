import { BusinessUnit as BusinessUnitModel } from "../models/BusinessUnit";
import type { AuthenticatedRequest } from "../middleware/auth";

export function sanitizeTenantSlug(slug: string): string {
  return slug
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function escapeBuRegexFragment(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Map a name, label, or slug string to canonical BusinessUnit.name (User / KnowledgeGroup scope).
 */
export async function resolveCanonicalNameFromScopedString(scoped: string): Promise<string | null> {
  const s = scoped.trim();
  if (!s || s === "SUPERADMIN") return null;
  const slug = sanitizeTenantSlug(s);
  if (slug) {
    const bySlug = await BusinessUnitModel.findOne({ slug }).select("name").lean();
    if (bySlug?.name) return String(bySlug.name);
  }
  const byName = await BusinessUnitModel.findOne({
    name: { $regex: new RegExp(`^${escapeBuRegexFragment(s)}$`, "i") }
  })
    .select("name")
    .lean();
  if (byName?.name) return String(byName.name);
  const byLabel = await BusinessUnitModel.findOne({
    label: { $regex: new RegExp(`^${escapeBuRegexFragment(s)}$`, "i") }
  })
    .select("name")
    .lean();
  if (byLabel?.name) return String(byLabel.name);
  return s;
}

/**
 * Resolve tenant document for profile / directory (JWT + optional slug from form or query).
 */
export async function resolveBusinessUnitDocumentForProfile(
  req: Pick<AuthenticatedRequest, "tenantId" | "tenantSlug" | "businessUnit">,
  formSlug?: string
) {
  const { tenantId, tenantSlug, businessUnit } = req;

  if (tenantId && String(tenantId).trim()) {
    const d = await BusinessUnitModel.findOne({ tenantId: String(tenantId).trim() });
    if (d) return d;
  }
  if (tenantSlug && String(tenantSlug).trim()) {
    const s = sanitizeTenantSlug(String(tenantSlug));
    if (s) {
      const d = await BusinessUnitModel.findOne({ slug: s });
      if (d) return d;
    }
  }
  if (businessUnit && businessUnit !== "SUPERADMIN") {
    const asSlug = sanitizeTenantSlug(businessUnit);
    if (asSlug) {
      const d = await BusinessUnitModel.findOne({ slug: asSlug });
      if (d) return d;
    }
    const d = await BusinessUnitModel.findOne({
      name: { $regex: new RegExp(`^${escapeBuRegexFragment(businessUnit)}$`, "i") }
    });
    if (d) return d;
  }
  if (formSlug && String(formSlug).trim()) {
    const fs = sanitizeTenantSlug(String(formSlug));
    if (fs) {
      const d = await BusinessUnitModel.findOne({ slug: fs });
      if (d) return d;
    }
  }
  if (businessUnit && businessUnit !== "SUPERADMIN") {
    const byLabel = await BusinessUnitModel.findOne({
      label: { $regex: new RegExp(`^${escapeBuRegexFragment(businessUnit)}$`, "i") }
    });
    if (byLabel) return byLabel;
  }
  return null;
}

/**
 * Canonical BU name for user directory / knowledge groups / analytics filters.
 */
export async function resolveUserDirectoryBusinessUnit(
  req: AuthenticatedRequest,
  queryBusinessUnit?: string | undefined
): Promise<string | null> {
  const q = (queryBusinessUnit || "").trim();
  if (req.isSuperAdmin) {
    if (!q || q === "SUPERADMIN") return null;
    return resolveCanonicalNameFromScopedString(q);
  }
  const jwtName = (req.tenantName || "").trim();
  if (jwtName) return jwtName;
  const doc = await resolveBusinessUnitDocumentForProfile(req, q || undefined);
  if (doc?.name) return doc.name;
  const tokenBU = (req.businessUnit || "").trim();
  if (!tokenBU || tokenBU === "SUPERADMIN") return null;
  return resolveCanonicalNameFromScopedString(tokenBU);
}
