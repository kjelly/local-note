// editor.js — 編輯器、標題、置頂、刪除、對照
// Phase 2：note 改為 LWW 結構；store 內部存放完整 LWW 物件，
// UI 層透過 noteView() 取得扁平 view
// Phase 3：搜尋改用反向索引（src/core/search-index.js）

import { signal } from '../core/store.js';
import {
  createNote as makeNote,
  applyPatch,
  noteView,
  pushHistory,
  restoreFromHistory,
} from '../model/note.js';
import {
  getAllNotes, putNote, deleteNote as dbDeleteNote, deleteAttachmentsByNote,
} from '../core/idb.js';
import { normalizeNote } from '../model/note.js';
import { buildIndex, indexUpdate, searchIndex, fuzzyFallback } from '../core/search-index.js';
import { attachToEditor } from './attachments.js';
import { bindEditorToolbar, renderPreview, resetPreview } from './editor-toolbar.js';

const HISTORY_INTERVAL = 60 * 1000;
const MAX_HISTORY = 20;

export const activeNoteId = signal(null);
export const notesStore = signal([]); // 完整 LWW 物件
export const searchKeyword = signal('');
export const searchMode = signal('AND');
export const statusMessage = signal('');
let searchIdx = new Map();

export async function loadAllNotes() {
  const all = await getAllNotes();
  const migrated = all.map(normalizeNote);
  sortNotesInPlace(migrated);
  notesStore.set(migrated);
  searchIdx = buildIndex(migrated);
}

// 用 noteView 給 UI 用：title/content 攤平；同時支援排序用 updatedAt
export function sortNotesInPlace(arr) {
  arr.sort((a, b) => {
    const ap = !!a.pinned?.value;
    const bp = !!b.pinned?.value;
    if (ap !== bp) return ap ? -1 : 1;
    const at = latestTs(a);
    const bt = latestTs(b);
    return bt - at;
  });
}

function latestTs(note) {
  return Math.max(
    note.title?.updatedAt || 0,
    note.content?.updatedAt || 0,
    note.links?.updatedAt || 0,
    note.pinned?.updatedAt || 0,
    note.createdAt || 0,
  );
}

export function getFilteredNotes() {
  const kw = searchKeyword.get().trim();
  const all = notesStore.get();
  if (!kw) return all;
  const mode = searchMode.get();
  // 先用反向索引
  const ids = searchIndex(searchIdx, kw, mode);
  if (ids != null) {
    const idSet = new Set(ids);
    const hits = all.filter((n) => idSet.has(n.id));
    // 沒命中時 fallback 到 O(n) 模糊搜尋（中日韓可能 tokenize 漏）
    if (hits.length === 0) return fuzzyFallback(all, kw, mode);
    return hits;
  }
  return fuzzyFallback(all, kw, mode);
}

export async function createNote(presetTitle = '') {
  const nowDate = new Date();
  const title = presetTitle ||
    `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}-${String(nowDate.getDate()).padStart(2, '0')} ${String(nowDate.getHours()).padStart(2, '0')}:${String(nowDate.getMinutes()).padStart(2, '0')}`;
  const note = makeNote({ title });
  const all = notesStore.get();
  notesStore.set([note, ...all]);
  indexUpdate(searchIdx, null, note);
  await persist(note);
  activeNoteId.set(note.id);
  return note;
}

export function loadNote(id) {
  activeNoteId.set(id);
  const note = notesStore.get().find((n) => n.id === id);
  if (!note) return;
  const view = noteView(note);
  const elTitle = document.getElementById('noteTitle');
  const elEditor = document.getElementById('editor');
  if (elTitle) elTitle.value = view.title;
  if (elEditor) elEditor.value = view.content;
  document.getElementById('noteContainer').style.display = 'flex';
  document.getElementById('emptyState').style.display = 'none';
  resetPreview();
  renderPreview();
  document.dispatchEvent(new CustomEvent('lb:note-loaded', { detail: { id } }));
}

let saveTimer = null;
export function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveCurrentState, 800);
}

