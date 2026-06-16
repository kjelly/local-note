// IndexedDB 封裝：以 idb 套件為骨幹
// Phase 2：note 改為 LWW 結構；保留 v23 格式於 legacy store

import { openDB } from 'idb';

const DB_NAME = 'local_brain_db';
const DB_VERSION = 2;

export const STORES = {
  notes: 'notes',          // LWW 結構：{ id, title:{value,rev,clock,updatedAt}, ... }
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
          // 同時建立 updatedAtTs（v23 相容）與 updatedAt（LWW 用）
          s.createIndex('updatedAt', 'updatedAt');
          s.createIndex('updatedAtTs', 'updatedAtTs');
        }
        if (!db.objectStoreNames.contains(STORES.meta)) {
          db.createObjectStore(STORES.meta, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORES.legacy)) {
          db.createObjectStore(STORES.legacy, { keyPath: 'key' });
        }
      }
      // v2：note 結構改為 LWW；索引已於 v1 建立，不需再動
    },
  });
  return _dbPromise;
}

// 測試用：清除模組快取
export function _resetForTest() {
  _dbPromise = null;
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
