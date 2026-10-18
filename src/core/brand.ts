// Plain-language brand guidance shown in the studio. It explains the choices the
// tool makes and links each to the CAMRA Brand Guidelines (2025), so anyone can
// see why a graphic looks the way it does. Built from the live config so colours
// and tagline stay in sync.
import { PALETTE } from "./config.ts";
import { contrastRatio } from "./colour.ts";
import { escapeHtml as esc } from "./html.ts";
import type { Layout } from "./templates.ts";
import type { LogoChoice, TextColours } from "./renderer.ts";

export interface BrandNote {
  tone: "info" | "warn";
  title: string;
  body: string;
}

export interface NoteOptions {
  showBranchOnCampaign?: boolean;
  /** The background dropdown value (a palette key or "custom"). */
  bgColor?: string;
  logos?: string;
  who?: LogoChoice;
  /** The resolved background: a palette key or a hex value. */
  bg?: string;
  textColors?: TextColours;
  /** False when the text sits over a full-bleed photo rather than the background. */
  solidBg?: boolean;
}

const P: Record<string, string> = PALETTE;

// The official, always-current source of truth: full brand guidelines, all
// logos, stock images and more (CAMRA members' volunteer area).
export const BRAND_HUB = "https://members.camra.org.uk/volunteers-area/core-important-documents/camra-brand-guidelines-assets/";



// The four levels of the CAMRA brand hierarchy and the colour that represents
// each one (Brand Guidelines p.17 to p.19). This is the part that is easy to mix
// up, so it is spelled out here with examples.
export const HIERARCHY: Array<{ tier: string; colour: string; examples: string }> = [
  { tier: "Hero", colour: "amber", examples: "CAMRA's main, front-of-house identity, e.g. the core CAMRA brand, the Great British Beer Festival and WhatPub." },
  { tier: "Endorsed", colour: "watermelon", examples: "Branch and regional activity endorsed by CAMRA, e.g. your branch's own festivals, socials and Pub of the Year, where the branch logo leads (it already carries the CAMRA name)." },
  { tier: "Programmes and products", colour: "lilac", examples: "CAMRA's ongoing programmes and product schemes, e.g. LocAle, Learn & Discover and membership." },
  { tier: "Campaigns", colour: "blue", examples: "CAMRA's national campaigns, e.g. One to Try and the Real Cider and Perry campaign. Cider and perry posts use this Blue. Campaigns carry only the CAMRA logo, never a branch logo." }
];

// Why cider and perry posts use Blue.
export const CIDER_WHY = "Cider and perry posts use Blue because the Real Cider and Perry campaign is one of CAMRA's national campaigns, and Blue is the campaign colour in the brand hierarchy (Brand Guidelines p.17 to p.19).";

const COLOUR_WHY: Record<string, string> = {
  amber: "Amber is the Hero colour for CAMRA's main, front-of-house identity. In this tool it is the default accent for general beer and pub posts.",
  watermelon: "Watermelon is the Endorsed colour, used where branch activity is endorsed by CAMRA. In this tool it accents socials and pub tours.",
  lilac: "Lilac is the colour for CAMRA's programmes and products, such as LocAle and Learn & Discover.",
  blue: "Blue is the Campaigns colour for CAMRA's national campaigns, including the Real Cider and Perry campaign. In this tool it accents cider and perry posts, plus meetings, AGMs and announcements.",
  aqua: "Aqua is a primary brand colour, used here for events and festival listings so they stand apart from beer features.",
  tango: "Tango is a primary brand colour, available where a warm contrast is needed.",
  emerald: "Emerald is a primary brand colour, available where a fresh contrast is needed.",
  slate: "Slate is the core background colour behind every graphic.",
  gold: "Gold marks a first place or gold award. Note: gold, silver and bronze are not part of the eight official brand colours, so medal posts sit slightly outside the palette by design.",
  silver: "Silver marks a runner up or silver award. Note: gold, silver and bronze are not part of the eight official brand colours, so medal posts sit slightly outside the palette by design.",
  bronze: "Bronze marks a third place or bronze award. Note: gold, silver and bronze are not part of the eight official brand colours, so medal posts sit slightly outside the palette by design."
};

export const PRIMARIES = ["slate", "amber", "aqua", "tango", "lilac", "blue", "emerald", "watermelon"];

export const RULES: Array<{ title: string; body: string }> = [
  { title: "Official brand hub", body: "Always check the official CAMRA Brand Hub for the full guidelines, every logo, stock images and more. This tool is an unofficial helper that follows those guidelines as closely as it can. The link is just above." },
  { title: "The CAMRA logo", body: "The logo is fixed artwork and must not be altered or recoloured. The white version is used because every graphic sits on a dark slate background (Brand Guidelines p.4 to p.6). It always keeps clear space around it." },
  { title: "Colour palette", body: "The eight primary colours are Slate, Amber, Aqua, Tango, Lilac, Blue, Emerald and Watermelon (Brand Guidelines p.14). Gold, silver and bronze are added only for award medals and are not official brand colours." },
  { title: "Brand hierarchy and its colours", body: "CAMRA's brand has four levels, each with its own colour (Brand Guidelines p.17 to p.19): Hero is Amber, Endorsed is Watermelon, Programmes and products is Lilac, and Campaigns is Blue. Examples for each are listed below." },
  { title: "Endorsed vs campaigns: logos", body: "Only ever one logo appears on a graphic: branch or CAMRA, never both at once. Branch posts use the endorsed treatment: the branch logo leads on its own, shown clearly at a legible size (the logo size control has a fixed minimum, so it never gets too small to read). The branch logo already carries the CAMRA name, so a second, separate CAMRA logo is not needed. Campaigns such as One to Try and Real Cider and Perry use the CAMRA logo, with no branch logo (p.17 to p.19). The studio does this automatically, but you can swap in the branch logo on a campaign post if you need to, knowing it is off-guideline." },
  { title: "Cider and perry colour", body: CIDER_WHY },
  { title: "Typography", body: "Arboria is the brand typeface, with Arial as the approved fallback for anyone without Arboria (Brand Guidelines p.11 and p.13)." },
  { title: "Tagline", body: 'The taglines "Pubs, Pints, People." and "Campaigning for pubs, pints and people since 1971" are the two approved taglines (Brand Guidelines p.16). The tagline is optional, so you can also turn it off.' }
];

