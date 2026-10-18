// Everything the studio stores lives in this browser only and is never
// uploaded. Small preferences sit in localStorage (read synchronously at boot,
// so the theme and last choices apply before first paint). Saved designs, the
// content library and the remembered custom logo live in IndexedDB, which has
// far more room than localStorage. Where IndexedDB is unavailable the same API
// falls back to localStorage, as the studio has always used.

import type { Design, LibraryItem } from "../core/designs.ts";

const NS = "camra-studio:";
const DB_NAME = "camra-studio";
const DB_VERSION = 1;
type StoreName = "designs" | "library" | "kv";

function lsRead<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(NS + key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

function lsWrite(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(NS + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function lsRemove(key: string): void {
  try {
    localStorage.removeItem(NS + key);
  } catch {
    /* storage unavailable */
  }
}

interface Backend {
  getAll<T>(store: StoreName): Promise<T[]>;
  put(store: StoreName, value: { id: string }): Promise<void>;
  putMany(store: StoreName, values: Array<{ id: string }>): Promise<void>;
  remove(store: StoreName, ids: string[]): Promise<void>;
  clear(store: StoreName): Promise<void>;
  readonly kind: "indexeddb" | "localstorage";
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Storage transaction aborted"));
  });
}

async function openIdb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") throw new Error("IndexedDB unavailable");
  const open = indexedDB.open(DB_NAME, DB_VERSION);
  open.onupgradeneeded = () => {
    const db = open.result;
    for (const name of ["designs", "library", "kv"]) {
      if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: "id" });
    }
  };
  return req(open);
}

function idbBackend(db: IDBDatabase): Backend {
  return {
    kind: "indexeddb",
    async getAll<T>(store: StoreName) {
      return (await req(db.transaction(store).objectStore(store).getAll())) as T[];
    },
    async put(store, value) {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).put(value);
      await txDone(tx);
    },
    async putMany(store, values) {
      const tx = db.transaction(store, "readwrite");
      const os = tx.objectStore(store);
      values.forEach((v) => os.put(v));
      await txDone(tx);
    },
    async remove(store, ids) {
      const tx = db.transaction(store, "readwrite");
      const os = tx.objectStore(store);
      ids.forEach((id) => os.delete(id));
      await txDone(tx);
    },
    async clear(store) {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).clear();
      await txDone(tx);
    },
  };
}

function lsBackend(): Backend {
  const quota = () => new Error("This browser's storage is full.");
  return {
    kind: "localstorage",
    async getAll<T>(store: StoreName) {
      return lsRead<T[]>("store-" + store, []);
    },
    async put(store, value) {
      const all = lsRead<Array<{ id: string }>>("store-" + store, []).filter((x) => x.id !== value.id);
      all.push(value);
      if (!lsWrite("store-" + store, all)) throw quota();
    },
    async putMany(store, values) {
      const ids = new Set(values.map((v) => v.id));
      const all = lsRead<Array<{ id: string }>>("store-" + store, []).filter((x) => !ids.has(x.id)).concat(values);
      if (!lsWrite("store-" + store, all)) throw quota();
    },
    async remove(store, ids) {
      const drop = new Set(ids);
      lsWrite("store-" + store, lsRead<Array<{ id: string }>>("store-" + store, []).filter((x) => !drop.has(x.id)));
    },
    async clear(store) {
      lsRemove("store-" + store);
    },
  };
}

export type Prefs = Record<string, unknown> & {
  postType?: string;
  branch?: string;
  customName?: string;
  presets?: string[];
  theme?: "dark" | "light" | "system";
  downloadFormat?: "png" | "zip";
  styleDefaults?: string;
  groups?: Record<string, boolean>;
};

let backend: Backend = lsBackend();
let designs: Design[] = [];
let library: LibraryItem[] = [];
let customLogo: string | null = null;

