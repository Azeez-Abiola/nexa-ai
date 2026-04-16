/**
 * Coerce user input to #rrggbb (required by `<input type="color">` and our CSS).
 * Pads short fragments (e.g. #ed00 → #ed0000) instead of leaving invalid hex.
 */
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

/** Tailwind/shadcn theme tokens expect "H S% L%" (no hsl() wrapper). */
export function hexToHslSpace(hex: string): string {
  const m = normalizeHexToRrggbb(hex).match(/^#([0-9a-f]{6})$/i);
  if (!m) return "0 100% 46%";

  const n = parseInt(m[1]!, 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export const DEFAULT_RING_HSL = "0 100% 46%";
