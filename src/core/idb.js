// IndexedDB 封裝：以 idb 套件為骨幹
// Phase 2：note 改為 LWW 結構
// Phase 6：新增 attachments store（IndexedDB blob）

import { openDB } from 'idb';

const DB_NAME = 'local_brain_db';
const DB_VERSION = 3;

export const STORES = {
  notes: 'notes',          // LWW 結構
  attachments: 'attachments', // { id, noteId, blob, mime, createdAt }
  meta: 'meta',            // { key, value }
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
      if (oldVersion < 3) {
        if (!db.objectStoreNames.contains(STORES.attachments)) {
          const a = db.createObjectStore(STORES.attachments, { keyPath: 'id' });
          a.createIndex('noteId', 'noteId');
        }
      }
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

// --- attachments ---

export async function putAttachment(att) {
  const db = await getDB();
  return db.put(STORES.attachments, att);
}

export async function getAttachment(id) {
  const db = await getDB();
  return db.get(STORES.attachments, id);
}

export async function getAttachmentsByNote(noteId) {
  const db = await getDB();
  return db.getAllFromIndex(STORES.attachments, 'noteId', noteId);
}

export async function deleteAttachment(id) {
  const db = await getDB();
  return db.delete(STORES.attachments, id);
}

export async function deleteAttachmentsByNote(noteId) {
  const db = await getDB();
  const tx = db.transaction(STORES.attachments, 'readwrite');
  const idx = tx.objectStore(STORES.attachments).index('noteId');
  let cursor = await idx.openCursor(noteId);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
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

// 查估算的儲存配額
export async function storageUsageRatio() {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
  const { usage = 0, quota = 1 } = await navigator.storage.estimate();
  if (!quota) return null;
  return usage / quota;
}
