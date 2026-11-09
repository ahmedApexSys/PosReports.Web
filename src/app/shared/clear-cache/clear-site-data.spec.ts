import { clearSiteData } from './clear-site-data';
import { CLEAR_CACHE_KEEP } from './clear-cache-button.component';

class FakeStorage implements Storage {
  private map = new Map<string, string>();
  constructor(init: Record<string, string> = {}) {
    Object.entries(init).forEach(([k, v]) => this.map.set(k, v));
  }
  get length() { return this.map.size; }
  clear() { this.map.clear(); }
  getItem(key: string) { return this.map.has(key) ? this.map.get(key)! : null; }
  key(i: number) { return [...this.map.keys()][i] ?? null; }
  removeItem(key: string) { this.map.delete(key); }
  setItem(key: string, value: string) { this.map.set(key, String(value)); }
  keys() { return [...this.map.keys()]; }
}

function fakeCaches(names: string[]) {
  const left = new Set(names);
  return {
    left,
    api: {
      keys: async () => [...left],
      delete: async (n: string) => left.delete(n),
    } as unknown as CacheStorage,
  };
}

function fakeWorkers(count: number) {
  let unregistered = 0;
  const regs = Array.from({ length: count }, () => ({ unregister: async () => { unregistered++; return true; } }));
  return {
    get unregistered() { return unregistered; },
    api: { getRegistrations: async () => regs } as unknown as ServiceWorkerContainer,
  };
}

describe('clearSiteData (Clear cache on the login screen)', () => {
  it('empties localStorage but puts back the device id', async () => {
    const local = new FakeStorage({
      'pos-reports.machineId': 'web-abc',
      'Apex-profile': '{"user":1}',
      'Apex-theme': 'dark',
      appLang: 'ar',
    });
    const report = await clearSiteData(CLEAR_CACHE_KEEP, { local });
    expect(local.keys()).toEqual(['pos-reports.machineId']);
    expect(local.getItem('pos-reports.machineId')).toBe('web-abc');
    expect(report.localRemoved).toBe(3);
    expect(report.localKept).toEqual(['pos-reports.machineId']);
  });

  it('does not invent a kept key that was not there', async () => {
    const local = new FakeStorage({ other: '1' });
    await clearSiteData(CLEAR_CACHE_KEEP, { local });
    expect(local.length).toBe(0);
  });

  it('empties sessionStorage completely (token, refresh, roles)', async () => {
    const session = new FakeStorage({ 'Apex-token': 't', 'Apex-refresh': 'r', 'Apex-MachineId': 'x' });
    const report = await clearSiteData(CLEAR_CACHE_KEEP, { session });
    expect(session.length).toBe(0);
    expect(report.sessionRemoved).toBe(3);
  });

  it('deletes every Cache Storage cache, unregisters service workers and asks Electron to clear', async () => {
    const caches = fakeCaches(['ngsw:1:assets', 'ngsw:1:data']);
    const sw = fakeWorkers(2);
    let electronCalls = 0;
    const report = await clearSiteData(CLEAR_CACHE_KEEP, {
      caches: caches.api,
      sw: sw.api,
      electron: { clearCache: async () => { electronCalls++; } },
    });
    expect(caches.left.size).toBe(0);
    expect(report.caches).toEqual(['ngsw:1:assets', 'ngsw:1:data']);
    expect(sw.unregistered).toBe(2);
    expect(report.workers).toBe(2);
    expect(electronCalls).toBe(1);
    expect(report.electron).toBe(true);
  });

  it('a failing step is reported and the others still run', async () => {
    const local = new FakeStorage({ a: '1' });
    const report = await clearSiteData(CLEAR_CACHE_KEEP, {
      local,
      caches: { keys: async () => { throw new Error('denied'); } } as unknown as CacheStorage,
      sw: fakeWorkers(1).api,
    });
    expect(local.length).toBe(0);
    expect(report.workers).toBe(1);
    expect(report.errors.length).toBe(1);
    expect(report.errors[0]).toContain('caches');
  });

  it('runs with nothing available (old browser, http origin)', async () => {
    const report = await clearSiteData(CLEAR_CACHE_KEEP, {});
    expect(report.errors).toEqual([]);
  });

  // Real IndexedDB: present in the Karma browser, absent under jsdom.
  const idbAvailable = typeof indexedDB !== 'undefined';

  function put(db: string, store: string, records: Record<string, unknown>): Promise<void> {
    return new Promise((resolve, reject) => {
      const open = indexedDB.open(db);
      open.onupgradeneeded = () => open.result.createObjectStore(store);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const tx = open.result.transaction(store, 'readwrite');
        Object.entries(records).forEach(([k, v]) => tx.objectStore(store).put(v, k));
        tx.oncomplete = () => { open.result.close(); resolve(); };
      };
    });
  }

  it('deletes every IndexedDB database of the app', async () => {
    if (!idbAvailable || typeof indexedDB.databases !== 'function') return;
    await put('apex-spec-other', 'things', { x: 1 });
    const report = await clearSiteData(CLEAR_CACHE_KEEP, { idb: indexedDB });
    expect(report.idbDeleted).toContain('apex-spec-other');
    const names = (await indexedDB.databases()).map((d) => d.name);
    expect(names).not.toContain('apex-spec-other');
  });
});
