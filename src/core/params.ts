// URL query parameters: one schema drives everything.
// PARAM_DEFS is the single source of truth for the general parameters. The same
// entries are used to read a link (applyParams in app.js), write a link
// (shareLink in app.js) and to build this reference, so the three can never
// drift apart. Field, size and icon parameters are generated from the live
// configuration (templates.js, presets.js, icons.js) in the same way.
import { CONFIG } from "./config.ts";
import { escapeHtml as esc } from "./html.ts";
import { ICON_NAMES } from "./icons.ts";
import { BRANCH_LOGOS, REGION_LOGOS, SUB_BRAND_LOGOS } from "./logos.ts";
import { PRESETS } from "./presets.ts";
import { TEMPLATES, type Field } from "./templates.ts";

export interface ParamDef {
  key: string;
  elId?: string;
  customElId?: string;
  kind?: "value" | "color" | "flag";
  def?: string;
  defChecked?: boolean;
  photoOnly?: boolean;
  doc: string | (() => string);
}


// One entry per general parameter.
// - elId / customElId: the controls the value maps to. Entries with an elId
//   are read and written generically by app.js; entries without one need
//   bespoke handling there but are still documented from this table.
// - kind: "value" (plain control), "color" (palette dropdown plus custom hex
//   input) or "flag" (checkbox serialised as 1/0).
// - def / defChecked: the default; a parameter is only added to a share link
//   when the current value differs from it.
// - photoOnly: only applies (and is only serialised) when a photo is set.
// - doc: the reference row, as a string or a function evaluated at render time.
export const PARAM_DEFS: ParamDef[] = [
  { key: "type", doc: function(){
      return "Post type. One of: " + TEMPLATES.map(function(t){ return "<code>" + esc(t.id) + "</code>"; }).join(", ") + ".";
    } },
  { key: "branch", doc: function(){
      var ids = Object.keys(CONFIG.branches);
      return "Branch: <code>custom</code>, or one of the " + ids.length + " branch ids in the logo catalogue, for example <code>" + esc(CONFIG.defaultBranch) + "</code>. Every id is listed in docs/LOGOS.md, and the branch picker shows them all.";
    } },
  { key: "branchName", doc: "Custom branch name (with <code>branch=custom</code>)." },
  { key: "branchLogo", doc: "URL of a white branch-logo PNG (with <code>branch=custom</code>). Needs permissive CORS for downloads. Included in share links when the logo came from a URL (an uploaded file cannot travel in a link)." },
  { key: "icon", doc: function(){
      return "Decorative icon when there is no photo. One of: <code>none</code>, " + ICON_NAMES.map(function(k){ return "<code>" + esc(k) + "</code>"; }).join(", ") + ".";
    } },
  { key: "iconpos", elId: "iconPos", kind: "value", def: "top-right",
    doc: "Where the decorative icon sits: <code>top-right</code> (default), <code>top-left</code>, <code>bottom-left</code>, <code>center</code> (large, behind the text) or <code>pattern</code> (repeated across the background)." },
  { key: "iconsize", elId: "iconSize", kind: "value", def: "1",
    doc: "Decorative icon size multiplier: <code>0.7</code>, <code>1</code> (default), <code>1.4</code> or <code>2</code>." },
  { key: "iconopacity", elId: "iconOpacity", kind: "value", def: "0.1",
    doc: "Decorative icon opacity, <code>0.05</code> to <code>0.5</code>. Defaults to <code>0.1</code>, a faint watermark." },
  { key: "iconcolor", elId: "iconColor", customElId: "iconCustom", kind: "color", def: "auto",
    doc: "Decorative icon colour: <code>auto</code> (the post's accent colour, default), a brand colour key such as <code>white</code> or <code>amber</code>, or a custom hex value." },
  { key: "sizes", doc: "Comma-separated size ids, for example <code>ig-square,fb-landscape</code>." },
  { key: "preview", doc: "Size id to show in the on-screen preview." },
  { key: "orient", elId: "orient", kind: "value", def: "as",
    doc: "Output orientation for every selected size: <code>landscape</code> or <code>portrait</code> swaps width and height where needed (square sizes are unaffected). Defaults to each size's listed orientation." },
  { key: "pad", elId: "pad", kind: "value", def: "1",
    doc: "Padding around the content, as a multiplier of the default margin, for example <code>1.3</code> or <code>1.6</code>. Larger values keep text and logos inside social safe areas. Defaults to <code>1</code>." },
  { key: "bg", elId: "bgColor", customElId: "bgCustom", kind: "color", def: "slate",
    doc: "Background colour. One of the eight primary brand colours (<code>slate</code> default, <code>amber</code>, <code>aqua</code>, <code>tango</code>, <code>lilac</code>, <code>blue</code>, <code>emerald</code>, <code>watermelon</code>) or any custom hex value such as <code>%23336699</code>. The CAMRA logo stays on a slate band whatever the background, except on the full-bleed corner panel, which uses the background colour." },
  { key: "bgstyle", elId: "bgStyle", kind: "value", def: "solid",
    doc: "Background style: <code>solid</code> (default) or <code>gradient</code> for a subtle diagonal gradient of the background colour. Applies wherever a background colour is drawn (including the full-bleed corner panel), never to photos." },
  { key: "titlecolor", elId: "titleColor", customElId: "titleCustom", kind: "color", def: "auto",
    doc: "Title text colour. A brand colour key (for example <code>amber</code>, <code>white</code>, <code>light</code>) or a custom hex value. Defaults to the standard on-brand colour." },
  { key: "subcolor", elId: "subColor", customElId: "subCustom", kind: "color", def: "auto",
    doc: "Subtitle text colour. A brand colour key or a custom hex value. Defaults to the accent colour." },
  { key: "bodycolor", elId: "bodyColor", customElId: "bodyCustom", kind: "color", def: "auto",
    doc: "Body text colour. A brand colour key or a custom hex value. Defaults to light grey." },
  { key: "capcolor", elId: "capColor", customElId: "capCustom", kind: "color", def: "auto",
    doc: "Caption text colour. A brand colour key or a custom hex value. Defaults to the accent colour." },
  { key: "logoScale", elId: "logoScale", kind: "value", def: "1.25",
    doc: "Logo size multiplier, from <code>1.25</code> (standard, the default and the minimum) to <code>2</code>. The form's presets map to <code>1.25</code> (standard), <code>1.6</code> (larger) and <code>2</code> (massive); the slider covers everything in between. Anything below <code>1.25</code>, including older links, is raised to the minimum so the branch logo stays legible." },
  { key: "logos", elId: "logos", kind: "value", def: "auto",
    doc: "Which logo to show: <code>auto</code> (brand default: campaigns show the CAMRA logo, LocAle and Pub heritage posts their own logos, everything else the branch logo), <code>camra</code>, <code>branch</code>, <code>region</code> (with <code>region</code>) or <code>subbrand</code> (with <code>subbrand</code>). Only one logo ever shows on a graphic; legacy <code>both</code> links fall back to <code>auto</code>." },
  { key: "region", elId: "region", kind: "value", def: "",
    doc: function(){ return "Region logo id, used with <code>logos=region</code>. One of: " + REGION_LOGOS.map(function(r){ return "<code>" + esc(r.id) + "</code>"; }).join(", ") + "."; } },
  { key: "subbrand", elId: "subBrand", kind: "value", def: "",
    doc: function(){ return "Sub-brand logo id, used with <code>logos=subbrand</code>. One of: " + SUB_BRAND_LOGOS.map(function(r){ return "<code>" + esc(r.id) + "</code>"; }).join(", ") + "."; } },
  { key: "logoalign", elId: "logoAlign", kind: "value", def: "center",
    doc: "Alignment of the logo in the footer: <code>center</code> (default), <code>left</code> or <code>right</code>." },
  { key: "titlealign", elId: "titleAlign", kind: "value", def: "left",
    doc: "Title alignment: <code>left</code> (default) or <code>center</code>." },
  { key: "subalign", elId: "subAlign", kind: "value", def: "left",
    doc: "Subtitle alignment: <code>left</code> (default) or <code>center</code>." },
  { key: "bodyalign", elId: "bodyAlign", kind: "value", def: "left",
    doc: "Body text alignment: <code>left</code> (default) or <code>center</code>." },
  { key: "capalign", elId: "capAlign", kind: "value", def: "left",
    doc: "Caption alignment: <code>left</code> (default) or <code>center</code>." },
  { key: "fbstyle", elId: "fbStyle", kind: "value", def: "gradient", photoOnly: true,
    doc: "Full-bleed style for posts with <code>fmode=fullBleed</code> (photo and panel post types alike): <code>gradient</code> (footer band with a gradient, the default) or <code>corner</code> (a curved corner panel in the background colour, with no footer band). The corner holds a single logo, following the same logo rules as the footer." },
  { key: "photo", doc: "URL of a photo for photo-led post types. Needs permissive CORS for downloads. Included in share links when the photo came from a URL (an uploaded file cannot travel in a link)." },
  { key: "fit", elId: "fitMode", kind: "value", def: "cover", photoOnly: true,
    doc: "Photo fit: <code>cover</code>, <code>contain</code> or <code>fill</code>." },
  { key: "x", elId: "frameX", kind: "value", def: "0", photoOnly: true,
    doc: "Photo horizontal position, -1 to 1." },
  { key: "y", elId: "frameY", kind: "value", def: "0", photoOnly: true,
    doc: "Photo vertical position, -1 to 1." },
  { key: "zoom", elId: "frameZoom", kind: "value", def: "1", photoOnly: true,
    doc: "Photo zoom, 1 or more." },
  { key: "opacity", elId: "photoOpacity", kind: "value", def: "1", photoOnly: true,
    doc: "Photo opacity, <code>0</code> to <code>1</code>. <code>1</code> (default) shows the image fully opaque; lower values fade it into the background colour, handy for keeping text legible over a busy photo." },
  { key: "fmode", elId: "frameMode", kind: "value", def: "labelOut", photoOnly: true,
    doc: "Photo framing: <code>labelOut</code> (label above a smaller image, the default), <code>labelIn</code> (label on a larger image) or <code>fullBleed</code> (image to the edges with only the footer band). On panel post types (What's On, Social tour, Hybrid, Meeting/AGM, Announcement) only <code>fullBleed</code> changes the layout: the photo covers the whole graphic instead of the header image; the other two modes keep the header image. Use <code>opacity</code> if text needs to stand out over the photo." },
  { key: "label", elId: "showLabel", kind: "flag", defChecked: true, photoOnly: true,
    doc: "Photo posts: set to <code>0</code> to hide the post-type label (for example NEWCOMER). Shown by default." },
  { key: "text", elId: "showText", kind: "flag", defChecked: true, photoOnly: true,
    doc: "Photo posts: set to <code>0</code> to hide the title and subtitle. Shown by default." },
  { key: "caption", doc: "Photo posts: the caption line under the image. Defaults to the post type's wording (for example &quot;Presented by the branch&quot;); pass custom text to change it, or <code>off</code> to hide it." },
  { key: "download", doc: "Set to <code>1</code> to export the selected sizes automatically on load." },
  { key: "zip", doc: "With <code>download=1</code>, set to <code>1</code> to deliver every selected size as one ZIP file instead of separate PNGs (or <code>0</code> to force separate PNGs). Defaults to your download format setting." },
  { key: "docs", doc: "Set to <code>1</code> to open this reference on load." },
  { key: "branchOnCampaign", doc: "Set to <code>1</code> to show the branch logo instead of the CAMRA logo on campaign posts (One to Try, Real Cider and Perry). Off-brand but allowed: campaigns should normally show the CAMRA logo, so a warning appears." },
  { key: "brand", doc: "Set to <code>1</code> to open the brand guidelines panel on load." },
  { key: "tagline", doc: "Tagline to show: one of the two approved taglines (<code>Pubs, Pints, People.</code> or <code>Campaigning for pubs, pints and people since 1971</code>), or <code>none</code> to hide it (the tagline is optional). Anything else keeps the default tagline and shows a notice. Defaults to <code>Pubs, Pints, People.</code>" },
  { key: "taglinealign", elId: "taglineAlign", kind: "value", def: "center",
    doc: "Tagline alignment: <code>center</code> (default) or <code>left</code>." }
];

