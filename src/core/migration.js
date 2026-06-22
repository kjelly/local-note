// core/migration.js — 把舊版 v23 localStorage 資料搬進 IndexedDB
// v23 → v24：note 結構升級為 LWW（由 model/note.js#normalizeNote 處理）
// Phase 20：額外做「note.id 型別統一」修補（v23 是 number，後續都是 string）
// 完成後保留 30 天 localStorage 作為 fallback，過期才刪

import { getDB, STORES, putNote, getAllNotes } from './idb.js';
import { normalizeNote } from '../model/note.js';

const MIGRATION_FLAG = 'lb_migration_v24_done';
const LEGACY_KEYS = ['local_brain_db_v23', 'local_brain_db_v22'];
const KEEP_DAYS = 30;
// Phase 20: id 型別修補旗標（v3 升級標記）
const ID_TYPE_FIX_FLAG = 'lb_id_type_fix_v1';

export async function runMigration() {
  if (localStorage.getItem(MIGRATION_FLAG)) {
    const ts = parseInt(localStorage.getItem(MIGRATION_FLAG + '_ts') || '0', 10);
    if (Date.now() - ts < KEEP_DAYS * 24 * 60 * 60 * 1000) {
      // 即使跳過 v23 遷移，仍要跑 id 型別修補（一次性）
      await fixIdTypes();
      return { skipped: true };
    }
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
  // 跑 id 型別修補
  await fixIdTypes();
  return { migrated, skipped: false };
}

// Phase 20: 把 IDB 內 note.id 從 number 統一成 string
// 原因：v23 時期用 Date.now() 為 number；HTML data-id 自動轉 string；
// 導致 loadNote(find(stringId)) 找不到 number id 的 note
export async function fixIdTypes() {
  if (localStorage.getItem(ID_TYPE_FIX_FLAG)) return { skipped: true };
  const notes = await getAllNotes();
  let fixed = 0;
  for (const n of notes) {
    if (typeof n.id === 'number') {
      const next = { ...n, id: String(n.id) };
      await putNote(next);
      fixed++;
    }
  }
  if (fixed > 0) {
    localStorage.setItem(ID_TYPE_FIX_FLAG, '1');
    console.log(`[lb] id 型別修補：${fixed} 筆從 number 改為 string`);
  }
  return { fixed };
}

export async function clearLegacyIfExpired() {
  const ts = parseInt(localStorage.getItem(MIGRATION_FLAG + '_ts') || '0', 10);
  if (!ts) return;
  if (Date.now() - ts >= KEEP_DAYS * 24 * 60 * 60 * 1000) {
    for (const key of LEGACY_KEYS) localStorage.removeItem(key);
  }
}
