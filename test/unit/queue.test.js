import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { _resetForTest, getDB, STORES, getMeta } from '../../src/core/idb.js';
import {
  enqueue, size, clear as qClear,
  backoffDelay, flushOnce, drain,
} from '../../src/sync/queue.js';

async function reset() {
  _resetForTest();
  const db = await getDB();
  await db.clear(STORES.meta);
  localStorage.clear();
}

describe('queue 純函式', () => {
  beforeEach(reset);

  it('enqueue 與 size', async () => {
    expect(await size()).toBe(0);
    await enqueue('op-1');
    await enqueue('op-2');
    expect(await size()).toBe(2);
  });

  it('backoffDelay 指數成長', () => {
    expect(backoffDelay(0)).toBe(1000);
    expect(backoffDelay(1)).toBe(2000);
    expect(backoffDelay(4)).toBe(16000);
  });

  it('backoffDelay 上限 30s', () => {
    expect(backoffDelay(10)).toBe(30000);
  });

  it('flushOnce 成功時移除', async () => {
    await enqueue('A');
    const calls = [];
    const r = await flushOnce(async (op) => { calls.push(op); });
    expect(r.processed).toBe(1);
    expect(r.remaining).toBe(0);
    expect(calls).toEqual(['A']);
  });

  it('flushOnce 失敗時 attempts +1 並重排', async () => {
    await enqueue('A');
    const r = await flushOnce(async () => { throw new Error('boom'); });
    expect(r.processed).toBe(0);
    expect(r.remaining).toBe(1);
    expect(await size()).toBe(1);
    const q = await getMeta('sync_queue_v1');
    expect(q[0].attempts).toBe(1);
    expect(q[0].lastError).toContain('boom');
  });

  it('flushOnce 超過 maxAttempts 移到 failed', async () => {
    await enqueue('A');
    for (let i = 0; i < 5; i++) {
      await flushOnce(async () => { throw new Error('x'); }, { maxAttempts: 5 });
    }
    expect(await size()).toBe(0);
  });

  it('drain 全部消化', async () => {
    await enqueue('a');
    await enqueue('b');
    await enqueue('c');
    const calls = [];
    const r = await drain(async (op) => { calls.push(op); });
    expect(r.processed).toBe(3);
    expect(calls).toEqual(['a', 'b', 'c']);
  });

  it('clear 清空', async () => {
    await enqueue('a');
    await qClear();
    expect(await size()).toBe(0);
  });
});
