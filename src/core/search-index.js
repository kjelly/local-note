// core/search-index.js — 反向索引
// 從 notes 建立 token → Set(noteId) 的 Map
// 搜尋時用 Set 交集（AND）/ 聯集（OR）取代 O(n) filter

import { noteView } from '../model/note.js';

const TOKEN_RE = /[\p{L}\p{N}]+/gu;

// 把一段文字切成小寫 token
export function tokenize(text) {
  if (!text) return [];
  const out = [];
  for (const m of String(text).toLowerCase().match(TOKEN_RE) || []) {
    if (m.length > 1) out.push(m);
  }
  return out;
}

// 從單筆 note 抽出 token（取 view 形式）
function tokensOfNote(note) {
  const v = noteView(note);
  return [...tokenize(v.title), ...tokenize(v.content)];
}

// 建立索引：Map<token, Set<noteId>>
export function buildIndex(notes) {
  const idx = new Map();
  for (const n of notes) {
    const tokens = new Set(tokensOfNote(n));
    for (const t of tokens) {
      if (!idx.has(t)) idx.set(t, new Set());
      idx.get(t).add(n.id);
    }
  }
  return idx;
}

// 增量加入一筆
export function indexAdd(idx, note) {
  const tokens = new Set(tokensOfNote(note));
  for (const t of tokens) {
    if (!idx.has(t)) idx.set(t, new Set());
    idx.get(t).add(note.id);
  }
}

// 增量移除一筆（空 set 一併刪除）
export function indexRemove(idx, noteId) {
  for (const [key, set] of idx.entries()) {
    set.delete(noteId);
    if (set.size === 0) idx.delete(key);
  }
}

// 從一筆重新建立（移除後再加）
export function indexUpdate(idx, oldNoteId, newNote) {
  if (oldNoteId) indexRemove(idx, oldNoteId);
  indexAdd(idx, newNote);
}

// 搜尋：keywords + mode（AND/OR）
// 回傳 noteId 陣列
export function searchIndex(idx, keyword, mode = 'AND') {
  const kws = tokenize(keyword);
  if (kws.length === 0) return null; // null = 無過濾
  // 過濾掉完全沒命中的 token
  const sets = kws.map((k) => idx.get(k)).filter((s) => s && s.size > 0);
  if (sets.length === 0) return [];
  if (mode === 'OR') {
    const out = new Set();
    for (const s of sets) for (const id of s) out.add(id);
    return [...out];
  }
  // AND：取交集；對小到大排序加速
  sets.sort((a, b) => a.size - b.size);
  const [first, ...rest] = sets;
  const out = new Set(first);
  for (const s of rest) {
    for (const id of out) if (!s.has(id)) out.delete(id);
  }
  return [...out];
}

// 模糊子字串搜尋 fallback（反向索引沒命中時用 O(n) 線性掃描）
// 用在 tokens 沒被切出來時（如中日韓字元長度被 tokenize 切成多個字）
export function fuzzyFallback(notes, keyword, mode = 'AND') {
  const kws = keyword.toLowerCase().split(/\s+/).filter(Boolean);
  if (kws.length === 0) return notes;
  return notes.filter((n) => {
    const v = noteView(n);
    const txt = (v.title + ' ' + v.content).toLowerCase();
    return mode === 'AND' ? kws.every((k) => txt.includes(k)) : kws.some((k) => txt.includes(k));
  });
}
