// Decorative silhouettes drawn with the current fillStyle, used as faint
// watermarks behind text-only posts. Each function signature is
// (ctx, cx, cy, size) and draws centred on (cx, cy).
// Shapes are built as single paths where possible, using the "evenodd" fill
// rule to punch holes (a mug handle, a pin hole, barrel hoops, calendar dates)
// so the icons stay readable at watermark alpha without needing a second colour.
import LUCIDE from "./data/lucide-icons.json" with { type: "json" };

type Ctx = CanvasRenderingContext2D;
/** Draws an icon centred on (cx, cy) at the given size, using the current fillStyle. */
export type IconFn = (ctx: Ctx, cx: number, cy: number, s: number) => void;

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
// Adds a rounded rectangle as a subpath without resetting the current path,
// so it can be punched out of a shape with the evenodd fill rule.
function rrSub(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
const TAU = Math.PI * 2;
export const ICONS: Record<string, IconFn> = {
  // A nonic pint: straight taper with the bulge ring near the rim.
  pint(ctx: Ctx, cx: number, cy: number, s: number): void {
    var h = s, top = s * 0.60, bot = s * 0.42;
    var t = cy - h / 2;
    ctx.beginPath();
    ctx.moveTo(cx - top / 2, t);
    ctx.lineTo(cx + top / 2, t);
    ctx.lineTo(cx + bot / 2, t + h);
    ctx.lineTo(cx - bot / 2, t + h);
    ctx.closePath();
    ctx.fill();
    var bw = top - (top - bot) * 0.30;
    ctx.beginPath();
    ctx.ellipse(cx, t + h * 0.30, bw / 2 + s * 0.035, s * 0.075, 0, 0, TAU);
    ctx.fill();
  },
  // A tankard: body with a foot and a ring handle with a visible hole.
  mug(ctx: Ctx, cx: number, cy: number, s: number): void {
    var w = s * 0.56, h = s * 0.90, bx = cx - s * 0.07;
    rr(ctx, bx - w / 2, cy - h / 2, w, h, s * 0.07);
    ctx.fill();
    rr(ctx, bx - w / 2 - s * 0.04, cy + h / 2 - s * 0.07, w + s * 0.08, s * 0.09, s * 0.03);
    ctx.fill();
    var hx = bx + w / 2 + s * 0.10, hy = cy - s * 0.04;
    ctx.beginPath();
    ctx.arc(hx, hy, s * 0.23, 0, TAU);
    ctx.arc(hx, hy, s * 0.12, 0, TAU);
    ctx.fill("evenodd");
  },
  // An apple: round body with a dimpled top, a stalk and a tilted leaf.
  apple(ctx: Ctx, cx: number, cy: number, s: number): void {
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.18);
    ctx.bezierCurveTo(cx + s * 0.08, cy - s * 0.34, cx + s * 0.40, cy - s * 0.30, cx + s * 0.36, cy + s * 0.02);
    ctx.bezierCurveTo(cx + s * 0.33, cy + s * 0.28, cx + s * 0.12, cy + s * 0.40, cx, cy + s * 0.36);
    ctx.bezierCurveTo(cx - s * 0.12, cy + s * 0.40, cx - s * 0.33, cy + s * 0.28, cx - s * 0.36, cy + s * 0.02);
    ctx.bezierCurveTo(cx - s * 0.40, cy - s * 0.30, cx - s * 0.08, cy - s * 0.34, cx, cy - s * 0.18);
    ctx.fill();
    ctx.fillRect(cx - s * 0.025, cy - s * 0.42, s * 0.05, s * 0.18);
    ctx.beginPath();
    ctx.ellipse(cx + s * 0.14, cy - s * 0.38, s * 0.11, s * 0.05, -0.6, 0, TAU);
    ctx.fill();
  },
  // A pear: narrow neck flowing into a wide round base, stalk and leaf.
  pear(ctx: Ctx, cx: number, cy: number, s: number): void {
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.42);
    ctx.bezierCurveTo(cx + s * 0.14, cy - s * 0.40, cx + s * 0.10, cy - s * 0.16, cx + s * 0.22, cy + s * 0.02);
    ctx.bezierCurveTo(cx + s * 0.36, cy + s * 0.18, cx + s * 0.30, cy + s * 0.44, cx, cy + s * 0.44);
    ctx.bezierCurveTo(cx - s * 0.30, cy + s * 0.44, cx - s * 0.36, cy + s * 0.18, cx - s * 0.22, cy + s * 0.02);
    ctx.bezierCurveTo(cx - s * 0.10, cy - s * 0.16, cx - s * 0.14, cy - s * 0.40, cx, cy - s * 0.42);
    ctx.fill();
    ctx.fillRect(cx - s * 0.02, cy - s * 0.54, s * 0.04, s * 0.14);
    ctx.beginPath();
    ctx.ellipse(cx + s * 0.10, cy - s * 0.51, s * 0.09, s * 0.04, -0.5, 0, TAU);
    ctx.fill();
  },
  // A hop cone: teardrop pointing down, with punched chevrons suggesting the
  // overlapping bracts, and a short stem.
  hops(ctx: Ctx, cx: number, cy: number, s: number): void {
    ctx.fillRect(cx - s * 0.02, cy - s * 0.46, s * 0.04, s * 0.14);
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.34);
    ctx.bezierCurveTo(cx + s * 0.32, cy - s * 0.34, cx + s * 0.30, cy + s * 0.04, cx, cy + s * 0.44);
    ctx.bezierCurveTo(cx - s * 0.30, cy + s * 0.04, cx - s * 0.32, cy - s * 0.34, cx, cy - s * 0.34);
    // Chevron slots, narrowing towards the tip.
    var rows = [[-0.13, 0.20], [0.03, 0.165], [0.19, 0.115]];
    for (var i = 0; i < rows.length; i++){
      var y = cy + rows[i][0] * s, w = rows[i][1] * s;
      var d = s * 0.09, th = s * 0.045;
      ctx.moveTo(cx - w, y);
      ctx.lineTo(cx, y + d);
      ctx.lineTo(cx + w, y);
      ctx.lineTo(cx + w, y + th);
      ctx.lineTo(cx, y + d + th);
      ctx.lineTo(cx - w, y + th);
      ctx.closePath();
    }
    ctx.fill("evenodd");
  },
  // A cask: sides bulging at the belly, with two punched hoop bands.
  barrel(ctx: Ctx, cx: number, cy: number, s: number): void {
    var w = s * 0.64, h = s * 0.96, b = s * 0.10;
    var x0 = cx - w / 2, x1 = cx + w / 2, t = cy - h / 2, btm = cy + h / 2;
    ctx.beginPath();
    ctx.moveTo(x0 + s * 0.04, t);
    ctx.lineTo(x1 - s * 0.04, t);
    ctx.quadraticCurveTo(x1 + b, cy, x1 - s * 0.04, btm);
    ctx.lineTo(x0 + s * 0.04, btm);
    ctx.quadraticCurveTo(x0 - b, cy, x0 + s * 0.04, t);
    ctx.closePath();
    ctx.rect(cx - s * 0.28, cy - s * 0.285, s * 0.56, s * 0.05);
    ctx.rect(cx - s * 0.28, cy + s * 0.235, s * 0.56, s * 0.05);
    ctx.fill("evenodd");
  },
  // A trophy: round-bottomed cup, ring handles, stem and stepped base.
  trophy(ctx: Ctx, cx: number, cy: number, s: number): void {
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.28, cy - s * 0.44);
    ctx.lineTo(cx + s * 0.28, cy - s * 0.44);
    ctx.bezierCurveTo(cx + s * 0.28, cy - s * 0.06, cx + s * 0.11, cy + s * 0.06, cx, cy + s * 0.06);
    ctx.bezierCurveTo(cx - s * 0.11, cy + s * 0.06, cx - s * 0.28, cy - s * 0.06, cx - s * 0.28, cy - s * 0.44);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = s * 0.05;
    ctx.strokeStyle = ctx.fillStyle;
    ctx.beginPath();
    ctx.arc(cx - s * 0.33, cy - s * 0.28, s * 0.10, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + s * 0.33, cy - s * 0.28, s * 0.10, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.045, cy + s * 0.06);
    ctx.lineTo(cx + s * 0.045, cy + s * 0.06);
    ctx.lineTo(cx + s * 0.09, cy + s * 0.28);
    ctx.lineTo(cx - s * 0.09, cy + s * 0.28);
    ctx.closePath();
    ctx.fill();
    rr(ctx, cx - s * 0.14, cy + s * 0.28, s * 0.28, s * 0.06, s * 0.02);
    ctx.fill();
    rr(ctx, cx - s * 0.20, cy + s * 0.34, s * 0.40, s * 0.10, s * 0.03);
    ctx.fill();
  },
  // A calendar: binder rings on top, a punched header line and a punched
  // grid of date squares.
  calendar(ctx: Ctx, cx: number, cy: number, s: number): void {
    var w = s * 0.78, h = s * 0.70;
    var x = cx - w / 2, y = cy - h / 2 + s * 0.04;
    ctx.fillRect(cx - w * 0.28 - s * 0.025, y - s * 0.10, s * 0.05, s * 0.14);
    ctx.fillRect(cx + w * 0.28 - s * 0.025, y - s * 0.10, s * 0.05, s * 0.14);
    ctx.beginPath();
    rrSub(ctx, x, y, w, h, s * 0.06);
    ctx.rect(x + s * 0.05, y + s * 0.155, w - s * 0.10, s * 0.035);
    for (var r = 0; r < 2; r++){
      for (var c = 0; c < 3; c++){
        ctx.rect(x + s * 0.10 + c * s * 0.21, y + s * 0.265 + r * s * 0.17, s * 0.085, s * 0.085);
      }
    }
    ctx.fill("evenodd");
  },
  // An ear of wheat: grains in opposite pairs tapering to a tip, on a stalk.
  wheat(ctx: Ctx, cx: number, cy: number, s: number): void {
    ctx.fillRect(cx - s * 0.018, cy - s * 0.20, s * 0.036, s * 0.66);
    ctx.beginPath();
    ctx.ellipse(cx, cy - s * 0.32, s * 0.045, s * 0.10, 0, 0, TAU);
    ctx.fill();
    for (var i = 0; i < 4; i++){
      var yy = cy - s * 0.20 + i * s * 0.105;
      var sc = 1 - i * 0.04;
      ctx.beginPath();
      ctx.ellipse(cx - s * 0.085, yy, s * 0.05 * sc, s * 0.105 * sc, -0.7, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + s * 0.085, yy, s * 0.05 * sc, s * 0.105 * sc, 0.7, 0, TAU);
      ctx.fill();
    }
  },
  // A map pin: teardrop with a round head, curving to a point, with a
  // punched hole.
  pin(ctx: Ctx, cx: number, cy: number, s: number): void {
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.12, s * 0.28, Math.PI * 0.80, Math.PI * 0.20);
    ctx.quadraticCurveTo(cx + s * 0.16, cy + s * 0.26, cx, cy + s * 0.46);
    ctx.quadraticCurveTo(cx - s * 0.16, cy + s * 0.26, cx - s * 0.28 * Math.cos(Math.PI * 0.20), cy - s * 0.12 + s * 0.28 * Math.sin(Math.PI * 0.20));
    ctx.closePath();
    ctx.arc(cx, cy - s * 0.12, s * 0.11, 0, TAU);
    ctx.fill("evenodd");
  }
};

