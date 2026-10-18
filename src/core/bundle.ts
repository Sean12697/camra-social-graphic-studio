// Backups: everything the studio stores, or a selection of it, as one file that
// another browser or device can import. The bundle is a ZIP so it stays
// inspectable: manifest.json (format, versions, counts, checksums), one JSON
// file per entity type, and the images under assets/. A plain JSON form of the
// same data (used by the bundled seeds) is accepted too.

import { createZip, readZip } from "./zip.ts";
import { bytesToDataUrl, dataUrlToBytes, extForMime, mimeForName } from "./files.ts";
import { newId, type Design, type LibraryItem } from "./designs.ts";
import { isHm, isYmd } from "./calendar.ts";

export const BUNDLE_FORMAT = "camra-studio-backup";
export const BUNDLE_SCHEMA = 1;

export interface BackupData {
  designs: Design[];
  library: LibraryItem[];
  /** Personal settings and defaults. Only included when asked for. */
  prefs?: Record<string, unknown> | null;
}

export interface BundleManifest {
  format: string;
  schema: number;
  app: string;
  appVersion: string;
  createdAt: string;
  selection: string;
  counts: { designs: number; library: number; prefs: number };
  checksums: Record<string, string>;
}

export interface ReadResult {
  manifest: BundleManifest | null;
  data: BackupData;
  warnings: string[];
}

export type ImportMode = "merge" | "overwrite" | "copies";

export interface ImportPlan {
  designs: { create: number; overwrite: number; skip: number };
  library: { create: number; overwrite: number; skip: number };
  prefs: boolean;
}

const ASSET_PREFIX = "asset:";

