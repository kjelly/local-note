// sync/queue.js — 同步佇列（離線時 enqueue，線上時 flush）
// Phase 1：介面預留，預設 no-op

const QUEUE_KEY = 'lb_sync_queue_v1';

function read() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); }
  catch { return []; }
}
function write(q) { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); }

export function enqueue(op) {
  const q = read();
  q.push({ op, ts: Date.now() });
  write(q);
}

export function flush(handler) {
  const q = read();
  write([]);
  for (const item of q) handler(item);
}

export function size() { return read().length; }