// Line icons from Lucide (ISC licence, see THIRD_PARTY_NOTICES.md): 24x24
// stroke paths drawn with Path2D, in the same colour as the solid icons.
// Names that clash with a solid icon get an "-outline" suffix.
const SOLID_ICONS = ICONS;
const pathCache = new Map<string, Path2D[]>();
function lineIcon(name: string, paths: string[]): IconFn {
  return (ctx, cx, cy, s) => {
    if (typeof Path2D === "undefined") return;
    let p = pathCache.get(name);
    if (!p) {
      p = paths.map((d) => new Path2D(d));
      pathCache.set(name, p);
    }
    ctx.save();
    ctx.translate(cx - s / 2, cy - s / 2);
    ctx.scale(s / 24, s / 24);
    ctx.lineWidth = 1.75;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = ctx.fillStyle;
    p.forEach((path) => ctx.stroke(path));
    ctx.restore();
  };
}

export const LINE_ICONS: Record<string, IconFn> = {};
Object.entries(LUCIDE as Record<string, string[]>).forEach(([name, paths]) => {
  const id = SOLID_ICONS[name] ? name + "-outline" : name;
  LINE_ICONS[id] = lineIcon(id, paths);
});

/** Every decorative icon, solid first. */
export const ALL_ICONS: Record<string, IconFn> = { ...SOLID_ICONS, ...LINE_ICONS };
export const ICON_NAMES = Object.keys(ALL_ICONS);