async function sha256(bytes: Uint8Array): Promise<string | null> {
  const subtle = typeof crypto !== "undefined" ? crypto.subtle : undefined;
  if (!subtle) return null;
  const buf = await subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

export interface ExportOptions {
  appVersion: string;
  selection: string;
  now?: Date;
}

/** Builds a backup ZIP from the given data. */
export async function exportBundle(data: BackupData, opts: ExportOptions): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const files: Array<{ name: string; data: Uint8Array }> = [];
  const assetFor = (id: string, role: string, url: string | null | undefined): string | null => {
    if (!url) return null;
    if (!url.startsWith("data:")) return url;
    const { mime, bytes } = dataUrlToBytes(url);
    const path = "assets/" + id + "-" + role + "." + extForMime(mime);
    files.push({ name: path, data: bytes });
    return ASSET_PREFIX + path;
  };
  const designs = data.designs.map((d) => ({
    ...d,
    photo: assetFor(d.id, "photo", d.photo),
    logo: assetFor(d.id, "logo", d.logo),
    thumb: assetFor(d.id, "thumb", d.thumb),
  }));
  const library = data.library.map((it) => ({ ...it, dataUrl: assetFor(it.id, it.kind, it.dataUrl) }));
  const json = (v: unknown) => enc.encode(JSON.stringify(v, null, 2) + "\n");
  files.unshift({ name: "designs.json", data: json(designs) }, { name: "library.json", data: json(library) });
  if (data.prefs) files.push({ name: "prefs.json", data: json(data.prefs) });
  const checksums: Record<string, string> = {};
  for (const f of files) {
    const h = await sha256(f.data);
    if (h) checksums[f.name] = h;
  }
  const manifest: BundleManifest = {
    format: BUNDLE_FORMAT,
    schema: BUNDLE_SCHEMA,
    app: "CAMRA Social Graphics Studio",
    appVersion: opts.appVersion,
    createdAt: (opts.now || new Date()).toISOString(),
    selection: opts.selection,
    counts: { designs: designs.length, library: library.length, prefs: data.prefs ? 1 : 0 },
    checksums,
  };
  const date = opts.now || new Date();
  return createZip([{ name: "manifest.json", data: json(manifest), date }, ...files.map((f) => ({ ...f, date }))]);
}

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function str(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

/** Validates and normalises one design record, or returns a reason it was dropped. */
export function cleanDesign(v: unknown): Design | string {
  if (!isObj(v)) return "a design entry is not an object";
  const id = str(v.id);
  const name = str(v.name);
  const params = str(v.params);
  if (!id || !name || params == null) return "a design is missing its id, name or settings";
  const now = new Date().toISOString();
  return {
    id,
    name: name.slice(0, 200),
    typeId: str(v.typeId) || new URLSearchParams(params).get("type") || "custom",
    params,
    photo: str(v.photo),
    logo: str(v.logo),
    thumb: str(v.thumb),
    createdAt: str(v.createdAt) || now,
    updatedAt: str(v.updatedAt) || str(v.createdAt) || now,
    deletedAt: str(v.deletedAt),
    sample: v.sample === true,
    postOn: isYmd(v.postOn) ? v.postOn : null,
    postAt: isYmd(v.postOn) && isHm(v.postAt) ? v.postAt : null,
    postedAt: str(v.postedAt),
    campaign: cleanRef(v.campaign),
    kind: v.kind === "post" || v.kind === "design" ? v.kind : isYmd(v.postOn) ? "post" : "design",
    repeat: isYmd(v.postOn) && (v.repeat === "week" || v.repeat === "month" || v.repeat === "year") ? v.repeat : null,
    repeatUntil: isYmd(v.postOn) && isYmd(v.repeatUntil) && v.repeat ? v.repeatUntil : null,
    postedDays: Array.isArray(v.postedDays) ? v.postedDays.filter(isYmd).slice(0, 1000) : null,
  };
}

function cleanRef(v: unknown): Design["campaign"] {
  if (!isObj(v)) return null;
  const id = str(v.id);
  const draft = str(v.draft);
  const year = typeof v.year === "number" && Number.isInteger(v.year) ? v.year : null;
  return id && draft && year ? { id, draft, year } : null;
}

export function cleanLibraryItem(v: unknown): LibraryItem | string {
  if (!isObj(v)) return "a library entry is not an object";
  const id = str(v.id);
  const dataUrl = str(v.dataUrl);
  const kind = v.kind === "logo" || v.kind === "image" ? v.kind : null;
  if (!id || !dataUrl || !kind) return "a library item is missing its id, kind or image";
  return { id, kind, name: (str(v.name) || (kind === "logo" ? "Logo" : "Photo")).slice(0, 200), dataUrl, createdAt: str(v.createdAt) || undefined };
}

function migrate(schema: number, warnings: string[]): void {
  // Schema 1 is the only version so far. Future schema bumps add steps here,
  // so older backups keep importing.
  if (schema < 1) warnings.push("This backup has an unknown older schema; importing what can be read.");
}

function parseData(raw: Record<string, unknown>, warnings: string[]): BackupData {
  const designs: Design[] = [];
  const library: LibraryItem[] = [];
  (Array.isArray(raw.designs) ? raw.designs : []).forEach((d) => {
    const c = cleanDesign(d);
    if (typeof c === "string") warnings.push("Skipped: " + c + ".");
    else designs.push(c);
  });
  (Array.isArray(raw.library) ? raw.library : []).forEach((d) => {
    const c = cleanLibraryItem(d);
    if (typeof c === "string") warnings.push("Skipped: " + c + ".");
    else library.push(c);
  });
  return { designs, library, prefs: isObj(raw.prefs) ? raw.prefs : null };
}

function checkFormat(format: unknown, schema: unknown): number {
  if (format !== BUNDLE_FORMAT) throw new Error("This file is not a CAMRA Social Graphics Studio backup.");
  const s = typeof schema === "number" ? schema : 0;
  if (s > BUNDLE_SCHEMA) throw new Error("This backup was made by a newer version of the studio. Refresh the page to update, then try again.");
  return s;
}

/** Reads a backup ZIP, or the plain JSON form, validating everything in it. */
export async function readBundle(bytes: Uint8Array): Promise<ReadResult> {
  const warnings: string[] = [];
  const dec = new TextDecoder();
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const files = await readZip(bytes);
    const mf = files.get("manifest.json");
    if (!mf) throw new Error("This ZIP has no manifest.json, so it is not a studio backup.");
    let manifest: BundleManifest;
    try {
      manifest = JSON.parse(dec.decode(mf));
    } catch {
      throw new Error("The backup's manifest.json is not valid JSON.");
    }
    const schema = checkFormat(manifest.format, manifest.schema);
    migrate(schema, warnings);
    for (const [name, sum] of Object.entries(manifest.checksums || {})) {
      const f = files.get(name);
      if (!f) {
        warnings.push(name + " is listed in the manifest but missing.");
        continue;
      }
      const h = await sha256(f);
      if (h && h !== sum) throw new Error(name + " does not match its checksum, so the backup is damaged. Export it again from the original browser.");
    }
    const readJson = (name: string): unknown => {
      const f = files.get(name);
      if (!f) return null;
      try {
        return JSON.parse(dec.decode(f));
      } catch {
        throw new Error(name + " in the backup is not valid JSON.");
      }
    };
    const resolve = (v: unknown): unknown => {
      if (typeof v !== "string" || !v.startsWith(ASSET_PREFIX)) return v;
      const path = v.slice(ASSET_PREFIX.length);
      const f = files.get(path);
      if (!f) {
        warnings.push(path + " is missing from the backup.");
        return null;
      }
      return bytesToDataUrl(f, mimeForName(path));
    };
    const designsRaw = (readJson("designs.json") as unknown[] | null) || [];
    const libraryRaw = (readJson("library.json") as unknown[] | null) || [];
    const raw = {
      designs: designsRaw.map((d) => (isObj(d) ? { ...d, photo: resolve(d.photo), logo: resolve(d.logo), thumb: resolve(d.thumb) } : d)),
      library: libraryRaw.map((d) => (isObj(d) ? { ...d, dataUrl: resolve(d.dataUrl) } : d)),
      prefs: readJson("prefs.json"),
    };
    return { manifest, data: parseData(raw, warnings), warnings };
  }
  let raw: unknown;
  try {
    raw = JSON.parse(dec.decode(bytes));
  } catch {
    throw new Error("This file is not a studio backup (expected a .zip or .json file).");
  }
  if (!isObj(raw)) throw new Error("This file is not a studio backup.");
  const schema = checkFormat(raw.format, raw.schema);
  migrate(schema, warnings);
  return { manifest: null, data: parseData(raw, warnings), warnings };
}