function hierarchyHtml(): string {
  return '<h4>Brand hierarchy colours and examples</h4>' + HIERARCHY.map(function(h){
    var c = P[h.colour] || h.colour;
    return '<div class="brand-note info" style="border-left-color:' + esc(c) + '">' +
      '<strong><span class="brand-chip" style="background:' + esc(c) + '"></span> ' + esc(h.tier) + ': ' + esc(h.colour.charAt(0).toUpperCase() + h.colour.slice(1)) + '</strong>' +
      '<span>' + esc(h.examples) + '</span></div>';
  }).join("");
}

export function panelHtml(): string {
  var sw = PRIMARIES.filter(function(k){ return P[k]; }).map(function(k){
    return '<span class="brand-sw"><span class="brand-chip" style="background:' + esc(P[k]) + '"></span>' + esc(k.charAt(0).toUpperCase() + k.slice(1)) + '</span>';
  }).join("");
  var hub = '<p><a href="' + esc(BRAND_HUB) + '" target="_blank" rel="noopener">Open the official CAMRA Brand Hub</a> for the full guidelines, all logos, stock images and more.</p>';
  var body = RULES.map(function(r){
    return '<h4>' + esc(r.title) + '</h4><p>' + esc(r.body) + '</p>';
  }).join("");
  return '<p>Why your graphics look the way they do, linked to the CAMRA Brand Guidelines (2025). This is an unofficial summary to help branch volunteers stay on-brand.</p>' + hub + '<div class="brand-palette">' + sw + '</div>' + body + hierarchyHtml();
}

// Notes tailored to the current selection, shown live beside the form.
export function contextNotes(layoutIn: Layout | null | undefined, oIn?: NoteOptions): BrandNote[] {
  const o: NoteOptions = oIn || {};
  const layout: Layout = layoutIn || {};
  var notes: BrandNote[] = [], acc = layout.accentKey || "";
  if (layout.cider){
    notes.push({ tone: "info", title: "Why this is Blue", body: CIDER_WHY });
  }
  var who = o.who || { branch: false, camra: true };
  if (layout.campaign){
    var name = layout.campaignName || "This post type";
    if (who.branch){
      notes.push({ tone: "warn", title: "Branch logo on a campaign (off-brand)", body: name + " is a CAMRA campaign, which should carry the CAMRA logo (Brand Guidelines p.17 to p.19). Showing the branch logo here instead is off-brand. You can still export it, but the CAMRA logo is the on-brand choice." });
    } else {
      notes.push({ tone: "info", title: "The CAMRA logo shows", body: name + " is a CAMRA campaign. Campaigns are the Blue level of the brand hierarchy and carry the CAMRA logo, not the branch logo (Brand Guidelines p.17 to p.19). You can swap in the branch logo below if you need to, knowing it is off-brand." });
    }
  }
  if (acc === "gold" || acc === "silver" || acc === "bronze"){
    notes.push({ tone: "warn", title: "Medal colour is off-palette", body: COLOUR_WHY[acc] });
  }
  if (o.bgColor && o.bgColor !== "slate"){
    var lightBg = ["amber", "aqua", "emerald", "watermelon"].indexOf(o.bgColor) !== -1;
    notes.push({
      tone: lightBg ? "warn" : "info",
      title: "Background colour changed",
      body: "The background is no longer the usual slate. The CAMRA logo must always sit on slate (Brand Guidelines p.4 to p.6), so a slate band is kept behind the footer logos." + (lightBg ? " This is a lighter colour, so check the white text is still easy to read." : "")
    });
  }
  // Contrast check: compares each text colour with the chosen background and
  // warns about hard-to-read combinations. Only meaningful where the text sits
  // on the solid background (not over a full-bleed photo). Export is still
  // allowed; this is guidance only.
  if (o.solidBg !== false){
    var bgHex = P[o.bg || ""] || o.bg || P.slate;
    var accentHex = P[acc] || P.amber;
    var tcol = o.textColors || {};
    var checks: Array<{ key: keyof TextColours; label: string; def: string; min: number }> = [
      { key: "title", label: "Title", def: "#ffffff", min: 3 },
      { key: "subtitle", label: "Subtitle", def: accentHex, min: 3 },
      { key: "body", label: "Body text", def: P.light || "#cdd2db", min: 4.5 },
      { key: "caption", label: "Caption", def: accentHex, min: 4.5 }
    ];
    var low: string[] = [];
    checks.forEach(function(ch){
      var col = tcol[ch.key] || ch.def;
      var r = contrastRatio(col, bgHex);
      if (r != null && r < ch.min) low.push(ch.label + " " + r.toFixed(1) + ":1");
    });
    if (low.length){
      notes.push({ tone: "warn", title: "Low colour contrast", body: "Some text may be hard to read on this background: " + low.join(", ") + ". The usual accessibility standard (WCAG AA) wants at least 4.5:1 for body text and 3:1 for large headings. You can still export, but a darker background or a lighter text colour would read more clearly." });
    }
  }
  return notes;
}
