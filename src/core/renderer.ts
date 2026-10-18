// Draws one social graphic at any width and height from a layout model.
// Everything scales from k = min(width, height) / 1080 so the same design works
// for square, portrait, story and landscape sizes.
import { CONFIG, PALETTE, type Branch } from "./config.ts";
import { shade } from "./colour.ts";
import { ALL_ICONS } from "./icons.ts";
import type { Layout, ListItem, Template, Values } from "./templates.ts";

type Ctx = CanvasRenderingContext2D;
/** Anything drawable with a width and height: an image, bitmap or canvas. */
export type Img = CanvasImageSource & { width: number; height: number };

export interface Frame {
  fit?: "cover" | "contain" | "fill" | string;
  offsetX?: number;
  offsetY?: number;
  zoom?: number;
  opacity?: number;
}

export interface TextColours {
  title?: string | null;
  subtitle?: string | null;
  body?: string | null;
  caption?: string | null;
}

export interface TextAligns {
  title?: string;
  subtitle?: string;
  body?: string;
  caption?: string;
}

export interface LogoChoice {
  branch: boolean;
  camra: boolean;
}

export interface DrawInfo {
  clamped: boolean;
}

interface CornerPanel {
  w: number;
  h: number;
  pad: number;
  lh: number;
  logoW: number;
  sweepW: number;
  sweepH: number;
}

interface FooterOptions {
  campaign?: boolean;
  showBranchOnCampaign?: boolean;
  tagline?: string;
  logoScale?: number;
  logos?: string;
  logoAlign?: string;
  taglineAlign?: string;
  slateBand?: boolean;
}

/** Everything the renderer needs for one frame. */
export interface RenderOptions {
  ctx: Ctx;
  width: number;
  height: number;
  template: Template;
  layout?: Layout;
  values?: Values;
  branch: Branch;
  photoImg?: Img | null;
  branchLogoImg?: Img | null;
  camraLogoImg?: Img | null;
  iconName?: string;
  iconStyle?: IconStyle;
  /** Replaces the branch logo slot with a region or sub-brand logo. */
  altLogo?: { img: Img | null | undefined; text: string } | null;
  frame?: Frame;
  showBranchOnCampaign?: boolean;
  tagline?: string | null;
  frameMode?: string;
  showLabel?: boolean;
  showText?: boolean;
  showCaption?: boolean;
  captionText?: string | null;
  pad?: number;
  bgColor?: string;
  bgStyle?: string;
  textColors?: TextColours;
  logoScale?: number;
  logos?: string;
  logoAlign?: string;
  textAligns?: TextAligns;
  taglineAlign?: string;
  fbStyle?: string;
}


const P: Record<string, string> = PALETTE;
const FAMILY = "Arboria, Arial, sans-serif";

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fit(ctx: Ctx, text: string, weight: string, start: number, min: number, maxW: number): number {
  var s = start;
  ctx.font = weight + " " + s + "px " + FAMILY;
  while (s > min && ctx.measureText(text).width > maxW){
    s -= 2;
    ctx.font = weight + " " + s + "px " + FAMILY;
  }
  return s;
}

