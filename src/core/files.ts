// File naming and data URL helpers shared by export and backup.

export function slug(s: string): string {
  return (
    String(s || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "graphic"
  );
}

/** type-preset-WxH.png, matching the names the studio has always used. */
export function pngName(typeId: string, presetId: string, w: number, h: number): string {
  return typeId + "-" + presetId + "-" + w + "x" + h + ".png";
}

export function isoDate(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}

export function dataUrlToBytes(url: string): { mime: string; bytes: Uint8Array } {
  const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(url);
  if (!m) throw new Error("Not a data URL.");
  const mime = m[1] || "application/octet-stream";
  if (m[2]) {
    const bin = atob(m[3]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { mime, bytes };
  }
  return { mime, bytes: new TextEncoder().encode(decodeURIComponent(m[3])) };
}

export function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return "data:" + mime + ";base64," + btoa(bin);
}

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg" };
const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml" };

export function extForMime(mime: string): string {
  return EXT[mime] || "bin";
}

export function mimeForName(name: string): string {
  const ext = (name.split(".").pop() || "").toLowerCase();
  return MIME[ext] || "application/octet-stream";
}