/** Opens storage, migrating anything an earlier version kept in localStorage. */
export async function initStore(): Promise<void> {
  try {
    backend = idbBackend(await openIdb());
  } catch {
    backend = lsBackend();
  }
  designs = await backend.getAll<Design>("designs");
  library = await backend.getAll<LibraryItem>("library");
  const kv = await backend.getAll<{ id: string; value: unknown }>("kv");
  const logo = kv.find((x) => x.id === "customLogo");
  customLogo = logo && typeof logo.value === "string" ? logo.value : null;

  if (backend.kind === "indexeddb") {
    // Earlier versions kept the library and the remembered logo in localStorage.
    const legacy = lsRead<LibraryItem[]>("library", []);
    if (legacy.length) {
      const known = new Set(library.map((i) => i.id));
      const fresh = legacy.filter((i) => i && i.id && !known.has(i.id));
      try {
        await backend.putMany("library", fresh);
        library = library.concat(fresh);
        lsRemove("library");
      } catch {
        /* keep the legacy copy until a later visit succeeds */
      }
    }
    const p = lsRead<Prefs>("prefs", {});
    if (typeof p.customLogo === "string") {
      try {
        await backend.put("kv", { id: "customLogo", value: p.customLogo } as { id: string });
        customLogo = p.customLogo;
        delete p.customLogo;
        lsWrite("prefs", p);
      } catch {
        /* retry next visit */
      }
    }
  }
}

export const store = {
  get kind() {
    return backend.kind;
  },

  getPrefs(): Prefs {
    return lsRead<Prefs>("prefs", {});
  },
  setPref(key: string, value: unknown): boolean {
    const p = lsRead<Prefs>("prefs", {});
    if (value === undefined) delete p[key];
    else p[key] = value;
    return lsWrite("prefs", p);
  },
  replacePrefs(p: Prefs): boolean {
    return lsWrite("prefs", p);
  },
  tipsSeen(): boolean {
    return lsRead("tipsSeen", false);
  },
  setTipsSeen(v: boolean): void {
    lsWrite("tipsSeen", v);
  },

  getCustomLogo(): string | null {
    return customLogo;
  },
  async setCustomLogo(dataUrl: string | null): Promise<boolean> {
    try {
      if (dataUrl) await backend.put("kv", { id: "customLogo", value: dataUrl } as { id: string });
      else await backend.remove("kv", ["customLogo"]);
      customLogo = dataUrl;
      return true;
    } catch {
      return false;
    }
  },

  getLibrary(): LibraryItem[] {
    return library.slice();
  },
  /** Returns false when the write failed (usually a full quota). */
  async putLibrary(items: LibraryItem[]): Promise<boolean> {
    try {
      await backend.putMany("library", items);
      const ids = new Set(items.map((i) => i.id));
      library = library.filter((i) => !ids.has(i.id)).concat(items);
      return true;
    } catch {
      return false;
    }
  },
  async removeLibrary(ids: string[]): Promise<void> {
    await backend.remove("library", ids);
    const drop = new Set(ids);
    library = library.filter((i) => !drop.has(i.id));
  },

  getDesigns(): Design[] {
    return designs.slice();
  },
  getDesign(id: string): Design | undefined {
    return designs.find((d) => d.id === id);
  },
  async putDesigns(items: Design[]): Promise<boolean> {
    try {
      await backend.putMany("designs", items);
      const ids = new Set(items.map((i) => i.id));
      designs = designs.filter((d) => !ids.has(d.id)).concat(items);
      return true;
    } catch {
      return false;
    }
  },
  async removeDesigns(ids: string[]): Promise<void> {
    await backend.remove("designs", ids);
    const drop = new Set(ids);
    designs = designs.filter((d) => !drop.has(d.id));
  },

  /** Wipes everything the studio has stored in this browser. */
  async clearAll(): Promise<void> {
    await backend.clear("designs");
    await backend.clear("library");
    await backend.clear("kv");
    designs = [];
    library = [];
    customLogo = null;
    ["library", "prefs", "tipsSeen", "store-designs", "store-library", "store-kv"].forEach(lsRemove);
  },

  async estimate(): Promise<{ usage: number; quota: number } | null> {
    try {
      if (!navigator.storage || !navigator.storage.estimate) return null;
      const e = await navigator.storage.estimate();
      return { usage: e.usage || 0, quota: e.quota || 0 };
    } catch {
      return null;
    }
  },
  async persisted(): Promise<boolean | null> {
    try {
      return navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : null;
    } catch {
      return null;
    }
  },
  async persist(): Promise<boolean> {
    try {
      return navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false;
    } catch {
      return false;
    }
  },
};
