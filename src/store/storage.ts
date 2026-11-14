/**
 * Adaptador de persistencia.
 *
 * Estrategia: IndexedDB como almacén principal (sin límite práctico de 5 MB) y
 * localStorage como espejo/fallback (Safari privado, navegadores viejos).
 * Las escrituras se agrupan para no golpear el disco en cada tecla.
 *
 * Para migrar a Supabase: implementar `StateStorage` con la misma interfaz
 * (`getItem` / `setItem` / `removeItem`) apuntando a una fila por usuario y
 * pasar ese adaptador a `createJSONStorage` en `store.ts`.
 */
import type { StateStorage } from 'zustand/middleware';

const DB_NAME = 'personal-lifestyle-os';
const DB_VERSION = 1;
const OBJECT_STORE = 'kv';
const LS_KEY = 'plos-data-v1';

let dbPromise: Promise<IDBDatabase | null> | null = null;

const openDB = (): Promise<IDBDatabase | null> => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(OBJECT_STORE)) db.createObjectStore(OBJECT_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
};

const idbGet = async (key: string): Promise<string | null> => {
  const db = await openDB();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(OBJECT_STORE, 'readonly');
      const req = tx.objectStore(OBJECT_STORE).get(key);
      req.onsuccess = () => resolve(typeof req.result === 'string' ? req.result : null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
};

const idbSet = async (key: string, value: string): Promise<boolean> => {
  const db = await openDB();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(OBJECT_STORE, 'readwrite');
      tx.objectStore(OBJECT_STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
};

const idbDelete = async (key: string): Promise<void> => {
  const db = await openDB();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(OBJECT_STORE, 'readwrite');
      tx.objectStore(OBJECT_STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
};

/* ------------------------------------------------------ escritura agrupada */

let pending: { key: string; value: string } | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

const flush = () => {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!pending) return;
  const { key, value } = pending;
  pending = null;
  void idbSet(key, value).then((ok) => {
    if (!ok) {
      try {
        localStorage.setItem(key, value);
      } catch {
        /* cuota agotada: se avisa en la UI vía exportación */
      }
    }
  });
};

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}

export const flushPendingWrites = flush;

/* ---------------------------------------------------------------- adaptador */

export const appStorage: StateStorage = {
  getItem: async (name) => {
    // Si hay una escritura en vuelo, se usa esa copia (más reciente).
    if (pending && pending.key === name) return pending.value;
    const fromIdb = await idbGet(name);
    if (fromIdb) return fromIdb;
    try {
      return localStorage.getItem(LS_KEY) ?? localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    pending = { key: name, value };
    // Espejo inmediato en localStorage: barato y a prueba de cierres bruscos.
    try {
      localStorage.setItem(LS_KEY, value);
    } catch {
      /* sin espacio: IndexedDB sigue siendo la fuente principal */
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, 300);
  },
  removeItem: async (name) => {
    pending = null;
    await idbDelete(name);
    try {
      localStorage.removeItem(LS_KEY);
      localStorage.removeItem(name);
    } catch {
      /* noop */
    }
  },
};

/** Flush inmediato (se usa antes de exportar o borrar todo). */
export const forceFlush = (): void => flush();
