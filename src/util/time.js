// 時間輔助：內部一律用 timestamp(數字) 比較，顯示用 toLocaleString

export function now() {
  return Date.now();
}

export function formatTime(ts) {
  if (ts == null) return '';
  return new Date(ts).toLocaleString();
}

export function parseTime(str) {
  if (!str) return 0;
  const t = new Date(str).getTime();
  return Number.isNaN(t) ? 0 : t;
}

// 向量時鐘：用對應 deviceId 累加
export function bumpClock(clock, deviceId) {
  const next = { ...(clock || {}) };
  next[deviceId] = (next[deviceId] || 0) + 1;
  return next;
}

// 合併兩個 clock：取每個 deviceId 較大者
export function mergeClock(a, b) {
  const out = { ...(a || {}) };
  for (const k of Object.keys(b || {})) {
    out[k] = Math.max(out[k] || 0, b[k] || 0);
  }
  return out;
}

// clock A 是否 dominates B（A 在每個維度都 >= B，且至少一個 >）
export function clockDominates(a, b) {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  let greater = false;
  for (const k of keys) {
    const av = (a || {})[k] || 0;
    const bv = (b || {})[k] || 0;
    if (av < bv) return false;
    if (av > bv) greater = true;
  }
  return greater;
}
