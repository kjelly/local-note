// core/migration.js — 把舊版 v23 localStorage 資料搬進 IndexedDB
// 完成後保留 30 天 localStorage 作為 fallback，過期才刪

import { getDB, STORES, getAllNotes, putNote } from './idb.js';
import { normalizeNote } from '../model/note.js';

const MIGRATION_FLAG = 'lb_migration_v24_done';
const LEGACY_KEYS = ['local_brain_db_v23', 'local_brain_db_v22'];
const KEEP_DAYS = 30;

export async function runMigration() {
  if (localStorage.getItem(MIGRATION_FLAG)) {
    // 確認是否過期
    const ts = parseInt(localStorage.getItem(MIGRATION_FLAG + '_ts') || '0', 10);
    if (Date.now() - ts < KEEP_DAYS * 24 * 60 * 60 * 1000) return { skipped: true };
  }
  // 把所有 localStorage 內的舊 key 備份到 legacy store
  const db = await getDB();
  const legacy = db.transaction(STORES.legacy, 'readwrite').objectStore(STORES.legacy);
  for (const key of LEGACY_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw) await legacy.put({ key, value: raw, ts: Date.now() });
  }

  // 從 v23 解析後寫入 notes
  const raw = localStorage.getItem('local_brain_db_v23');
  let parsed = [];
  if (raw) {
    try { parsed = JSON.parse(raw); } catch { parsed = []; }
  } else {
    const old = localStorage.getItem('local_brain_db_v22');
    if (old) { try { parsed = JSON.parse(old); } catch { parsed = []; } }
  }
  let migrated = 0;
  for (const n of parsed) {
    const norm = normalizeNote(n);
    if (norm) { await putNote(norm); migrated++; }
  }

  localStorage.setItem(MIGRATION_FLAG, '1');
  localStorage.setItem(MIGRATION_FLAG + '_ts', String(Date.now()));
  return { migrated, skipped: false };
}

// 30 天後清除 localStorage 內的舊 key
export async function clearLegacyIfExpired() {
  const ts = parseInt(localStorage.getItem(MIGRATION_FLAG + '_ts') || '0', 10);
  if (!ts) return;
  if (Date.now() - ts >= KEEP_DAYS * 24 * 60 * 60 * 1000) {
    for (const key of LEGACY_KEYS) localStorage.removeItem(key);
  }
}
