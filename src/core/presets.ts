// Platform and size presets. Tick any number of these in the app to export the
// same post at several dimensions at once. Add or edit freely.

export interface Preset {
  id: string;
  platform: string;
  label: string;
  w: number;
  h: number;
  defaultOn?: boolean;
}

export const PRESETS: Preset[] = [
  { id: "ig-square", platform: "Instagram", label: "Instagram square (1:1)", w: 1080, h: 1080, defaultOn: true },
  { id: "ig-portrait", platform: "Instagram", label: "Instagram portrait (4:5)", w: 1080, h: 1350 },
  { id: "ig-story", platform: "Instagram", label: "Instagram story (9:16)", w: 1080, h: 1920 },
  { id: "fb-square", platform: "Facebook", label: "Facebook square (1:1)", w: 1080, h: 1080 },
  { id: "fb-landscape", platform: "Facebook", label: "Facebook landscape (1.91:1)", w: 1200, h: 628 },
  { id: "fb-story", platform: "Facebook", label: "Facebook story (9:16)", w: 1080, h: 1920 },
  { id: "x-landscape", platform: "Twitter/X", label: "Twitter/X landscape (16:9)", w: 1600, h: 900 },
  { id: "x-square", platform: "Twitter/X", label: "Twitter/X square (1:1)", w: 1080, h: 1080 },
  { id: "bsky", platform: "Bluesky", label: "Bluesky (1.91:1)", w: 1200, h: 628 },
  { id: "linkedin", platform: "LinkedIn", label: "LinkedIn (1.91:1)", w: 1200, h: 627 },
  { id: "camra-event", platform: "CAMRA Events", label: "CAMRA Events website (4:3)", w: 1440, h: 1080 },
];

export type Orientation = "as" | "landscape" | "portrait";

/**
 * A preset's dimensions adjusted for the chosen output orientation.
 * "landscape" and "portrait" swap width and height when needed; square sizes
 * and the default "as listed" setting are returned unchanged.
 */
export function orientDims(p: { w: number; h: number }, o: string): { w: number; h: number } {
  if (o === "landscape" && p.h > p.w) return { w: p.h, h: p.w };
  if (o === "portrait" && p.w > p.h) return { w: p.h, h: p.w };
  return { w: p.w, h: p.h };
}

export function presetById(id: string | null | undefined): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}
