// Site configuration: brand palette, taglines, the CAMRA logo and the
// branches, built from the logo catalogue. Anyone else can pick Custom in the
// app and upload their own branch logo.

import { BRANCH_LOGOS, shortName } from "./logos.ts";

export const PALETTE = {
  slate: "#41495a",
  amber: "#f9b13c",
  aqua: "#00b3c4",
  tango: "#eb5b25",
  lilac: "#9d4a96",
  blue: "#5b6fb3",
  emerald: "#60bb9b",
  watermelon: "#e8335e",
  gold: "#e4b53d",
  silver: "#b7bdc7",
  bronze: "#c77b3e",
  white: "#ffffff",
  light: "#cdd2db",
} as const;

export type PaletteKey = keyof typeof PALETTE;

/** Look up a palette key, returning undefined for anything else. */
export function paletteHex(key: string | null | undefined): string | undefined {
  if (!key) return undefined;
  return Object.prototype.hasOwnProperty.call(PALETTE, key) ? PALETTE[key as PaletteKey] : undefined;
}

export interface Branch {
  name: string;
  short: string;
  logo?: string;
  custom?: boolean;
}

/** The two approved CAMRA taglines (Brand Guidelines p.16). */
export const TAGLINES = ["Pubs, Pints, People.", "Campaigning for pubs, pints and people since 1971"] as const;

export const CONFIG = {
  defaultBranch: "central-manchester",
  camraLogo: "assets/logos/camra-white.png",
  tagline: TAGLINES[0] as string,
  credit: { name: "Sean O'Mahoney", url: "https://seanomahoney.com" },
  palette: PALETTE,
  // Every branch in the logo catalogue, keyed by id. "Central Manchester" is
  // always capitalised (branch house rule).
  branches: Object.fromEntries(
    BRANCH_LOGOS.map((b) => [b.id, { name: shortName(b.name) + " CAMRA", short: shortName(b.name), logo: b.logo }]),
  ) as Record<string, Branch>,
};

/** The palette keys offered in the colour dropdowns, in display order. */
export const TEXT_COLOUR_KEYS = ["white", "light", "slate", "amber", "aqua", "tango", "lilac", "blue", "emerald", "watermelon"] as const;
export const BACKGROUND_KEYS = ["slate", "blue", "lilac", "tango", "aqua", "emerald", "amber", "watermelon"] as const;
