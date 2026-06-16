// model/note.js — 全新資料模型（Phase 2）
// 每個欄位都是 LWW 物件：{ value, rev, clock, updatedAt }
// 衝突解決在 core/lww.js；這層負責建立/正規化/套用本地 patch

import { uuidv7, getDeviceId } from '../util/id.js';
import { bumpField, mergeField } from '../core/lww.js';

// 建立一個新的空白欄位
function makeField(value, deviceId) {
  return {
    value: value ?? null,
    rev: 1,
    clock: { [deviceId]: 1 },
    updatedAt: Date.now(),
  };
}

// 建立一個全新的 note
export function createNote(partial = {}) {
  const deviceId = getDeviceId();
  const now = Date.now();
  return {
    id: partial.id ?? uuidv7(),
    createdAt: now,
    // LWW 欄位
    title:   makeField(partial.title ?? '', deviceId),
    content: makeField(partial.content ?? '', deviceId),
    links:   makeField(partial.links ?? [], deviceId),
    pinned:  makeField(!!partial.pinned, deviceId),
    history: [],
  };
}

// 從舊版 v23 物件做形態正規化
export function normalizeNote(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = raw.id ?? uuidv7();
  const deviceId = getDeviceId();
  const updatedAt = raw.updatedAtTs ?? Date.parse(raw.updatedAt) ?? Date.now();
  // 已是新格式
  if (raw.title && typeof raw.title === 'object' && 'value' in raw.title) {
    return {
      id: raw.id,
      createdAt: raw.createdAt ?? updatedAt,
      title: raw.title,
      content: raw.content ?? makeField('', deviceId),
      links: raw.links ?? makeField([], deviceId),
      pinned: raw.pinned ?? makeField(false, deviceId),
      history: Array.isArray(raw.history) ? raw.history : [],
    };
  }
  // v23 格式 → 升級
  return {
    id,
    createdAt: raw.createdAt ?? updatedAt,
    title:   { value: raw.title ?? '', rev: 1, clock: { [deviceId]: 1 }, updatedAt },
    content: { value: raw.content ?? '', rev: 1, clock: { [deviceId]: 1 }, updatedAt },
    links:   { value: Array.isArray(raw.links) ? raw.links : [], rev: 1, clock: { [deviceId]: 1 }, updatedAt },
    pinned:  { value: !!raw.pinned, rev: 1, clock: { [deviceId]: 1 }, updatedAt },
    history: Array.isArray(raw.history) ? raw.history : [],
  };
}

// 取得 note 的扁平化 view（給 UI 使用）
export function noteView(note) {
  if (!note) return null;
  return {
    id: note.id,
    title: note.title?.value ?? '',
    content: note.content?.value ?? '',
    links: note.links?.value ?? [],
    pinned: !!note.pinned?.value,
    createdAt: note.createdAt,
    updatedAt: note.title?.updatedAt || note.content?.updatedAt || note.createdAt,
    history: note.history || [],
  };
}

// 本地 patch：title/content/links/pinned 任一變動 → bump 該欄位 rev 與 clock
// 回傳新 note；無變動回傳原 reference
export function applyPatch(note, patch) {
  if (!note) return null;
  let dirty = false;
  const next = { ...note };

  for (const key of ['title', 'content', 'links', 'pinned']) {
    if (!(key in patch)) continue;
    const newValue = patch[key];
    const cur = note[key];
    if (!cur) {
      next[key] = makeField(newValue, getDeviceId());
      dirty = true;
      continue;
    }
    // 對 links/pinned 用 deep equal 簡化版
    const same = sameValue(cur.value, newValue);
    if (same) continue;
    next[key] = bumpField(cur, getDeviceId());
    next[key].value = newValue;
    dirty = true;
  }
  return dirty ? next : note;
}

// 加入時光機
export function pushHistory(note, historyItem) {
  const h = Array.isArray(note.history) ? note.history.slice() : [];
  h.unshift(historyItem);
  if (h.length > 20) h.length = 20;
  return { ...note, history: h };
}

// 還原時光機項目：把目前 content 推入 history，然後把指定 index 的內容放回 content
export function restoreFromHistory(note, index) {
  if (!note?.history?.[index]) return note;
  const target = note.history[index];
  const next = applyPatch(note, { content: target.content });
  // 還原時也要把現有 content 推入 history
  return pushHistory(next, {
    time: new Date().toLocaleString(),
    timestamp: Date.now(),
    content: note.content?.value,
  });
}

// 整筆 LWW 合併（給 sync 使用）
export { mergeField };

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
