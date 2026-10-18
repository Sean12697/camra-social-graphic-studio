// The logo catalogue: every CAMRA branch, region and sub-brand logo the studio
// offers, from assets/logos/catalogue.json. Entries without a file fall back
// to a text wordmark until a logo is added with scripts/import-logos.py.

import catalogue from "../../assets/logos/catalogue.json" with { type: "json" };

export type LogoCategory = "branch" | "region" | "subBrand";

export interface LogoEntry {
  id: string;
  /** The name as written on the logo, for example "Central Manchester". */
  name: string;
  category: LogoCategory;
  /** Path to the full-size white PNG, relative to the site root. */
  logo?: string;
  /** Path to a 240px preview. */
  thumb?: string;
}

interface RawEntry {
  id: string;
  name: string;
  file?: string;
  thumb?: string;
}

const BASE = "assets/logos/";

function entries(list: RawEntry[], category: LogoCategory): LogoEntry[] {
  return list.map((e) => ({
    id: e.id,
    name: e.name,
    category,
    logo: e.file ? BASE + e.file : undefined,
    thumb: e.thumb ? BASE + e.thumb : e.file ? BASE + e.file : undefined,
  }));
}

export const BRANCH_LOGOS: LogoEntry[] = entries(catalogue.branches, "branch");
export const REGION_LOGOS: LogoEntry[] = entries(catalogue.regions, "region");
export const SUB_BRAND_LOGOS: LogoEntry[] = entries(catalogue.subBrands, "subBrand");

export function findLogo(list: LogoEntry[], id: string | null | undefined): LogoEntry | undefined {
  return id ? list.find((e) => e.id === id) : undefined;
}

/** The name without a parenthetical such as "(sub-branch)", for short labels. */
export function shortName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, "");
}

function norm(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Matches every word of the query against a logo's name, ignoring accents, case and "&" versus "and". */
export function searchLogos(list: LogoEntry[], q: string): LogoEntry[] {
  const words = norm(q).split(" ").filter(Boolean);
  if (!words.length) return list;
  return list.filter((e) => {
    const hay = norm(e.name);
    return words.every((w) => hay.includes(w));
  });
}
