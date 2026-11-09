/**
 * Clears what this app keeps in this browser, for this origin only, and keeps
 * the few records that say WHICH DEVICE this is.
 *
 * Plan item 10.8. Every step is independent and none of them throws: a step
 * the browser does not support (no Cache Storage over http, no
 * `indexedDB.databases()` on an old Firefox) is skipped and the rest still
 * run, so the reload that follows always happens.
 *
 * What it does NOT touch: cookies (the apps keep none of their own - the
 * session is in sessionStorage) and the HTTP cache, which a page cannot clear;
 * in the till's Electron shell the main process clears that one (see
 * `env.electron`).
 */

/** Records of one IndexedDB store to keep. The database itself survives. */
export interface KeepIdb {
  db: string;
  store: string;
  keys: string[];
}

export interface ClearSiteDataOptions {
  /** `window.localStorage` keys whose values are put back after the clear. */
  keepLocalKeys?: string[];
  /** IndexedDB records to keep; everything else in those stores goes. */
  keepIdb?: KeepIdb[];
}

/** Where to clear. Defaults to the real browser; tests pass fakes. */
export interface ClearSiteDataEnv {
  local?: Storage | null;
  session?: Storage | null;
  idb?: IDBFactory | null;
  caches?: CacheStorage | null;
  sw?: ServiceWorkerContainer | null;
  /** The till's Electron preload (`window.apexSession`); absent in a browser. */
  electron?: { clearCache?: () => Promise<unknown> } | null;
}

export interface ClearSiteDataReport {
  localRemoved: number;
  localKept: string[];
  sessionRemoved: number;
  idbDeleted: string[];
  idbTrimmed: string[];
  caches: string[];
  workers: number;
  electron: boolean;
  errors: string[];
}

export function browserEnv(): ClearSiteDataEnv {
  const w: any = typeof window === 'undefined' ? {} : window;
  const safe = <T>(get: () => T): T | null => {
    try { return get() ?? null; } catch { return null; }
  };
  return {
    local: safe(() => w.localStorage),
    session: safe(() => w.sessionStorage),
    idb: safe(() => w.indexedDB),
    caches: safe(() => w.caches),
    sw: safe(() => w.navigator?.serviceWorker),
    electron: safe(() => w.apexSession),
  };
}

export async function clearSiteData(
  options: ClearSiteDataOptions = {},
  env: ClearSiteDataEnv = browserEnv(),
): Promise<ClearSiteDataReport> {
  const report: ClearSiteDataReport = {
    localRemoved: 0, localKept: [], sessionRemoved: 0, idbDeleted: [], idbTrimmed: [],
    caches: [], workers: 0, electron: false, errors: [],
  };
  const step = async (name: string, run: () => unknown) => {
    try { await run(); } catch (e: any) { report.errors.push(`${name}: ${e?.message ?? e}`); }
  };

  await step('localStorage', () => {
    const local = env.local;
    if (!local) return;
    const kept: [string, string][] = [];
    for (const key of options.keepLocalKeys ?? []) {
      const value = local.getItem(key);
      if (value !== null) kept.push([key, value]);
    }
    report.localRemoved = local.length - kept.length;
    local.clear();
    for (const [key, value] of kept) local.setItem(key, value);
    report.localKept = kept.map(([key]) => key);
  });

  await step('sessionStorage', () => {
    if (!env.session) return;
    report.sessionRemoved = env.session.length;
    env.session.clear();
  });

  await step('indexedDB', async () => {
    const idb = env.idb;
    if (!idb) return;
    const keep = options.keepIdb ?? [];
    for (const spec of keep) {
      if (await trimStore(idb, spec)) report.idbTrimmed.push(spec.db);
    }
    // Not every browser can list its databases (Firefox before 126): then only
    // the kept ones above are cleaned, which is where the app's data lives.
    const listed = typeof idb.databases === 'function' ? await idb.databases() : [];
    for (const { name } of listed) {
      if (!name || keep.some((k) => k.db === name)) continue;
      await deleteDb(idb, name);
      report.idbDeleted.push(name);
    }
  });

  await step('caches', async () => {
    if (!env.caches) return;
    for (const name of await env.caches.keys()) {
      await env.caches.delete(name);
      report.caches.push(name);
    }
  });

  await step('serviceWorker', async () => {
    if (!env.sw?.getRegistrations) return;
    for (const registration of await env.sw.getRegistrations()) {
      if (await registration.unregister()) report.workers++;
    }
  });

  await step('electron', async () => {
    if (typeof env.electron?.clearCache !== 'function') return;
    await env.electron.clearCache();
    report.electron = true;
  });

  return report;
}

/** Deletes every record of `spec.store` except `spec.keys`. False when the store is not there. */
function trimStore(idb: IDBFactory, spec: KeepIdb): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const open = idb.open(spec.db);
    // The database did not exist: do not leave an empty one behind.
    open.onupgradeneeded = () => open.transaction?.abort();
    open.onerror = () => resolve(false);
    open.onsuccess = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains(spec.store)) {
        db.close();
        resolve(false);
        return;
      }
      const tx = db.transaction(spec.store, 'readwrite');
      const cursor = tx.objectStore(spec.store).openCursor();
      cursor.onsuccess = () => {
        const c = cursor.result;
        if (!c) return;
        if (!spec.keys.includes(String(c.key))) c.delete();
        c.continue();
      };
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    };
  });
}

/**
 * Resolves when the delete is done or queued: a connection the app still has
 * open "blocks" it until that connection closes, which the reload does.
 */
function deleteDb(idb: IDBFactory, name: string): Promise<void> {
  return new Promise((resolve) => {
    const request = idb.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}
