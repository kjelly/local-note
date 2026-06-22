import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { getDB, STORES, getAllNotes, putNote, _resetForTest } from '../../src/core/idb.js';
import { fixIdTypes, runMigration } from '../../src/core/migration.js';

async function reset() {
  _resetForTest();
  const db = await getDB();
  await db.clear(STORES.notes);
  await db.clear(STORES.meta);
  await db.clear(STORES.legacy);
  localStorage.clear();
}

describe('fixIdTypes', () => {
  beforeEach(reset);

  it('把所有 number id 改成 string', async () => {
    await putNote({
      id: 1770273642056,
      title: { value: 'a', rev: 1, clock: { 'dev-A': 1 } },
      content: { value: 'x', rev: 1, clock: { 'dev-A': 1 } },
      links: { value: [], rev: 1, clock: { 'dev-A': 1 } },
      pinned: { value: false, rev: 1, clock: { 'dev-A': 1 } },
      history: [],
      createdAt: 1000,
    });
    await putNote({
      id: 'uuid-string-2',
      title: { value: 'b', rev: 1, clock: { 'dev-A': 1 } },
      content: { value: 'y', rev: 1, clock: { 'dev-A': 1 } },
      links: { value: [], rev: 1, clock: { 'dev-A': 1 } },
      pinned: { value: false, rev: 1, clock: { 'dev-A': 1 } },
      history: [],
      createdAt: 2000,
    });
    const r = await fixIdTypes();
    expect(r.fixed).toBe(1);
    const all = await getAllNotes();
    const num = all.find((n) => n.id === '1770273642056');
    const str = all.find((n) => n.id === 'uuid-string-2');
    expect(num).toBeTruthy();
    expect(str).toBeTruthy();
  });

  it('沒 number id 時 skip', async () => {
    await putNote({
      id: 'all-strings',
      title: { value: 'a', rev: 1, clock: { 'dev-A': 1 } },
      content: { value: 'x', rev: 1, clock: { 'dev-A': 1 } },
      links: { value: [], rev: 1, clock: { 'dev-A': 1 } },
      pinned: { value: false, rev: 1, clock: { 'dev-A': 1 } },
      history: [],
      createdAt: 1000,
    });
    const r = await fixIdTypes();
    expect(r.fixed).toBe(0);
  });

  it('跑第二次是 idempotent', async () => {
    await putNote({
      id: 1234567890,
      title: { value: 'a', rev: 1, clock: { 'dev-A': 1 } },
      content: { value: 'x', rev: 1, clock: { 'dev-A': 1 } },
      links: { value: [], rev: 1, clock: { 'dev-A': 1 } },
      pinned: { value: false, rev: 1, clock: { 'dev-A': 1 } },
      history: [],
      createdAt: 1000,
    });
    await fixIdTypes();
    const r2 = await fixIdTypes();
    expect(r2.skipped).toBe(true);
  });
});