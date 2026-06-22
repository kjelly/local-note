import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { getDB, STORES, getAllNotes, putNote, deleteNote, getMeta, setMeta, storageUsageRatio, _resetForTest } from '../../src/core/idb.js';
import { runMigration, clearLegacyIfExpired } from '../../src/core/migration.js';
import { normalizeNote } from '../../src/model/note.js';

// 重建 DB 的 helper：fake-indexeddb 的 deleteDatabase 在已開啟連線時會阻塞
// 改用：清掉所有 store 的內容（每個測試隔離）
async function resetDb() {
  // 模組快取也要清掉，否則 openDB 會跳過 upgrade
  _resetForTest();
  const db = await getDB();
  await db.clear(STORES.notes);
  await db.clear(STORES.meta);
  await db.clear(STORES.legacy);
  localStorage.clear();
}

describe('idb basic', () => {
  beforeEach(resetDb);

  it('put / getAll / delete', async () => {
    await putNote(normalizeNote({ id: 'n1', title: 'A', content: 'x' }));
    await putNote(normalizeNote({ id: 'n2', title: 'B', content: 'y' }));
    const all = await getAllNotes();
    expect(all).toHaveLength(2);
    await deleteNote('n1');
    const after = await getAllNotes();
    expect(after).toHaveLength(1);
    expect(after[0].id).toBe('n2');
  });

  it('meta get / set', async () => {
    expect(await getMeta('foo')).toBeUndefined();
    await setMeta('foo', { a: 1 });
    expect(await getMeta('foo')).toEqual({ a: 1 });
  });
});

describe('migration', () => {
  beforeEach(resetDb);

  it('把 v23 localStorage 匯入 IndexedDB', async () => {
    const v23 = [
      { id: 1, title: 'A', content: 'a', updatedAt: '2024-01-01 12:00:00', history: [] },
      { id: 2, title: 'B', content: 'b', updatedAt: '2024-01-02 12:00:00', history: [] },
    ];
    localStorage.setItem('local_brain_db_v23', JSON.stringify(v23));
    const r = await runMigration();
    expect(r.migrated).toBe(2);
    const all = await getAllNotes();
    expect(all).toHaveLength(2);
    const { noteView } = await import('../../src/model/note.js');
    // Phase 20：normalizeNote 把 id 統一為 string
    expect(noteView(all.find((n) => n.id === '1')).title).toBe('A');
  });

  it('重跑 migration 不重複', async () => {
    localStorage.setItem('local_brain_db_v23', JSON.stringify([{ id: 1, title: 'A', content: '', updatedAt: '2024-01-01 12:00:00', history: [] }]));
    await runMigration();
    const r2 = await runMigration();
    expect(r2.skipped).toBe(true);
  });

  it('v22 fallback 也能匯入', async () => {
    localStorage.setItem('local_brain_db_v22', JSON.stringify([{ id: 9, title: 'Z', content: '', updatedAt: '2023-01-01 12:00:00', history: [] }]));
    const r = await runMigration();
    expect(r.migrated).toBe(1);
    const all = await getAllNotes();
    // Phase 20：id 統一為 string
    expect(all[0].id).toBe('9');
  });
});
