// Local database: all app data (habits, logs, sleep, tracks, alarms, profile, backup info) lives in IndexedDB.
// Reads are instant (kept in memory after start-up) and writes go to IndexedDB right away.
// localStorage is used only if IndexedDB cannot open, and old localStorage data is moved over once.
const DB = "lifearc", ST = "kv", PREFIX = ["winterArc:", "la:"];
const mem = new Map(), queue = new Map();
let db = null, timer = null, started = null;

const openDb = () => new Promise((res, rej) => {
  if (typeof indexedDB === "undefined") return rej(new Error("no indexedDB"));
  const t = setTimeout(() => rej(new Error("indexedDB timeout")), 4000);
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(ST)) r.result.createObjectStore(ST); };
  r.onsuccess = () => { clearTimeout(t); res(r.result); };
  r.onerror = () => { clearTimeout(t); rej(r.error); };
});
const readAll = (d) => new Promise((res, rej) => {
  const tx = d.transaction(ST, "readonly"), os = tx.objectStore(ST), k = os.getAllKeys(), v = os.getAll();
  tx.oncomplete = () => res(k.result.map((key, i) => [key, v.result[i]]));
  tx.onerror = tx.onabort = () => rej(tx.error);
});
const writeMany = (d, rows) => new Promise((res, rej) => {
  const tx = d.transaction(ST, "readwrite"), os = tx.objectStore(ST);
  rows.forEach(([k, v]) => (v == null ? os.delete(k) : os.put(v, k)));
  tx.oncomplete = () => res();
  tx.onerror = tx.onabort = () => rej(tx.error);
});

export function flush() {
  clearTimeout(timer); timer = null;
  if (!db || !queue.size) return Promise.resolve();
  const rows = [...queue]; queue.clear();
  return writeMany(db, rows).catch(() => {
    rows.forEach(([k, v]) => { if (!queue.has(k)) queue.set(k, v); }); // keep it and try again
    schedule(1500);
  });
}
const schedule = (ms = 60) => { if (timer == null) timer = setTimeout(flush, ms); };

export function ready() {
  if (started) return started;
  started = (async () => {
    const ls = [];
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && PREFIX.some((p) => k.startsWith(p))) ls.push(k); } } catch { /* blocked */ }
    try {
      db = await openDb();
      (await readAll(db)).forEach(([k, v]) => mem.set(k, v));
      const todo = ls.filter((k) => !mem.has(k)).map((k) => [k, localStorage.getItem(k)]).filter(([, v]) => v != null);
      if (todo.length) { await writeMany(db, todo); todo.forEach(([k, v]) => mem.set(k, v)); }
      ls.forEach((k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } }); // now safely in IndexedDB
      try { navigator.storage?.persist?.(); } catch { /* ignore */ } // ask Android not to clear it when space is low
    } catch {
      db = null; // fall back to localStorage
      ls.forEach((k) => { try { mem.set(k, localStorage.getItem(k)); } catch { /* ignore */ } });
    }
  })();
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
  return started;
}

export const get = (k) => (mem.has(k) ? mem.get(k) : null);
export function set(k, v) {
  mem.set(k, v); queue.set(k, v);
  if (db) schedule(); else { try { localStorage.setItem(k, v); } catch { /* ignore */ } }
}
export function remove(k) {
  mem.delete(k); queue.set(k, null);
  if (db) schedule(); else { try { localStorage.removeItem(k); } catch { /* ignore */ } }
}
