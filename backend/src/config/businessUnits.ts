import { BusinessUnit } from "../models/BusinessUnit";

/**
 * Resolves a business unit's display label from the DB.
 * Falls back to the raw identifier if no record is found.
 */
export async function getBusinessUnitLabel(identifier: string): Promise<string> {
  if (!identifier) return identifier;
  const bu = await BusinessUnit.findOne({
    $or: [{ name: identifier }, { slug: identifier.toLowerCase() }]
  }).lean();
  return bu?.label || identifier;
}

/**
 * Returns all active business units from the DB (name + label).
 */
export async function getAllBusinessUnits(): Promise<{ name: string; label: string }[]> {
  return BusinessUnit.find({ isActive: true }).sort("name").select("name label").lean();
}

/**
 * Checks whether an identifier resolves to a known business unit in the DB.
 */
export async function isValidBusinessUnit(identifier: string): Promise<boolean> {
  if (!identifier) return false;
  const count = await BusinessUnit.countDocuments({
    $or: [{ name: identifier }, { slug: identifier.toLowerCase() }]
  });
  return count > 0;
}
