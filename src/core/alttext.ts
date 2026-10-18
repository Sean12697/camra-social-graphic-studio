// Plain-language alt text for a graphic, built from the same layout model the
// renderer draws. Social platforms ask for alt text on every image; this gives
// volunteers an accurate starting point they can paste and tweak.

import type { Branch } from "./config.ts";
import type { Layout } from "./templates.ts";

function sentenceCase(s: string): string {
  const t = s.trim();
  if (!t) return "";
  if (t !== t.toUpperCase()) return t;
  const lower = t.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function sentence(s: string | undefined): string {
  const t = (s || "").trim().replace(/\s+/g, " ");
  if (!t) return "";
  return /[.!?]$/.test(t) ? t : t + ".";
}

export interface AltTextInput {
  layout: Layout;
  branch: Branch;
  templateLabel: string;
  hasPhoto: boolean;
  caption?: string;
  tagline?: string;
  logo: "branch" | "camra";
}

export function altText(i: AltTextInput): string {
  const l = i.layout || {};
  const kind = i.templateLabel.replace(/\s*\(.*\)\s*$/, "");
  const parts: string[] = [];
  parts.push(sentence(i.branch.name + " social graphic: " + kind + (i.hasPhoto ? ", with a photo" : "")));
  if (l.eyebrow && l.eyebrow.trim().toLowerCase() !== kind.trim().toLowerCase()) parts.push(sentence(sentenceCase(l.eyebrow)));
  if (l.title) parts.push(sentence(l.title));
  if (l.subtitle) parts.push(sentence(l.subtitle));
  (l.lines || []).forEach((line) => parts.push(sentence(line)));
  const items = (l.list || []).filter((it) => it.primary || it.secondary);
  if (items.length) {
    parts.push(sentence(items.map((it) => [it.primary, it.secondary].filter(Boolean).join(", ")).join("; ")));
  }
  const cap = i.caption != null ? i.caption : l.footer;
  if (cap) parts.push(sentence(cap));
  parts.push(sentence((i.logo === "camra" ? "CAMRA logo" : i.branch.name + " logo") + (i.tagline ? ', with the tagline "' + i.tagline + '"' : "")));
  return parts.filter(Boolean).join(" ");
}