export function iconLabel(id: string): string {
  const base = id.replace(/-outline$/, "").replace(/-/g, " ");
  return base.charAt(0).toUpperCase() + base.slice(1) + (SOLID_ICONS[id] ? " (solid)" : "");
}

/** Groups for the icon picker. Every icon appears in exactly one group. */
export const ICON_GROUPS: Array<{ label: string; icons: string[] }> = (() => {
  const groups: Array<{ label: string; icons: string[] }> = [
    { label: "Drinks", icons: ["pint", "mug", "hops", "barrel", "apple", "pear", "beer", "wine", "martini", "glass-water", "cup-soda", "milk", "hop", "apple-outline", "grape", "citrus", "beer-off"] },
    { label: "Events and fun", icons: ["calendar", "calendar-days", "clock", "ticket", "tent", "party-popper", "sparkles", "mic", "guitar", "dices", "puzzle", "target", "gift", "camera", "utensils"] },
    { label: "Places and travel", icons: ["pin", "map-pin", "map", "signpost", "bus", "train-front", "bike", "footprints", "store", "house", "factory", "landmark", "church", "castle"] },
    { label: "Awards", icons: ["trophy", "medal", "award", "star", "crown", "heart"] },
    { label: "People and campaigning", icons: ["users", "user-plus", "hand-heart", "handshake", "megaphone", "vote", "flag", "newspaper", "book-open", "key", "lightbulb", "piggy-bank", "badge-percent"] },
    { label: "Nature and seasons", icons: ["wheat", "wheat-outline", "leaf", "trees", "sun", "snowflake"] },
  ];
  const placed = new Set(groups.flatMap((g) => g.icons));
  groups.forEach((g) => (g.icons = g.icons.filter((i) => ALL_ICONS[i])));
  const rest = ICON_NAMES.filter((i) => !placed.has(i));
  if (rest.length) groups.push({ label: "More", icons: rest });
  return groups;
})();
