import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { getConfig, setConfig, DEFAULT_AI } from '../../src/core/config.js';
import { getDB, STORES, _resetForTest } from '../../src/core/idb.js';

async function reset() {
  _resetForTest();
  const db = await getDB();
  await db.clear(STORES.meta);
}

describe('config (IndexedDB meta)', () => {
  beforeEach(reset);

  it('webdav 預設為 null', async () => {
    expect(await getConfig('webdav')).toBeNull();
  });

  it('ai 預設值來自 DEFAULT_AI', async () => {
    const ai = await getConfig('ai');
    expect(ai.host).toBe(DEFAULT_AI.host);
    expect(ai.model).toBe(DEFAULT_AI.model);
  });

  it('setConfig 寫入後可讀回', async () => {
    await setConfig('webdav', { url: 'https://x.com', user: 'u', pass: 'p' });
    const r = await getConfig('webdav');
    expect(r).toEqual({ url: 'https://x.com', user: 'u', pass: 'p' });
  });

  it('ai 部分寫入時保留 default', async () => {
    await setConfig('ai', { host: 'http://h:1234' });
    const r = await getConfig('ai');
    expect(r.host).toBe('http://h:1234');
    expect(r.model).toBe(DEFAULT_AI.model);
  });

  it('不認得的 name throw', async () => {
    await expect(getConfig('unknown')).rejects.toThrow();
    await expect(setConfig('unknown', {})).rejects.toThrow();
  });
});