function plan<T extends { id: string }>(existing: T[], incoming: T[], mode: ImportMode) {
  const ids = new Set(existing.map((x) => x.id));
  const p = { create: 0, overwrite: 0, skip: 0 };
  incoming.forEach((x) => {
    if (mode === "copies" || !ids.has(x.id)) p.create++;
    else if (mode === "overwrite") p.overwrite++;
    else p.skip++;
  });
  return p;
}

/** A dry run: what an import would create, overwrite or skip. */
export function planImport(existing: BackupData, incoming: BackupData, mode: ImportMode, includePrefs: boolean): ImportPlan {
  return {
    designs: plan(existing.designs, incoming.designs, mode),
    library: plan(existing.library, incoming.library, mode),
    prefs: includePrefs && !!incoming.prefs,
  };
}

function merge<T extends { id: string }>(existing: T[], incoming: T[], mode: ImportMode, prefix: string): T[] {
  if (mode === "copies") return existing.concat(incoming.map((x) => ({ ...x, id: newId(prefix) })));
  const byId = new Map(existing.map((x) => [x.id, x] as const));
  incoming.forEach((x) => {
    if (!byId.has(x.id) || mode === "overwrite") byId.set(x.id, x);
  });
  return Array.from(byId.values());
}

/** Applies an import, returning the combined data. Nothing is written here. */
export function applyImport(existing: BackupData, incoming: BackupData, mode: ImportMode, includePrefs: boolean): BackupData {
  return {
    designs: merge(existing.designs, incoming.designs, mode, "dsn"),
    library: merge(existing.library, incoming.library, mode, "itm"),
    prefs: includePrefs && incoming.prefs ? { ...(existing.prefs || {}), ...incoming.prefs } : existing.prefs,
  };
}