function wrap(ctx: Ctx, text: string, maxW: number): string[] {
  var words = String(text).split(/\s+/), lines: string[] = [], line = "";
  for (var i = 0; i < words.length; i++){
    var t = line ? line + " " + words[i] : words[i];
    if (ctx.measureText(t).width > maxW && line){ lines.push(line); line = words[i]; }
    else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

// Places an image inside a box with a chosen fit, optional pan / zoom and
// optional opacity.
// fit: "cover" (crop to fill), "contain" (whole image, letterboxed), "fill" (stretch).
// offsetX / offsetY range from -1 to 1; zoom is a multiplier from 1 up.
// opacity blends the image into whatever is painted behind it (usually the
// background colour): 1 is fully opaque (the default), 0 fully transparent.
function placeImage(ctx: Ctx, img: Img, x: number, y: number, w: number, h: number, frame?: Frame): void {
  frame = frame || {};
  var fitMode = frame.fit || "cover";
  // A range check rather than || so a legitimate opacity of 0 is honoured.
  var alpha = frame.opacity != null && frame.opacity >= 0 && frame.opacity < 1 ? frame.opacity : 1;
  var prevAlpha = ctx.globalAlpha;
  ctx.globalAlpha = prevAlpha * alpha;
  if (fitMode === "fill"){
    ctx.drawImage(img, x, y, w, h);
  } else {
    var zoom = (frame.zoom || 0) > 0 ? (frame.zoom as number) : 1;
    var ox = frame.offsetX || 0, oy = frame.offsetY || 0;
    var base = fitMode === "contain"
      ? Math.min(w / img.width, h / img.height)
      : Math.max(w / img.width, h / img.height);
    var s = base * zoom;
    var dw = img.width * s, dh = img.height * s;
    var dx = x + (w - dw) / 2 - ox * (dw - w) / 2;
    var dy = y + (h - dh) / 2 - oy * (dh - h) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
  }
  ctx.globalAlpha = prevAlpha;
}

function logoOrText(ctx: Ctx, img: Img | null | undefined, text: string, x: number, y: number, boxW: number, boxH: number, align: string, k: number): void {
  if (img){
    var s = Math.min(boxW / img.width, boxH / img.height);
    var w = img.width * s, h = img.height * s;
    var dx = align === "right" ? x + (boxW - w) : (align === "center" ? x + (boxW - w) / 2 : x);
    ctx.drawImage(img, dx, y + (boxH - h) / 2, w, h);
  } else {
    ctx.fillStyle = "#ffffff";
    var fs = fit(ctx, text, "700", Math.round(30 * k), Math.round(15 * k), boxW);
    ctx.font = "700 " + fs + "px " + FAMILY;
    ctx.textAlign = align === "right" ? "right" : (align === "center" ? "center" : "left");
    ctx.textBaseline = "middle";
    ctx.fillText(text, align === "right" ? x + boxW : (align === "center" ? x + boxW / 2 : x), y + boxH / 2);
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
  }
}

function eyebrow(ctx: Ctx, text: string, accent: string, x: number, y: number, k: number): number {
  text = (text || "").toUpperCase();
  var fs = Math.round(40 * k);
  ctx.font = "700 " + fs + "px " + FAMILY;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  var padX = Math.round(26 * k), h = Math.round(78 * k);
  var w = ctx.measureText(text).width + padX * 2;
  ctx.fillStyle = accent;
  rr(ctx, x, y, w, h, Math.round(10 * k));
  ctx.fill();
  // Slate text on the accent, as always; white on Lilac, where slate is unreadable.
  ctx.fillStyle = accent.toLowerCase() === P.lilac ? "#ffffff" : P.slate;
  ctx.fillText(text, x + padX, y + h * 0.68);
  return h;
}

export interface IconStyle {
  /** top-right (default), top-left, center, bottom-left or pattern. */
  position?: string;
  /** Size multiplier, 1 by default. */
  size?: number;
  /** 0 to 1; 0.10 by default. */
  opacity?: number;
  /** Any CSS colour; the accent colour by default. */
  color?: string | null;
}

// Draws the decorative icon as a faint watermark. The default (top right, size
// 1, 10% opacity, accent colour) matches the studio's original placement.
function watermark(ctx: Ctx, name: string | undefined, accent: string, W: number, H: number, k: number, st: IconStyle = {}, floorY: number = H): void {
  if (!name || name === "none" || !ALL_ICONS[name]) return;
  const fn = ALL_ICONS[name];
  const scale = st.size && st.size > 0 ? st.size : 1;
  const alpha = st.opacity != null && st.opacity >= 0 && st.opacity <= 1 ? st.opacity : 0.1;
  const pos = st.position || "top-right";
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = st.color || accent;
  if (pos === "pattern") {
    const s = Math.round(150 * k * scale);
    const gap = Math.round(s * 1.7);
    let row = 0;
    for (let y = Math.round(s * 0.7); y < floorY - s * 0.4; y += gap, row++) {
      for (let x = Math.round(s * 0.7) + (row % 2 ? gap / 2 : 0); x < W + s; x += gap) fn(ctx, x, y, s);
    }
  } else if (pos === "center") {
    const s = Math.round(Math.min(W, floorY) * 0.6 * scale);
    fn(ctx, W / 2, Math.min(floorY, H) / 2, s);
  } else {
    const s = Math.round(320 * k * scale);
    const inset = Math.round(30 * k) + s / 2;
    const cx = pos === "top-left" || pos === "bottom-left" ? inset : W - inset;
    const cy = pos === "bottom-left" ? floorY - Math.round(30 * k) - s / 2 : Math.round(90 * k) + s / 2;
    fn(ctx, cx, cy, s);
  }
  ctx.restore();
}

// Measures (measureOnly) or draws the title/subtitle/lines block.
function textBlock(ctx: Ctx, layout: Layout, accent: string, x: number, startY: number, maxW: number, maxY: number, k: number, measureOnly: boolean, tc?: TextColours, ta?: TextAligns): number {
  tc = tc || {};
  ta = ta || {};
  var alT = ta.title === "center" ? "center" : "left";
  var alS = ta.subtitle === "center" ? "center" : "left";
  var alB = ta.body === "center" ? "center" : "left";
  function ax(al: string): number { return al === "center" ? x + maxW / 2 : x; }
  var y = startY;
  if (layout.title){
    var ts = fit(ctx, layout.title, "700", Math.round(84 * k), Math.round(40 * k), maxW);
    ctx.font = "700 " + ts + "px " + FAMILY;
    var tlAll = wrap(ctx, layout.title, maxW);
    var tl = tlAll.slice(0, 3);
    if (!measureOnly && tlAll.length > tl.length) drawInfo.clamped = true;
    for (var i = 0; i < tl.length; i++){
      y += ts;
      if (!measureOnly && y > maxY){ drawInfo.clamped = true; ctx.textAlign = "left"; return y; }
      if (!measureOnly){ ctx.fillStyle = tc.title || "#ffffff"; ctx.textAlign = alT as CanvasTextAlign; ctx.fillText(tl[i], ax(alT), y); }
      y += Math.round(8 * k);
    }
  }
  if (layout.subtitle){
    y += Math.round(14 * k);
    var ss = fit(ctx, layout.subtitle, "700", Math.round(42 * k), Math.round(24 * k), maxW);
    ctx.font = "700 " + ss + "px " + FAMILY;
    var slAll = wrap(ctx, layout.subtitle, maxW);
    var sl = slAll.slice(0, 2);
    if (!measureOnly && slAll.length > sl.length) drawInfo.clamped = true;
    for (var j = 0; j < sl.length; j++){
      y += ss;
      if (!measureOnly && y > maxY){ drawInfo.clamped = true; ctx.textAlign = "left"; return y; }
      if (!measureOnly){ ctx.fillStyle = tc.subtitle || accent; ctx.textAlign = alS as CanvasTextAlign; ctx.fillText(sl[j], ax(alS), y); }
      y += Math.round(4 * k);
    }
  }
  if (layout.lines && layout.lines.length){
    y += Math.round(18 * k);
    var lf = Math.round(32 * k), step = Math.round(40 * k);
    ctx.font = "400 " + lf + "px " + FAMILY;
    for (var m = 0; m < layout.lines.length; m++){
      var wl = wrap(ctx, layout.lines[m], maxW);
      for (var n = 0; n < wl.length; n++){
        y += step;
        if (y > maxY){ if (!measureOnly) drawInfo.clamped = true; ctx.textAlign = "left"; return measureOnly ? (y - startY) : y; }
        if (!measureOnly){ ctx.fillStyle = tc.body || P.light; ctx.textAlign = alB as CanvasTextAlign; ctx.fillText(wl[n], ax(alB), y); }
      }
      y += Math.round(8 * k);
    }
  }
  ctx.textAlign = "left";
  return measureOnly ? (y - startY) : y;
}

function drawList(ctx: Ctx, list: ListItem[], style: string | undefined, accent: string, x: number, topY: number, maxW: number, maxY: number, k: number, tc?: TextColours): void {
  tc = tc || {};
  var y = topY;
  var avail = maxY - topY;
  var rowH = Math.min(98 * k, Math.max(56 * k, avail / Math.max(list.length, 1)));
  var pf = Math.min(44 * k, rowH * 0.46), sf = Math.min(30 * k, rowH * 0.3);
  for (var i = 0; i < list.length; i++){
    var it = list[i];
    ctx.fillStyle = accent;
    if (style === "timeline"){
      ctx.beginPath();
      ctx.arc(x + 10 * k, y + rowH * 0.3, 9 * k, 0, Math.PI * 2);
      ctx.fill();
      if (i < list.length - 1){ ctx.globalAlpha = 0.5; ctx.fillRect(x + 7 * k, y + rowH * 0.3, 6 * k, rowH); ctx.globalAlpha = 1; }
    } else {
      ctx.fillRect(x, y + rowH * 0.1, 8 * k, rowH * 0.5);
    }
    ctx.fillStyle = tc.title || "#ffffff";
    ctx.textAlign = "left";
    var pf2 = fit(ctx, it.primary || "", "700", pf, 22 * k, maxW - 160 * k);
    ctx.font = "700 " + pf2 + "px " + FAMILY;
    ctx.fillText(it.primary || "", x + 36 * k, y + pf2 * 0.9 + 4 * k);
    if (it.secondary){
      ctx.fillStyle = tc.subtitle || accent;
      ctx.font = "400 " + sf + "px " + FAMILY;
      ctx.fillText(it.secondary, x + 36 * k, y + pf2 * 0.9 + 4 * k + sf + 6 * k);
    }
    y += rowH;
    if (y > maxY){ drawInfo.clamped = true; break; }
  }
}

// Resolves a colour control value to a usable CSS colour. Accepts a palette
// key (for example "blue"), a hex value (for example "#336699") or a named
// colour, falling back to the supplied default when blank.
function colorValue(v: string | null | undefined, fallback: string): string {
  if (!v) return fallback;
  if (P[v]) return P[v];
  return v;
}

// Returns the paint for a colour surface: the solid colour, or a subtle
// diagonal gradient of the same colour (slightly lighter towards the top
// left, slightly darker towards the bottom right) when style is "gradient".
// Used wherever a background colour is drawn, never for images.
function bgPaint(ctx: Ctx, x: number, y: number, w: number, h: number, color: string, style: string): string | CanvasGradient {
  if (style !== "gradient") return color;
  var g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, shade(color, 0.10));
  g.addColorStop(1, shade(color, -0.14));
  return g;
}

// Resolves which logo to show from the user's choice and the brand rules.
// Only one logo ever shows on a graphic: branch or CAMRA, never both at
// once. Legacy "both" links fall back to the automatic rule.
export function resolveLogos(logos: string | null | undefined, campaign: boolean | undefined, branchOnCampaign: boolean | undefined): LogoChoice {
  logos = logos || "auto";
  if (logos === "camra") return { branch: false, camra: true };
  if (logos === "branch") return { branch: true, camra: false };
  // Automatic (brand default). Campaign posts carry the CAMRA logo, or the
  // branch logo instead when that has been switched on (off-brand). All
  // other (endorsed) posts show the branch logo, since it already carries
  // the CAMRA name.
  if (campaign) return branchOnCampaign ? { branch: true, camra: false } : { branch: false, camra: true };
  return { branch: true, camra: false };
}

// Computes the corner panel for the "corner" full-bleed style: the logo block
// anchored in the bottom-right with padding, plus the size of the curved
// sweep that has to clear it.
function cornerPanel(W: number, H: number, _M: number, k: number, _who: LogoChoice, ls: number): CornerPanel {
  // The corner panel holds exactly one logo, and the branch and CAMRA logos
  // get identical treatment: the same box, size, position and scaling. The
  // whole panel still scales with the logo size control (ls), whose fixed
  // minimum of 1.25 keeps the branch logo's small text legible.
  var lh = Math.round(92 * k * ls);
  var logoW = Math.round(450 * k * ls);
  var pad = Math.round(36 * k);
  var w = logoW + pad * 2;
  var h = lh + pad * 2;
  // The sweep extends well past the logo block so the curve clears it, capped
  // so it never swallows the whole canvas on small or landscape sizes.
  var sweepW = Math.min(Math.round(w * 1.28), Math.round(W * 0.85));
  var sweepH = Math.min(Math.round(h * 1.75), Math.round(H * 0.62));
  return { w: w, h: h, pad: pad, lh: lh, logoW: logoW, sweepW: sweepW, sweepH: sweepH };
}

// Draws the corner panel: a wedge hugging the bottom-right corner whose edge
// is one large curve sweeping from the right edge round to the bottom edge,
// echoing the curved corner device on CAMRA's own artwork. Filled with the
// chosen background colour (slate only by default, no longer forced).
function drawCorner(ctx: Ctx, W: number, H: number, M: number, k: number, who: LogoChoice, ls: number, bg: string, bgStyle: string): void {
  var p = cornerPanel(W, H, M, k, who, ls);
  var sw = p.sweepW, sh = p.sweepH;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(W, H - sh);
  // One generous quadratic curve, bulging out into the photo.
  ctx.quadraticCurveTo(W - sw * 0.72, H - sh * 0.72, W - sw, H);
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fillStyle = bgPaint(ctx, W - sw, H - sh, sw, sh, bg, bgStyle);
  ctx.fill();
  ctx.restore();
}

// Draws the footer: a thin accent rule, an optional tagline, and one logo.
// Only one logo ever shows: endorsed (branch) posts carry the branch logo (it
// already carries the CAMRA name) and campaigns carry the CAMRA logo (Brand
// Guidelines p.17). fopts: { campaign, showBranchOnCampaign, tagline,
// logoScale, logos, slateBand }.
function footer(ctx: Ctx, accent: string, branch: Branch, branchImg: Img | null | undefined, camraImg: Img | null | undefined, fopts: FooterOptions, W: number, H: number, M: number, k: number): void {
  fopts = fopts || {};
  var ls = Math.max((fopts.logoScale || 0) > 0 ? (fopts.logoScale as number) : 1.25, 1.25);
  var who = resolveLogos(fopts.logos, fopts.campaign, fopts.showBranchOnCampaign);
  var lineY = H - Math.round(M * 1.7) - Math.round((ls - 1) * 70 * k);
  if (fopts.slateBand){
    // Keep the logos on slate even when the background colour has changed.
    var bandTop = lineY - Math.round(54 * k);
    ctx.fillStyle = P.slate;
    ctx.fillRect(0, bandTop, W, H - bandTop);
  }
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = Math.max(2, 3 * k);
  ctx.beginPath();
  ctx.moveTo(M, lineY);
  ctx.lineTo(W - M, lineY);
  ctx.stroke();
  ctx.globalAlpha = 1;
  if (fopts.tagline){
    var tf = fit(ctx, fopts.tagline, "400", Math.round(25 * k), Math.round(15 * k), W - M * 2);
    ctx.fillStyle = P.light || "#cdd2db";
    ctx.font = "400 " + tf + "px " + FAMILY;
    var tgAlign = fopts.taglineAlign === "left" ? "left" : "center";
    ctx.textAlign = tgAlign as CanvasTextAlign;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(fopts.tagline, tgAlign === "center" ? W / 2 : M, lineY - Math.round(14 * k));
    ctx.textAlign = "left";
  }
  var logoY = lineY + Math.round(16 * k), boxH = Math.round(74 * k * ls);
  var camW = Math.round(300 * k * ls);
  // The branch logo is drawn a little larger than the CAMRA wordmark (it
  // already carries the CAMRA name in small text). Legibility comes from the
  // scale's fixed minimum of 1.25, enforced above.
  var brSoloW = Math.round(470 * k * ls), brSoloH = Math.round(92 * k * ls);
  // The logo can be aligned left, centre (default) or right across the footer.
  var la = fopts.logoAlign === "left" ? "left" : (fopts.logoAlign === "right" ? "right" : "center");
  if (who.branch){
    var brY = logoY - Math.round((brSoloH - boxH) / 2);
    var brX = la === "left" ? M : (la === "right" ? W - M - brSoloW : W / 2 - brSoloW / 2);
    logoOrText(ctx, branchImg, branch.short || branch.name, brX, brY, brSoloW, brSoloH, la, k);
  } else if (who.camra){
    var caX = la === "left" ? M : (la === "right" ? W - M - camW : W / 2 - camW / 2);
    logoOrText(ctx, camraImg, "CAMRA", caX, logoY, camW, boxH, la, k);
  }
}

// Draws a rounded header photo for panel layouts (lists, meetings,
// announcements) across the content width and returns the y just below it.
// Honours the same fit / pan / zoom framing controls as photo posts.
function photoHeader(ctx: Ctx, img: Img, x: number, y: number, w: number, maxBottom: number, frame: Frame | undefined, k: number): number {
  var avail = maxBottom - y;
  var ph = Math.max(Math.round(200 * k), Math.min(Math.round(380 * k), Math.round(avail * 0.42)));
  var radius = Math.round(22 * k);
  ctx.save();
  rr(ctx, x, y, w, ph, radius);
  ctx.clip();
  placeImage(ctx, img, x, y, w, ph, frame);
  ctx.restore();
  return y + ph;
}

// Tracks whether any text was cut off during the last draw, so the app can
// warn the user instead of trimming silently.
var drawInfo: DrawInfo = { clamped: false };

export function draw(opts: RenderOptions): DrawInfo {
  var ctx = opts.ctx, W = opts.width, H = opts.height;
  var tmpl = opts.template;
  // The app builds the layout once per frame and passes it in; building from
  // values remains as a fallback for direct callers.
  var layout = opts.layout || tmpl.build(opts.values || {});
  drawInfo.clamped = false;
  var accentKey = layout.accentKey || tmpl.accentKey || "amber";
  var accent = P[accentKey] || accentKey;
  var k = Math.min(W, H) / 1080;
  // padScale lets the user add a safe margin around the content (default 1),
  // which keeps text and logos clear of platform-specific cropping such as
  // Facebook's differing desktop and mobile layouts.
  var padScale = (opts.pad || 0) > 0 ? (opts.pad as number) : 1;
  var M = Math.round(Math.min(W, H) * 0.06 * padScale);
  var contentW = W - M * 2;
  var usePhoto = !!(tmpl.allowPhoto && opts.photoImg && tmpl.layout === "photoTop");
  // Panel layouts (lists, meetings, announcements) can also carry a photo. It is
  // shown as a rounded header image above the text or list, rather than as the
  // main photoTop frame. hasPhoto is true whenever the active type allows a photo
  // and one has been added, whatever the layout.
  var hasPhoto = !!(tmpl.allowPhoto && opts.photoImg);
  // The background colour can be changed, but the CAMRA logo must stay on
  // slate (Brand Guidelines p.4 to p.6). When a non-slate background is used,
  // a slate band is drawn behind the footer so the logos still sit on slate.
  var bg = colorValue(opts.bgColor, P.slate);
  // Background style: solid colour (default) or a subtle diagonal gradient of
  // the same colour. Never applied to photos.
  var bgStyle = opts.bgStyle === "gradient" ? "gradient" : "solid";
  var bgIsSlate = !opts.bgColor || opts.bgColor === "slate" || String(bg).toLowerCase() === String(P.slate).toLowerCase();
  // Logos can be scaled up (still on-brand) for more presence. The scale
  // has a fixed minimum of 1.25, which is also the default: anything smaller
  // made the branch logo's small text hard to read.
  var logoScale = Math.max((opts.logoScale || 0) > 0 ? (opts.logoScale as number) : 1.25, 1.25);
  // Independent colours per text type; a blank value falls back to the
  // standard on-brand colour for that text.
  var tc = opts.textColors || {};
  // Independent alignment per text type ("left" default, or "center").
  var ta = opts.textAligns || {};

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = bgPaint(ctx, 0, 0, W, H, bg, bgStyle);
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "alphabetic";

  // Larger logos need a little more room, so the content floor rises with them.
  var footTop = H - Math.round(M * 2.4) - Math.round((logoScale - 1) * 70 * k);
  // frameMode controls how a photo is framed: "labelOut" keeps the post-type
  // label above an inset image (smaller image), "labelIn" overlays the label on
  // a larger inset image, and "fullBleed" runs the image to the edges with only
  // the footer band remaining.
  var frameModeRaw = opts.frameMode || "labelOut";
  var frameMode = usePhoto ? frameModeRaw : "labelOut";
  // Panel layouts (lists, meetings, announcements) honour full bleed too: the
  // photo covers the whole canvas as a background instead of the rounded
  // header image. No scrim is forced: legibility is the user's call, via the
  // photo opacity slider that fades any photo into the background colour.
  var panelFullBleed = hasPhoto && !usePhoto && frameModeRaw === "fullBleed";
  // Full-bleed posts can use the gradient footer band (default) or a curved
  // corner panel in the background colour that carries the logos.
  var fbStyle = opts.fbStyle === "corner" ? "corner" : "gradient";
  // For photo posts the label (eyebrow), the title/subtitle block and the
  // caption line can each be shown or hidden independently. The caption text
  // defaults to the template's footer line but can be overridden or turned off.
  var showLabel = usePhoto ? (opts.showLabel !== false) : true;
  var showText = usePhoto ? (opts.showText !== false) : true;
  var capDefault = layout.footer || "";
  var capText = usePhoto
    ? (opts.showCaption === false ? "" : (opts.captionText != null && String(opts.captionText).trim() ? String(opts.captionText) : capDefault))
    : capDefault;
  // Content floor for panel layouts. With the corner panel the sweep bulges
  // up into the canvas, so the floor rises to keep content clear of it.
  var panelFloor = footTop;
  if (panelFullBleed){
    var pfbH = fbStyle === "corner" ? H : footTop;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, pfbH);
    ctx.clip();
    if (opts.frame && opts.frame.fit === "contain"){
      ctx.fillStyle = bgPaint(ctx, 0, 0, W, pfbH, bg, bgStyle);
      ctx.fillRect(0, 0, W, pfbH);
    }
    placeImage(ctx, opts.photoImg!, 0, 0, W, pfbH, opts.frame);
    ctx.restore();
    if (fbStyle === "corner"){
      var pWho = resolveLogos(opts.logos, layout.campaign, opts.showBranchOnCampaign);
      drawCorner(ctx, W, H, M, k, pWho, logoScale, bg, bgStyle);
      var pcp = cornerPanel(W, H, M, k, pWho, logoScale);
      panelFloor = Math.min(footTop, H - pcp.sweepH - Math.round(20 * k));
    }
  }
  // A patterned icon fills the background, so it is drawn first, behind
  // the label as well as the text. The other positions draw with the text.
  var patternIcon = !!(opts.iconStyle && opts.iconStyle.position === "pattern");
  if (patternIcon && !hasPhoto && !(usePhoto)) watermark(ctx, opts.iconName || tmpl.defaultIcon, accent, W, H, k, opts.iconStyle, panelFloor);
  var ebH = 0, topY = M;
  if (frameMode === "labelOut" && showLabel && layout.eyebrow){
    ebH = eyebrow(ctx, layout.eyebrow, accent, M, M, k);
    topY = M + ebH + Math.round(40 * k);
  }

  if (usePhoto){
    var px = M, py = topY, pw = contentW, ph, radius = Math.round(22 * k);
    if (frameMode === "fullBleed"){
      px = 0; py = 0; pw = W; radius = 0;
      // With the corner panel there is no footer band at all: the photo runs
      // to the very bottom edge. The gradient style keeps the band.
      ph = fbStyle === "corner" ? H : footTop;
    } else if (frameMode === "labelIn"){
      px = M; py = M; pw = contentW;
      ph = Math.max(Math.round(H * 0.34), Math.min(Math.round(H * 0.58), footTop - py - Math.round(200 * k)));
    } else {
      ph = Math.max(Math.round(H * 0.28), Math.min(Math.round(H * 0.46), footTop - py - Math.round(220 * k)));
    }
    ctx.save();
    rr(ctx, px, py, pw, ph, radius);
    ctx.clip();
    if (opts.frame && opts.frame.fit === "contain"){
      ctx.fillStyle = bgPaint(ctx, px, py, pw, ph, bg, bgStyle);
      ctx.fillRect(px, py, pw, ph);
    }
    placeImage(ctx, opts.photoImg!, px, py, pw, ph, opts.frame);
    if (frameMode === "fullBleed" && fbStyle === "gradient"){
      // Fade the foot of the image into the slate footer band so the title and
      // logos stay legible over any photo.
      var sh = Math.round(380 * k);
      var grad = ctx.createLinearGradient(0, py + ph - sh, 0, py + ph);
      grad.addColorStop(0, "rgba(65,73,90,0)");
      grad.addColorStop(1, "rgba(65,73,90,0.92)");
      ctx.fillStyle = grad;
      ctx.fillRect(px, py + ph - sh, pw, sh);
    }
    ctx.restore();
    if (frameMode === "fullBleed" && fbStyle === "corner"){
      drawCorner(ctx, W, H, M, k, resolveLogos(opts.logos, layout.campaign, opts.showBranchOnCampaign), logoScale, bg, bgStyle);
    }
    if (frameMode !== "labelOut" && showLabel && layout.eyebrow){
      var ex = frameMode === "fullBleed" ? M : M + Math.round(22 * k);
      var ey = frameMode === "fullBleed" ? M : M + Math.round(22 * k);
      eyebrow(ctx, layout.eyebrow, accent, ex, ey, k);
    }
    if (frameMode === "fullBleed"){
      // Stack whichever of the title/subtitle and caption are shown, bottom
      // aligned over the gradient just above the footer band. With the corner
      // panel there is no band, so the text sits lower and wraps a little
      // earlier to stay clear of the corner sweep.
      var fbFloor = footTop, fbMaxW = contentW;
      if (fbStyle === "corner"){
        var cpx = cornerPanel(W, H, M, k, resolveLogos(opts.logos, layout.campaign, opts.showBranchOnCampaign), logoScale);
        fbFloor = H - Math.round(M * 1.1);
        fbMaxW = Math.max(Math.round(contentW * 0.5), W - M - Math.round(cpx.sweepW * 0.6));
      }
      var capFs = Math.round(34 * k), capGap = Math.round(40 * k);
      var textH = showText ? textBlock(ctx, layout, accent, M, 0, fbMaxW, 1e6, k, true) : 0;
      var capH = capText ? (capFs + (showText ? capGap : 0)) : 0;
      var fbBlockH = textH + capH;
      var fbSy = Math.max(py + Math.round(40 * k), fbFloor - Math.round(30 * k) - fbBlockH);
      var fbEndY = fbSy;
      if (showText) fbEndY = textBlock(ctx, layout, accent, M, fbSy, fbMaxW, fbFloor, k, false, tc, ta);
      if (capText){
        var capAlF = ta.caption === "center" ? "center" : "left";
        ctx.fillStyle = tc.caption || accent;
        ctx.font = "700 " + capFs + "px " + FAMILY;
        ctx.textAlign = capAlF as CanvasTextAlign;
        ctx.fillText(capText, capAlF === "center" ? M + fbMaxW / 2 : M, Math.min(showText ? fbEndY + capGap : fbSy + capFs, fbFloor - Math.round(8 * k)));
      }
    } else {
      if (showText || capText){
        ctx.fillStyle = accent;
        rr(ctx, M, py + ph + Math.round(18 * k), pw, Math.round(6 * k), 3);
        ctx.fill();
      }
      var cy = py + ph + Math.round(48 * k);
      var fEndY = showText ? textBlock(ctx, layout, accent, M, cy, contentW, footTop, k, false, tc, ta) : cy;
      if (capText){
        var capAlP = ta.caption === "center" ? "center" : "left";
        ctx.fillStyle = tc.caption || accent;
        ctx.font = "700 " + Math.round(34 * k) + "px " + FAMILY;
        ctx.textAlign = capAlP as CanvasTextAlign;
        ctx.fillText(capText, capAlP === "center" ? W / 2 : M, Math.min(showText ? fEndY + Math.round(46 * k) : cy + Math.round(34 * k), footTop));
      }
    }
  } else if (layout.list && layout.list.length){
    var listTop = topY;
    if (hasPhoto && !panelFullBleed){
      listTop = photoHeader(ctx, opts.photoImg!, M, topY, contentW, panelFloor, opts.frame, k) + Math.round(30 * k);
    } else if (!hasPhoto){
      if (!patternIcon) watermark(ctx, opts.iconName || tmpl.defaultIcon, accent, W, H, k, opts.iconStyle, panelFloor);
    }
    var afterTitle = textBlock(ctx, layout, accent, M, listTop + Math.round(8 * k), contentW, panelFloor, k, false, tc, ta);
    drawList(ctx, layout.list, layout.listStyle, accent, M, afterTitle + Math.round(26 * k), contentW, panelFloor, k, tc);
  } else if (hasPhoto && !panelFullBleed){
    // Text-only panel (for example a meeting or announcement) with a photo:
    // header image, then the text block top-aligned below it.
    var pTop = photoHeader(ctx, opts.photoImg!, M, topY, contentW, panelFloor, opts.frame, k) + Math.round(40 * k);
    var pEndY = textBlock(ctx, layout, accent, M, pTop, contentW, panelFloor, k, false, tc, ta);
    if (layout.footer){
      var pCapAl = ta.caption === "center" ? "center" : "left";
      ctx.fillStyle = tc.caption || accent;
      ctx.font = "700 " + Math.round(34 * k) + "px " + FAMILY;
      ctx.textAlign = pCapAl as CanvasTextAlign;
      ctx.fillText(layout.footer, pCapAl === "center" ? W / 2 : M, Math.min(pEndY + Math.round(50 * k), panelFloor));
    }
  } else {
    if (!hasPhoto && !patternIcon) watermark(ctx, opts.iconName || tmpl.defaultIcon, accent, W, H, k, opts.iconStyle, panelFloor);
    var blockH = textBlock(ctx, layout, accent, M, 0, contentW, 1e6, k, true);
    var avail = panelFloor - topY;
    var startY = topY + Math.max(0, (avail - blockH) / 2 - Math.round(30 * k));
    var endY2 = textBlock(ctx, layout, accent, M, startY, contentW, panelFloor, k, false, tc, ta);
    if (layout.footer){
      var capAlE = ta.caption === "center" ? "center" : "left";
      ctx.fillStyle = tc.caption || accent;
      ctx.font = "700 " + Math.round(34 * k) + "px " + FAMILY;
      ctx.textAlign = capAlE as CanvasTextAlign;
      ctx.fillText(layout.footer, capAlE === "center" ? W / 2 : M, Math.min(endY2 + Math.round(50 * k), panelFloor));
    }
  }

  // The branch slot normally holds the branch logo; a region or sub-brand
  // logo can take its place, with its own wordmark fallback.
  var slotImg = opts.altLogo ? opts.altLogo.img : opts.branchLogoImg;
  var slotBranch: Branch = opts.altLogo ? { name: opts.altLogo.text, short: opts.altLogo.text } : opts.branch;
  var fullBleedCorner = ((usePhoto && frameMode === "fullBleed") || panelFullBleed) && fbStyle === "corner";
  if (fullBleedCorner){
    // The corner panel holds exactly one logo instead of the footer band.
    // Either logo is drawn into the same box, so size and position always
    // match; the branch logo's legibility floor applies here too, inside
    // cornerPanel.
    var who = resolveLogos(opts.logos, layout.campaign, opts.showBranchOnCampaign);
    var cp = cornerPanel(W, H, M, k, who, logoScale);
    var lx = W - cp.pad - cp.logoW, ly = H - cp.pad - cp.lh;
    if (who.branch){
      logoOrText(ctx, slotImg, slotBranch.short || slotBranch.name, lx, ly, cp.logoW, cp.lh, "right", k);
    } else {
      logoOrText(ctx, opts.camraLogoImg, "CAMRA", lx, ly, cp.logoW, cp.lh, "right", k);
    }
  } else {
    footer(ctx, accent, slotBranch, slotImg, opts.camraLogoImg, {
      campaign: layout.campaign,
      showBranchOnCampaign: opts.showBranchOnCampaign,
      tagline: opts.tagline != null ? opts.tagline : CONFIG.tagline,
      logoScale: logoScale,
      logos: opts.logos,
      logoAlign: opts.logoAlign,
      taglineAlign: opts.taglineAlign,
      slateBand: !bgIsSlate && !(usePhoto && frameMode === "fullBleed") && !panelFullBleed
    }, W, H, M, k);
  }
  return drawInfo;
}