function fieldType(f: Field): string {
  if (f.type === "select" || f.type === "suggest"){
    var opts = (f.options || []).map(function(o){ return Array.isArray(o) ? o[0] : o; });
    return f.type + " (" + opts.join(", ") + ")";
  }
  if (f.type === "list"){
    var keys = (f.itemFields || []).map(function(it){ return it.key; });
    return "list: URL-encoded JSON array of objects with keys " + keys.join(", ");
  }
  return f.type;
}

function row(name: string, desc: string): string {
  return "<tr><td><code>" + esc(name) + "</code></td><td>" + desc + "</td></tr>";
}

export function docsHtml(): string {
  var T = TEMPLATES;
  var P = PRESETS;
  var h: string[] = [];

  h.push("<p>Add parameters to the page URL to pre-fill the form, for example <code>?type=newcomer&amp;pubName=The%20Pigeon&amp;sizes=ig-square&amp;download=1</code>. Values must be URL-encoded. This reference is generated from the same schema and configuration the app runs on, so it always matches the tool.</p>");

  h.push("<h4>General</h4>");
  h.push("<table class=\"docs-table\"><tr><th>Parameter</th><th>What it does</th></tr>");
  PARAM_DEFS.forEach(function(d){
    h.push(row(d.key, typeof d.doc === "function" ? d.doc() : d.doc));
  });
  h.push("</table>");

  h.push("<h4>Fields by post type</h4>");
  T.forEach(function(t){
    h.push("<p><strong>" + esc(t.label) + "</strong> &middot; <code>type=" + esc(t.id) + "</code></p>");
    if (!t.fields.length){ h.push("<p>No fields.</p>"); return; }
    h.push("<table class=\"docs-table\"><tr><th>Parameter</th><th>Type</th></tr>");
    t.fields.forEach(function(f){
      h.push("<tr><td><code>" + esc(f.key) + "</code>" + (f.optional ? " (optional)" : "") + "</td><td>" + esc(fieldType(f)) + "</td></tr>");
    });
    h.push("</table>");
  });

  h.push("<h4>Sizes</h4>");
  h.push("<table class=\"docs-table\"><tr><th>Size id</th><th>Dimensions</th></tr>");
  P.forEach(function(p){ h.push("<tr><td><code>" + esc(p.id) + "</code></td><td>" + esc(p.label + "  " + p.w + "x" + p.h) + "</td></tr>"); });
  h.push("</table>");

  return h.join("\n");
}

