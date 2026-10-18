// The app icon (a slate pint in CAMRA amber), defined once as shapes and
// emitted both as SVG and as PNGs at the sizes launchers need. The PNGs are
// rasterised here with a tiny supersampling renderer and Node's zlib, so the
// build needs no image tooling and the icons can never drift from the SVG.

import { deflateSync } from "node:zlib";

const SLATE = "#41495a";
const AMBER = "#f9b13c";
const WHITE = "#ffffff";

const glass = [[196, 150], [316, 150], [298, 396], [214, 396]];
const beer = [[204, 188], [308, 188], [296, 392], [216, 392]];
const foam = [[218, 150, 30], [256, 138, 34], [294, 150, 30]];
// Mug handle: M316 196 q56 6 56 70 q0 64 -62 70 (two quadratic curves).
const handleCurves = [
  [[316, 196], [372, 202], [372, 266]],
  [[372, 266], [372, 330], [310, 336]],
];
const STROKE = 16;

export function iconSvg() {
  const pts = (p) => p.map(([x, y], i) => (i ? "L" : "M") + x + " " + y).join(" ") + " Z";
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">',
    "  <!-- Slate background (CAMRA primary). Full-bleed so it survives maskable cropping. -->",
    `  <rect width="512" height="512" fill="${SLATE}"/>`,
    "  <!-- Beer fill (amber), kept within the maskable safe zone. -->",
    `  <path d="${pts(beer)}" fill="${AMBER}"/>`,
    "  <!-- Glass outline. -->",
    `  <path d="${pts(glass)}" fill="none" stroke="${WHITE}" stroke-width="${STROKE}" stroke-linejoin="round" stroke-linecap="round"/>`,
    "  <!-- Mug handle. -->",
    `  <path d="M316 196 q56 6 56 70 q0 64 -62 70" fill="none" stroke="${WHITE}" stroke-width="${STROKE}" stroke-linecap="round"/>`,
    "  <!-- Foam head. -->",
    `  <g fill="${WHITE}">`,
    ...foam.map(([cx, cy, r]) => `    <circle cx="${cx}" cy="${cy}" r="${r}"/>`),
    "  </g>",
    "</svg>",
    "",
  ].join("\n");
}

function hex(c) {
  return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
}

function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function segDist2(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
  const x = ax + t * dx - px;
  const y = ay + t * dy - py;
  return x * x + y * y;
}

function flatten(curves, steps = 32) {
  const out = [];
  curves.forEach(([p0, c, p1], ci) => {
    for (let i = ci ? 1 : 0; i <= steps; i++) {
      const t = i / steps;
      const u = 1 - t;
      out.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]);
    }
  });
  return out;
}

const handle = flatten(handleCurves);
const glassClosed = glass.concat([glass[0]]);
const R2 = (STROKE / 2) * (STROKE / 2);

function nearPolyline(x, y, line) {
  for (let i = 0; i < line.length - 1; i++) {
    if (segDist2(x, y, line[i][0], line[i][1], line[i + 1][0], line[i + 1][1]) <= R2) return true;
  }
  return false;
}

// Colour of the topmost shape at a point in the 512 unit design space.
function colourAt(x, y) {
  for (const [cx, cy, r] of foam) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) return WHITE;
  if (x > 300 && x < 382 && y > 186 && y < 346 && nearPolyline(x, y, handle)) return WHITE;
  if (x > 186 && x < 326 && y > 140 && y < 406 && nearPolyline(x, y, glassClosed)) return WHITE;
  if (inPoly(x, y, beer)) return AMBER;
  return SLATE;
}

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** Renders the icon as an RGB PNG of the given square size. */
export function iconPng(size, samples = 4) {
  const cache = new Map();
  const rgb = (c) => {
    if (!cache.has(c)) cache.set(c, hex(c));
    return cache.get(c);
  };
  const raw = Buffer.alloc(size * (size * 3 + 1));
  const scale = 512 / size;
  const n = samples * samples;
  for (let py = 0; py < size; py++) {
    const row = py * (size * 3 + 1);
    raw[row] = 0;
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const c = rgb(colourAt((px + (sx + 0.5) / samples) * scale, (py + (sy + 0.5) / samples) * scale));
          r += c[0];
          g += c[1];
          b += c[2];
        }
      }
      const o = row + 1 + px * 3;
      raw[o] = Math.round(r / n);
      raw[o + 1] = Math.round(g / n);
      raw[o + 2] = Math.round(b / n);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

/** Every icon file the site ships, keyed by path relative to the site root. */
export function iconFiles() {
  return {
    "icon.svg": iconSvg(),
    "assets/icons/icon-192.png": iconPng(192),
    "assets/icons/icon-512.png": iconPng(512),
    // The pint already sits inside the centre 80% safe zone, so the maskable
    // icon is the same artwork.
    "assets/icons/icon-maskable-512.png": iconPng(512),
    "assets/icons/apple-touch-icon.png": iconPng(180),
  };
}
