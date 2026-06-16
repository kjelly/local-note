// core/lww.js — Last-Writer-Wins 工具
// 每個欄位都有獨立的 { value, rev, clock }
// 合併規則（先比 clock dominates，否則比 rev，平手比 timestamp）

import { bumpClock, mergeClock, clockDominates } from '../util/time.js';

export const FIELDS = ['title', 'content', 'links', 'pinned', 'tags', 'pinnedAt'];

function compareField(local, remote) {
  // 同欄位比較：回傳 'local' | 'remote' | 'same'
  if (local.rev !== remote.rev) {
    // 不同 rev：clock dominates 較大者勝；否則比 rev
    if (clockDominates(remote.clock, local.clock)) return 'remote';
    if (clockDominates(local.clock, remote.clock)) return 'local';
    return local.rev > remote.rev ? 'local' : 'remote';
  }
  // 同 rev：clock dominates 較大者勝
  if (clockDominates(remote.clock, local.clock)) return 'remote';
  if (clockDominates(local.clock, remote.clock)) return 'local';
  // 同 rev + clock 平手：視為 same
  return 'same';
}

// 合併兩個欄位的 LWW 物件；回傳勝者（reference）
export function pickFieldWinner(local, remote) {
  if (!local) return remote;
  if (!remote) return local;
  return compareField(local, remote) === 'remote' ? remote : local;
}

// 把本地 LWW 物件 bump rev（呼叫者要在本地修改時使用）
export function bumpField(field, deviceId) {
  if (!field) return { value: null, rev: 1, clock: bumpClock({}, deviceId), updatedAt: Date.now() };
  return {
    ...field,
    rev: (field.rev || 0) + 1,
    clock: bumpClock(field.clock || {}, deviceId),
    updatedAt: Date.now(),
  };
}

// 合併兩個 field；回傳新的 field 物件（即使相同 rev 也回傳新 reference 表示 merged）
export function mergeField(local, remote) {
  if (!local) return remote;
  if (!remote) return local;
  const winner = pickFieldWinner(local, remote);
  // 合併 clock：取兩者聯集最大值
  return {
    value: winner.value,
    rev: Math.max(local.rev, remote.rev),
    clock: mergeClock(local.clock, remote.clock),
    updatedAt: Math.max(local.updatedAt || 0, remote.updatedAt || 0),
  };
}

// 整筆 note 比較，回傳差異（用於 push delta）
// 注意：field 是 LWW 物件，值本身可能未變但 rev 變了；用 value + rev 雙重判斷
export function diffNote(local, remote) {
  if (!local) return remote;
  if (!remote) return null;
  const out = {};
  for (const f of Object.keys(remote)) {
    if (f === 'id' || f === 'createdAt') continue;
    if (!local[f] || local[f].rev !== remote[f].rev || !sameValue(local[f].value, remote[f].value)) {
      out[f] = remote[f];
    }
  }
  return Object.keys(out).length === 0 ? null : out;
}

function sameValue(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }
  return false;
}

// 整筆 note 合併：欄位級
export function mergeNote(local, remote) {
  if (!local) return remote;
  if (!remote) return local;
  // id 不同視為不同 note，不合併
  if (local.id !== remote.id) return null;

  const merged = {
    id: local.id,
    createdAt: Math.min(local.createdAt || 0, remote.createdAt || 0) || Date.now(),
  };
  // 合併所有欄位（聯集 key）
  const keys = new Set([
    ...Object.keys(local),
    ...Object.keys(remote),
  ]);
  for (const k of keys) {
    if (k === 'id' || k === 'createdAt') continue;
    const l = local[k];
    const r = remote[k];
    if (l && r) merged[k] = mergeField(l, r);
    else if (l) merged[k] = l;
    else if (r) merged[k] = r;
  }
  return merged;
}
