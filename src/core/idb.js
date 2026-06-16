// IndexedDB 封裝：以 idb 套件為骨幹
// Phase 1 目標：把 v23 localStorage 資料搬進來，後續用物件庫取代字串

import { openDB } from 'idb';

const DB_NAME = 'local_brain_db';
const DB_VERSION = 1;

export const STORES = {
  notes: 'notes',          // { id, title, content, links, pinned, history, updatedAtTs, ... }
  meta: 'meta',            // { key, value } — deviceId, lastSyncAt, lastMigration
  legacy: 'legacy',        // 保留 30 天的 localStorage 備份（明文）
};

let _dbPromise = null;

export function getDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains(STORES.notes)) {
          const s = db.createObjectStore(STORES.notes, { keyPath: 'id' });
          s.createIndex('updatedAtTs', 'updatedAtTs');
        }
        if (!db.objectStoreNames.contains(STORES.meta)) {
          db.createObjectStore(STORES.meta, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORES.legacy)) {
          db.createObjectStore(STORES.legacy, { keyPath: 'key' });
        }
      }
    },
  });
  return _dbPromise;
}

// --- generic helpers ---

export async function getAllNotes() {
  const db = await getDB();
  return db.getAll(STORES.notes);
}

export async function putNote(note) {
  const db = await getDB();
  return db.put(STORES.notes, note);
}

export async function deleteNote(id) {
  const db = await getDB();
  return db.delete(STORES.notes, id);
}

export async function clearNotes() {
  const db = await getDB();
  return db.clear(STORES.notes);
}

export async function getMeta(key) {
  const db = await getDB();
  const row = await db.get(STORES.meta, key);
  return row?.value;
}

export async function setMeta(key, value) {
  const db = await getDB();
  return db.put(STORES.meta, { key, value });
}

// 查估算的儲存配額（回傳 0~1 之間的百分比；無 API 時回傳 null）
export async function storageUsageRatio() {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    return null;
  }
  const { usage = 0, quota = 1 } = await navigator.storage.estimate();
  if (!quota) return null;
  return usage / quota;
}
