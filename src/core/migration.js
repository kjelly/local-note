// core/migration.js — 把舊版 v23 localStorage 資料搬進 IndexedDB
// v23 → v24：note 結構升級為 LWW（由 model/note.js#normalizeNote 處理）
// 完成後保留 30 天 localStorage 作為 fallback，過期才刪

import { getDB, STORES, putNote } from './idb.js';
import { normalizeNote } from '../model/note.js';

const MIGRATION_FLAG = 'lb_migration_v24_done';
const LEGACY_KEYS = ['local_brain_db_v23', 'local_brain_db_v22'];
const KEEP_DAYS = 30;

export async function runMigration() {
  if (localStorage.getItem(MIGRATION_FLAG)) {
    const ts = parseInt(localStorage.getItem(MIGRATION_FLAG + '_ts') || '0', 10);
    if (Date.now() - ts < KEEP_DAYS * 24 * 60 * 60 * 1000) return { skipped: true };
  }
  // 備份 localStorage
  const db = await getDB();
  const legacy = db.transaction(STORES.legacy, 'readwrite').objectStore(STORES.legacy);
  for (const key of LEGACY_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw) await legacy.put({ key, value: raw, ts: Date.now() });
  }

  // 從 v23/v22 解析後寫入 notes（自動經過 normalizeNote 升級到 LWW）
  const raw = localStorage.getItem('local_brain_db_v23') || localStorage.getItem('local_brain_db_v22');
  let parsed = [];
  if (raw) {
    try { parsed = JSON.parse(raw); } catch { parsed = []; }
  }
  let migrated = 0;
  for (const n of parsed) {
    const norm = normalizeNote(n);
    if (norm) {
      // 把頂層 updatedAt 也加好（給 IDB 索引用）
      const updatedAt = Math.max(
        norm.title?.updatedAt || 0,
        norm.content?.updatedAt || 0,
        norm.links?.updatedAt || 0,
        norm.pinned?.updatedAt || 0,
      );
      await putNote({ ...norm, updatedAt });
      migrated++;
    }
  }

  localStorage.setItem(MIGRATION_FLAG, '1');
  localStorage.setItem(MIGRATION_FLAG + '_ts', String(Date.now()));
  return { migrated, skipped: false };
}

export async function clearLegacyIfExpired() {
  const ts = parseInt(localStorage.getItem(MIGRATION_FLAG + '_ts') || '0', 10);
  if (!ts) return;
  if (Date.now() - ts >= KEEP_DAYS * 24 * 60 * 60 * 1000) {
    for (const key of LEGACY_KEYS) localStorage.removeItem(key);
  }
}
