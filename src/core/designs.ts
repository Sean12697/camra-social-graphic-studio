// The saved-design model and the pure list operations behind the Designs panel.
// A design is the whole form captured as the same query string a share link
// uses, plus any uploaded images (which cannot travel in a link) and a small
// preview thumbnail. Reusing the link format means one serialiser serves share
// links, saved designs and backups alike.

export interface Design {
  id: string;
  name: string;
  /** Post type id, kept alongside params for filtering without parsing. */
  typeId: string;
  /** The form as a query string, exactly as a share link would carry it. */
  params: string;
  /** Data URL of an uploaded photo. Photos from URLs live in params instead. */
  photo?: string | null;
  /** Data URL of an uploaded custom branch logo. */
  logo?: string | null;
  /** Small JPEG preview as a data URL. */
  thumb?: string | null;
  createdAt: string;
  updatedAt: string;
  /** Set when the design is in Recently deleted. */
  deletedAt?: string | null;
  /** True for the bundled sample designs. */
  sample?: boolean;
  /** Content calendar: the day to post it (YYYY-MM-DD), if planned. */
  postOn?: string | null;
  /** Content calendar: the time to post it (HH:MM, local), optional. */
  postAt?: string | null;
  /** Content calendar: when it was marked as posted. */
  postedAt?: string | null;
  /** The campaign draft it was planned from, if any. */
  campaign?: { id: string; year: number; draft: string } | null;
}

export interface LibraryItem {
  id: string;
  kind: "logo" | "image";
  name: string;
  dataUrl: string;
  createdAt?: string;
}

/** Days a deleted design stays in Recently deleted before it is purged. */
export const TRASH_DAYS = 30;

export type DesignSort = "updated" | "created" | "name" | "planned";
export type PlanFilter = "" | "planned" | "unplanned" | "posted";

export interface DesignQuery {
  q?: string;
  type?: string;
  plan?: PlanFilter;
  sort?: DesignSort;
  trash?: boolean;
}

export function newId(prefix: string): string {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.round(Math.random() * 1e8).toString(36);
  return prefix + "-" + Date.now().toString(36) + "-" + rnd;
}

function norm(s: string): string {
  return String(s || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Text a design matches against: its name plus the readable form values. */
export function searchText(d: Design): string {
  let vals = "";
  try {
    new URLSearchParams(d.params).forEach((v) => {
      vals += " " + v;
    });
  } catch {
    /* malformed params still match on name */
  }
  return norm(d.name + " " + vals);
}

export function queryDesigns(list: Design[], q: DesignQuery = {}): Design[] {
  const words = norm(q.q || "").split(/\s+/).filter(Boolean);
  const out = list.filter((d) => {
    if (!!d.deletedAt !== !!q.trash) return false;
    if (q.type && d.typeId !== q.type) return false;
    if (q.plan === "planned" && (!d.postOn || d.postedAt)) return false;
    if (q.plan === "unplanned" && d.postOn) return false;
    if (q.plan === "posted" && !d.postedAt) return false;
    if (!words.length) return true;
    const hay = searchText(d);
    return words.every((w) => hay.includes(w));
  });
  const sort = q.sort || "updated";
  out.sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });
    if (sort === "created") return b.createdAt.localeCompare(a.createdAt);
    if (sort === "planned") return (a.postOn || "9999").localeCompare(b.postOn || "9999") || (a.postAt || "99").localeCompare(b.postAt || "99") || b.updatedAt.localeCompare(a.updatedAt);
    return b.updatedAt.localeCompare(a.updatedAt);
  });
  return out;
}

/** "Name (copy)", then "Name (copy 2)" and so on, avoiding existing names. */
export function copyName(name: string, existing: string[]): string {
  const base = name.replace(/\s*\(copy(?: \d+)?\)$/, "");
  const taken = new Set(existing);
  let candidate = base + " (copy)";
  for (let n = 2; taken.has(candidate); n++) candidate = base + " (copy " + n + ")";
  return candidate;
}

export function duplicateDesign(d: Design, existing: Design[], now: Date = new Date()): Design {
  const iso = now.toISOString();
  return {
    ...d,
    id: newId("dsn"),
    name: copyName(d.name, existing.map((x) => x.name)),
    createdAt: iso,
    updatedAt: iso,
    deletedAt: null,
    sample: false,
    postedAt: null,
  };
}

/** Removes designs that have sat in Recently deleted for longer than TRASH_DAYS. */
export function purgeExpired(list: Design[], now: Date = new Date(), days: number = TRASH_DAYS): { kept: Design[]; purged: number } {
  const cutoff = now.getTime() - days * 86400000;
  const kept = list.filter((d) => !d.deletedAt || Date.parse(d.deletedAt) > cutoff);
  return { kept, purged: list.length - kept.length };
}

/** A sensible default name for a new design from its layout title. */
export function defaultDesignName(title: string | undefined, typeLabel: string): string {
  const t = (title || "").trim();
  const kind = typeLabel.replace(/\s*\(.*\)\s*$/, "");
  return t ? kind + ": " + t : kind;
}
