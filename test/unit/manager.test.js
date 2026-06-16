import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { _resetForTest, getDB, STORES, putNote, getAllNotes } from '../../src/core/idb.js';
import { createNote, normalizeNote } from '../../src/model/note.js';
import { reconcile, bootstrapSync, enqueuePush } from '../../src/sync/manager.js';
import { setLocalFileHandle } from '../../src/sync/manager.js';

async function reset() {
  _resetForTest();
  const db = await getDB();
  await db.clear(STORES.notes);
  await db.clear(STORES.meta);
  localStorage.clear();
  // webdav 設定
  await db.put(STORES.meta, { key: 'config.webdav', value: { url: 'https://x.com/brain.json', user: 'u', pass: 'p' } });
  await bootstrapSync();
}

describe('reconcile (3-way merge + ETag)', () => {
  let originalFetch;
  beforeEach(async () => {
    await reset();
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function mockFetch(impl) {
    globalThis.fetch = vi.fn(impl);
  }

  it('無本地無遠端：上傳空 list 成功', async () => {
    let putBody, putEtag;
    mockFetch(async (url, init) => {
      if (init.method === 'GET') {
        return { ok: false, status: 404, headers: { get: () => null }, json: async () => null };
      }
      if (init.method === 'PUT') {
        putBody = init.body; putEtag = init.headers['If-Match'];
        return { ok: true, status: 200, headers: { get: (k) => (k.toLowerCase() === 'etag' ? '"v1"' : null) } };
      }
    });
    const r = await reconcile();
    expect(r.ok).toBe(true);
    expect(putEtag).toBeUndefined(); // 第一次無 etag
    expect(JSON.parse(putBody)).toEqual([]);
  });

  it('本地有，遠端空：上傳本地', async () => {
    await putNote({ ...createNote({ title: 'local' }), updatedAt: Date.now() });
    mockFetch(async (url, init) => {
      if (init.method === 'GET') return { ok: false, status: 404, headers: { get: () => null }, json: async () => null };
      if (init.method === 'PUT') return { ok: true, status: 200, headers: { get: (k) => (k.toLowerCase() === 'etag' ? '"v1"' : null) } };
    });
    const r = await reconcile();
    expect(r.ok).toBe(true);
  });

  it('遠端有，本地空：拉遠端並存入', async () => {
    const remote = [{ id: 'r1', title: { value: 'r', rev: 1, clock: { 'dev-Z': 1 } }, createdAt: 1 }];
    mockFetch(async (url, init) => {
      if (init.method === 'GET') {
        return { ok: true, status: 200, headers: { get: (k) => (k.toLowerCase() === 'etag' ? '"vR"' : null) }, json: async () => remote };
      }
      if (init.method === 'PUT') return { ok: true, status: 200, headers: { get: () => null } };
    });
    const r = await reconcile();
    expect(r.ok).toBe(true);
    const all = await getAllNotes();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe('r1');
  });

  it('本地+遠端同時改同欄位：合併後各自保留 LWW 勝者', async () => {
    const local = normalizeNote({
      id: 'x', title: 'LT', content: 'common',
      history: [],
    });
    await putNote({ ...local, updatedAt: Date.now() });
    const remote = [{
      id: 'x',
      title: { value: 'RT', rev: 1, clock: { 'dev-R': 1 }, updatedAt: 1 },
      content: { value: 'common', rev: 1, clock: { 'dev-R': 1 }, updatedAt: 1 },
      links: { value: [], rev: 1, clock: { 'dev-R': 1 }, updatedAt: 1 },
      pinned: { value: false, rev: 1, clock: { 'dev-R': 1 }, updatedAt: 1 },
      history: [],
      createdAt: 1,
    }];
    mockFetch(async (url, init) => {
      if (init.method === 'GET') {
        return { ok: true, status: 200, headers: { get: (k) => (k.toLowerCase() === 'etag' ? '"vR"' : null) }, json: async () => remote };
      }
      if (init.method === 'PUT') return { ok: true, status: 200, headers: { get: () => null } };
    });
    const r = await reconcile();
    expect(r.ok).toBe(true);
    const all = await getAllNotes();
    const x = all.find((n) => n.id === 'x');
    // 兩邊都修改 title：合併後 clock 聯集；value 來自勝者
    const { getDeviceId } = await import('../../src/util/id.js');
    expect(x.title.clock).toMatchObject({ [getDeviceId()]: 1, 'dev-R': 1 });
  });

  it('412 衝突：自動 retry 一次成功', async () => {
    await putNote({ ...createNote({ title: 'A' }), updatedAt: Date.now() });
    let call = 0;
    mockFetch(async (url, init) => {
      call++;
      if (init.method === 'GET') {
        return { ok: true, status: 200, headers: { get: (k) => (k.toLowerCase() === 'etag' ? '"v' + call + '"' : null) }, json: async () => [] };
      }
      if (init.method === 'PUT') {
        if (call === 2) {
          // 第一次 PUT：模擬對方在背後搶先更新
          return { ok: false, status: 412, headers: { get: () => null } };
        }
        return { ok: true, status: 200, headers: { get: () => null } };
      }
    });
    const r = await reconcile();
    expect(r.ok).toBe(true);
    expect(r.retried).toBeGreaterThanOrEqual(1);
  });
});
