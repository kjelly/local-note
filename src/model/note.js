// Note 模型 + LWW 衝突解決
// 這份檔案是 Phase 2 的基礎；Phase 1 先把 createNote / normalizeNote 做出來，
// applyPatch 與欄位級 LWW 等到 P2 再接上。

import { uuidv7 } from '../util/id.js';
import { now, formatTime, bumpClock, mergeClock, clockDominates } from '../util/time.js';

// 從舊版 (v23, localStorage 時代) 的 note 物件做形態正規化
export function normalizeNote(raw) {
  if (!raw || typeof raw !== 'object') return null;
  // 沒有 id 的補一個（v22 之前可能）
  const id = raw.id ?? uuidv7();
  // 內部時間一律用 timestamp；顯示用 updatedAt
  const updatedAtTs = raw.updatedAtTs ?? Date.parse(raw.updatedAt) ?? Date.now();
  return {
    id,
    title: raw.title ?? '',
    content: raw.content ?? '',
    links: Array.isArray(raw.links) ? raw.links : [],
    pinned: !!raw.pinned,
    history: Array.isArray(raw.history) ? raw.history : [],
    createdAt: raw.createdAt ?? updatedAtTs,
    updatedAt: raw.updatedAt ?? formatTime(updatedAtTs),
    updatedAtTs,
  };
}

export function createNote(partial = {}) {
  const ts = now();
  const note = {
    id: partial.id ?? uuidv7(),
    title: partial.title ?? '',
    content: partial.content ?? '',
    links: partial.links ?? [],
    pinned: !!partial.pinned,
    history: [],
    createdAt: ts,
    updatedAt: formatTime(ts),
    updatedAtTs: ts,
  };
  return note;
}

// 套用本機修改：title/content 變更時更新時間戳
// 無變動時回原 reference，方便 caller 走 early-return 路徑
export function applyLocalEdit(note, { title, content }) {
  let dirty = false;
  const next = { ...note };
  if (title != null && title !== note.title) {
    next.title = title;
    dirty = true;
  }
  if (content != null && content !== note.content) {
    next.content = content;
    dirty = true;
  }
  if (!dirty) return note;
  next.updatedAtTs = now();
  next.updatedAt = formatTime(next.updatedAtTs);
  return next;
}

// ---- LWW 衝突解決（Phase 2 會再強化）----

// 整筆層級 LWW：updatedAtTs 大者勝
export function mergeNoteByTimestamp(local, remote) {
  if (!local) return remote;
  if (!remote) return local;
  const lt = local.updatedAtTs || 0;
  const rt = remote.updatedAtTs || 0;
  return rt > lt ? remote : local;
}

// 比較兩個 clock：A 是否 dominates B
export { clockDominates, mergeClock, bumpClock };