export function docText(d: ParamDef): string {
  return typeof d.doc === "function" ? d.doc() : d.doc;
}

/** Converts the small HTML subset used in the docs to Markdown. */
function htmlToMarkdown(html: string): string {
  return html
    .replace(/<code>(.*?)<\/code>/g, (_m, c: string) => "`" + c.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"') + "`")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&middot;/g, "·")
    .replace(/<[^>]+>/g, "")
    .replace(/\|/g, "\\|");
}

/**
 * The same reference as docsHtml, as Markdown, for docs/QUERY_PARAMETERS.md.
 * Generated by `npm run docs`; CI fails when the committed file is stale.
 */
export function docsMarkdown(): string {
  const out: string[] = [];
  out.push("# Query parameters");
  out.push("");
  out.push("Everything you can set in the form can also be set through URL query parameters, so a link can open a ready-made post or export it automatically. Values must be URL-encoded. This file is generated from the parameter schema in `src/core/params.ts` by `npm run docs`, the same schema the app reads and writes links with, so it always matches the tool. The app shows the same reference under Query parameter docs, or open it with `?docs=1`.");
  out.push("");
  out.push("Example: `?type=newcomer&pubName=The%20Pigeon&sizes=ig-square,ig-story&download=1`");
  out.push("");
  out.push("## General");
  out.push("");
  out.push("| Parameter | What it does |");
  out.push("| --- | --- |");
  PARAM_DEFS.forEach((d) => out.push("| `" + d.key + "` | " + htmlToMarkdown(docText(d)) + " |"));
  out.push("");
  out.push("## Fields by post type");
  out.push("");
  out.push("List fields take a URL-encoded JSON array of objects, for example `events=[{\"name\":\"Quiz\",\"date\":\"Fri 7pm\"}]`.");
  TEMPLATES.forEach((t) => {
    out.push("");
    out.push("### " + t.label + " (`type=" + t.id + "`)");
    out.push("");
    if (!t.fields.length) {
      out.push("No fields.");
      return;
    }
    out.push("| Parameter | Type |");
    out.push("| --- | --- |");
    t.fields.forEach((f) => out.push("| `" + f.key + "`" + (f.optional ? " (optional)" : "") + " | " + htmlToMarkdown(esc(fieldType(f))) + " |"));
  });
  out.push("");
  out.push("## Sizes");
  out.push("");
  out.push("| Size id | Size | Dimensions |");
  out.push("| --- | --- | --- |");
  PRESETS.forEach((p) => out.push("| `" + p.id + "` | " + p.label + " | " + p.w + "x" + p.h + " |"));
  out.push("");
  return out.join("\n");
}

/** docs/LOGOS.md: every logo in the catalogue with the id links use. */
export function logosMarkdown(): string {
  const out: string[] = ["# Logos", "", "Every logo the studio offers, with the id share links use (`branch=`, `region=` with `logos=region`, `subbrand=` with `logos=subbrand`). Generated from `assets/logos/catalogue.json` by `npm run docs`. Entries marked \"text wordmark\" have no logo file yet; add one with `scripts/import-logos.py`.", ""];
  const table = (title: string, list: typeof BRANCH_LOGOS) => {
    out.push("## " + title + " (" + list.length + ")", "", "| Name | Id | Logo |", "| --- | --- | --- |");
    list.forEach((e) => out.push("| " + e.name.replace(/\|/g, "\\|") + " | `" + e.id + "` | " + (e.logo ? "PNG" : "text wordmark") + " |"));
    out.push("");
  };
  table("Branches", BRANCH_LOGOS);
  table("Regions", REGION_LOGOS);
  table("Sub-brands", SUB_BRAND_LOGOS);
  return out.join("\n");
}
