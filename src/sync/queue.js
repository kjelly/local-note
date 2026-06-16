// sync/queue.js — 同步佇列（持久化到 IndexedDB meta）
// 支援：enqueue / flush / 失敗重試（指數退避）

import { getMeta, setMeta } from '../core/idb.js';

const KEY = 'sync_queue_v1';
const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 1000; // 1s, 2s, 4s, 8s, 16s

// 項目：{ id, op, ts, attempts, lastError }

async function read() {
  return (await getMeta(KEY)) || [];
}
async function write(q) {
  await setMeta(KEY, q);
}

let _id = 0;
function newId() { return `${Date.now()}-${++_id}`; }

export async function enqueue(op) {
  const q = await read();
  q.push({ id: newId(), op, ts: Date.now(), attempts: 0, lastError: null });
  await write(q);
  return q[q.length - 1];
}

export async function size() {
  return (await read()).length;
}

export async function clear() {
  await write([]);
}

// 計算下一次重試的 delay
export function backoffDelay(attempts) {
  return Math.min(BASE_DELAY_MS * Math.pow(2, attempts), 30000);
}

// 嘗試處理單一 op：成功回 true，失敗回 false（會重排下次）
// 給 manager.js 使用
export async function flushOnce(handler, { maxAttempts = MAX_ATTEMPTS } = {}) {
  const q = await read();
  if (q.length === 0) return { processed: 0, remaining: 0, failed: [] };
  const item = q[0];
  try {
    await handler(item.op);
    // 成功：移除
    const next = q.slice(1);
    await write(next);
    return { processed: 1, remaining: next.length, failed: [] };
  } catch (err) {
    item.attempts = (item.attempts || 0) + 1;
    item.lastError = String(err && err.message || err);
    if (item.attempts >= maxAttempts) {
      // 放棄：移到失敗佇列
      const failed = [item];
      const next = q.slice(1);
      await write(next);
      // 記下失敗清單到 meta
      const oldFailed = (await getMeta('sync_queue_failed') || []);
      await setMeta('sync_queue_failed', [...oldFailed, item]);
      return { processed: 0, remaining: next.length, failed };
    }
    // 重排：把這個項目推到佇列尾（簡化；理想是依 backoff 時間）
    const next = [...q.slice(1), item];
    await write(next);
    return { processed: 0, remaining: next.length, failed: [] };
  }
}

// 持續處理直到空（用於線上時批次消化）
export async function drain(handler, opts) {
  let total = 0;
  let result;
  for (let i = 0; i < 100; i++) {
    result = await flushOnce(handler, opts);
    total += result.processed;
    if (result.remaining === 0) break;
    const nextDelay = backoffDelay((await read())[0]?.attempts || 0);
    await new Promise((r) => setTimeout(r, Math.min(nextDelay, 5000)));
  }
  return { processed: total, failed: result?.failed || [] };
}
