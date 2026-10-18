// Colour helpers shared by the renderer and the brand guidance.

export interface Rgb { r: number; g: number; b: number }

export function hexToRgb(hex: string | null | undefined): Rgb | null {
  let h = String(hex == null ? "" : hex).trim().replace(/^#/, "");
  if (h.length === 3) h = h.replace(/(.)/g, "$1$1");
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return null;
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

/** WCAG relative luminance, or null for anything that is not a hex colour. */
export function relativeLuminance(hex: string): number | null {
  const c = hexToRgb(hex);
  if (!c) return null;
  const a = [c.r, c.g, c.b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

/** WCAG contrast ratio between two hex colours, or null if either is invalid. */
export function contrastRatio(c1: string, c2: string): number | null {
  const l1 = relativeLuminance(c1);
  const l2 = relativeLuminance(c2);
  if (l1 == null || l2 == null) return null;
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Lightens (positive amt) or darkens (negative amt) a 6-digit hex colour by a
 * 0 to 1 fraction. Non-hex values are returned unchanged.
 */
export function shade(hex: string, amt: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const ch = (v: number): number => {
    const out = amt >= 0 ? v + (255 - v) * amt : v * (1 + amt);
    return Math.max(0, Math.min(255, Math.round(out)));
  };
  return "rgb(" + ch(r) + "," + ch(g) + "," + ch(b) + ")";
}

export function isHexColour(v: string | null | undefined): boolean {
  return /^#[0-9a-f]{6}$/i.test(String(v || ""));
}
