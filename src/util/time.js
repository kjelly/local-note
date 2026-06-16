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

// clock A 是否 dominates B（A 在每個 device 上都 >= B，且至少一個 >）
// 注意：當兩個 clock 完全 disjoint（沒共用 device）時，
// 真正的 LWW 應視為「並列」，由 tie-breaker（如 rev）決定。
// 這裡採寬鬆 dominates：共用 key 都 >= 且至少一個 >；一方有對方沒有的 device 也算 >。
export function clockDominates(a, b) {
  const aK = a || {};
  const bK = b || {};
  if (Object.keys(aK).length === 0 && Object.keys(bK).length === 0) return false;
  if (Object.keys(bK).length === 0) return Object.keys(aK).length > 0;
  if (Object.keys(aK).length === 0) return false;
  let greater = false;
  for (const k of new Set([...Object.keys(aK), ...Object.keys(bK)])) {
    const av = aK[k] || 0;
    const bv = bK[k] || 0;
    if (av < bv) return false;
    if (av > bv) greater = true;
  }
  return greater;
}
