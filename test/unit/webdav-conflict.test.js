import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { _resetForTest, getDB, STORES } from '../../src/core/idb.js';
import { ConflictError, webdavGetWithEtag, webdavPutWithEtag } from '../../src/sync/webdav.js';

async function reset() {
  _resetForTest();
  const db = await getDB();
  await db.clear(STORES.meta);
  // 預先寫入 webdav 設定
  await db.put(STORES.meta, { key: 'config.webdav', value: { url: 'https://x.com/brain.json', user: 'u', pass: 'p' } });
}

describe('webdav ETag / If-Match', () => {
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

  it('GET 取得 etag', async () => {
    mockFetch(async () => ({
      ok: true,
      status: 200,
      headers: { get: (k) => (k.toLowerCase() === 'etag' ? '"v1"' : null) },
      json: async () => [{ id: 'a' }],
    }));
    const r = await webdavGetWithEtag();
    expect(r.data).toEqual([{ id: 'a' }]);
    expect(r.etag).toBe('"v1"');
  });

  it('PUT 帶 If-Match', async () => {
    mockFetch(async (url, init) => {
      expect(init.headers['If-Match']).toBe('"v1"');
      return {
        ok: true,
        status: 200,
        headers: { get: (k) => (k.toLowerCase() === 'etag' ? '"v2"' : null) },
      };
    });
    const r = await webdavPutWithEtag([1, 2, 3], '"v1"');
    expect(r.ok).toBe(true);
    expect(r.etag).toBe('"v2"');
  });

  it('PUT 412 → throw ConflictError 帶 current body', async () => {
    let call = 0;
    mockFetch(async () => {
      call++;
      if (call === 1) {
        return {
          ok: false,
          status: 412,
          headers: { get: () => null },
        };
      }
      // 第二次呼叫：re-fetch
      return {
        ok: true,
        status: 200,
        headers: { get: (k) => (k.toLowerCase() === 'etag' ? '"server-v3"' : null) },
        json: async () => [{ id: 'other' }],
      };
    });
    let caught = null;
    try {
      await webdavPutWithEtag([1], '"v1"');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ConflictError);
    expect(caught.etag).toBe('"server-v3"');
    expect(caught.body).toEqual([{ id: 'other' }]);
  });

  it('GET 404 回 data=null', async () => {
    mockFetch(async () => ({ ok: false, status: 404, headers: { get: () => null }, json: async () => null }));
    const r = await webdavGetWithEtag();
    expect(r.data).toBeNull();
  });
});