export async function saveCurrentState(force = false) {
  const id = activeNoteId.get();
  if (!id) return;
  const all = notesStore.get();
  const idx = all.findIndex((n) => n.id === id);
  if (idx === -1) return;
  const note = all[idx];
  const elTitle = document.getElementById('noteTitle');
  const elEditor = document.getElementById('editor');
  const newTitle = elTitle?.value ?? '';
  const newContent = elEditor?.value ?? '';

  const view = noteView(note);
  if (!force && view.title === newTitle && view.content === newContent) return;

  // 時光機
  let withHistory = note;
  if (newContent !== view.content) {
    const last = note.history?.[0];
    if (!last || (Date.now() - (last.timestamp || 0) >= HISTORY_INTERVAL)) {
      withHistory = pushHistory(note, {
        time: new Date().toLocaleString(),
        timestamp: Date.now(),
        content: view.content,
      });
    }
  }

  const next = applyPatch(withHistory, { title: newTitle, content: newContent });
  if (next === note) return; // 無 dirty

  all[idx] = next;
  sortNotesInPlace(all);
  notesStore.set([...all]);
  indexUpdate(searchIdx, id, next);
  await persist(next);
  statusMessage.set('已儲存');
  setTimeout(() => statusMessage.set(''), 1500);
  document.dispatchEvent(new CustomEvent('lb:note-saved', { detail: { id } }));
}

async function persist(note) {
  // 把最新 updatedAt 寫到頂層供索引使用
  const updatedAt = Math.max(
    note.title?.updatedAt || 0,
    note.content?.updatedAt || 0,
    note.links?.updatedAt || 0,
    note.pinned?.updatedAt || 0,
  );
  await putNote({ ...note, updatedAt });
}

export function bindEditorInputs() {
  const elTitle = document.getElementById('noteTitle');
  const elEditor = document.getElementById('editor');
  if (elTitle) {
    elTitle.addEventListener('input', scheduleSave);
    elTitle.addEventListener('click', () => elTitle.select());
  }
  if (elEditor) elEditor.addEventListener('input', scheduleSave);
  // Phase 6：拖拽/貼上附件、編輯/預覽切換
  bindEditorToolbar();
  attachToEditor(elEditor, { noteId: null });
}

export async function deleteCurrentNote() {
  const id = activeNoteId.get();
  if (!id) return;
  if (!confirm('刪除？')) return;
  await dbDeleteNote(id);
  await deleteAttachmentsByNote(id);
  const all = notesStore.get().filter((n) => n.id !== id);
  notesStore.set(all);
  indexUpdate(searchIdx, id, null);
  activeNoteId.set(null);
  document.getElementById('noteContainer').style.display = 'none';
  document.getElementById('emptyState').style.display = all.length > 0 ? 'none' : 'flex';
  if (all.length > 0) loadNote(all[0].id);
  document.dispatchEvent(new CustomEvent('lb:note-deleted', { detail: { id } }));
}

export function togglePin() {
  const id = activeNoteId.get();
  if (!id) return;
  const all = notesStore.get();
  const idx = all.findIndex((n) => n.id === id);
  if (idx === -1) return;
  const note = all[idx];
  const next = applyPatch(note, { pinned: !note.pinned.value });
  if (next === note) return;
  all[idx] = next;
  sortNotesInPlace(all);
  notesStore.set([...all]);
  persist(next);
  document.dispatchEvent(new CustomEvent('lb:pin-toggled', { detail: { id } }));
}

export async function deleteSelectedNotes(ids) {
  if (!ids || ids.length === 0) return;
  if (!confirm(`刪除 ${ids.length} 筆？`)) return;
  for (const id of ids) {
    await dbDeleteNote(id);
    indexUpdate(searchIdx, id, null);
  }
  const all = notesStore.get().filter((n) => !ids.includes(n.id));
  notesStore.set(all);
  if (ids.includes(activeNoteId.get())) {
    activeNoteId.set(null);
    document.getElementById('noteContainer').style.display = 'none';
    document.getElementById('emptyState').style.display = all.length > 0 ? 'none' : 'flex';
    if (all.length > 0) loadNote(all[0].id);
  }
  document.dispatchEvent(new CustomEvent('lb:batch-deleted', { detail: { ids } }));
}

export function openSplitView(noteId) {
  const panel = document.getElementById('splitPanel');
  if (noteId == null) {
    panel.classList.remove('open');
    return;
  }
  const note = notesStore.get().find((n) => n.id === noteId);
  if (!note) return;
  const view = noteView(note);
  document.getElementById('splitTitle').textContent = view.title || '(無標題)';
  document.getElementById('splitEditor').value = view.content;
  panel.classList.add('open');
}

export function showEmptyState() {
  document.getElementById('noteContainer').style.display = 'none';
  document.getElementById('emptyState').style.display = 'flex';
}

export function setSearchKeyword(v) { searchKeyword.set(v); }
export function setSearchMode(v) { searchMode.set(v); }
export function loadNoteFromView(id) { return loadNote(id); }

// 給 history.js 用的時光機
export { restoreFromHistory };
