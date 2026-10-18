// The studio's IndexedDB database, shared by the page (store.ts) and the
// service worker (background campaign reminders). Both must open it the same
// way: opening it anywhere without creating the stores would leave the page
// with an empty, unusable database.

export const DB_NAME = "camra-studio";
export const DB_VERSION = 1;
export type StoreName = "designs" | "library" | "kv";

export function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Storage transaction aborted"));
  });
}

export async function openIdb(): Promise<IDBDatabase> {
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

/** Reads one key from the kv store. */
export async function kvGet<T>(db: IDBDatabase, id: string): Promise<T | undefined> {
  const row = (await req(db.transaction("kv").objectStore("kv").get(id))) as { id: string; value: T } | undefined;
  return row ? row.value : undefined;
}

export async function kvPut(db: IDBDatabase, id: string, value: unknown): Promise<void> {
  const tx = db.transaction("kv", "readwrite");
  tx.objectStore("kv").put({ id, value });
  await txDone(tx);
}
