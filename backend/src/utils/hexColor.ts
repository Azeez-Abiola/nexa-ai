/** Coerce to #rrggbb for storage and validation. */
export function normalizeHexToRrggbb(input: string | undefined | null): string {
  if (input == null || !String(input).trim()) return "#ed0000";
  let h = String(input).trim();
  if (!h.startsWith("#")) h = `#${h}`;
  let hex = h.slice(1).replace(/[^0-9a-fA-F]/g, "");
  if (hex.length === 0) return "#ed0000";
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (hex.length < 6) hex = (hex + "000000").slice(0, 6);
  if (hex.length > 6) hex = hex.slice(0, 6);
  return `#${hex.toLowerCase()}`;
}
