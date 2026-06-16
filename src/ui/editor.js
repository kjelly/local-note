// editor.js — 編輯器、標題、置頂、刪除、對照
// 取代原 index.html 內的 #noteContainer / saveCurrentState / togglePin / deleteCurrentNote

import { signal } from '../core/store.js';
import { createNote as makeNote, applyLocalEdit } from '../model/note.js';
import { getAllNotes, putNote, deleteNote as dbDeleteNote } from '../core/idb.js';
import { now, formatTime } from '../util/time.js';

const MAX_HISTORY = 20;
const HISTORY_INTERVAL = 60 * 1000;

export const activeNoteId = signal(null);
export const notesStore = signal([]); // 單一真相源
export const searchKeyword = signal('');
export const searchMode = signal('AND');
export const statusMessage = signal('');

// 從 IndexedDB 載入所有筆記，初始化 store
export async function loadAllNotes() {
  const all = await getAllNotes();
  const migrated = all.map(normalizeMigrated);
  sortNotesInPlace(migrated);
  notesStore.set(migrated);
}

// localStorage → IndexedDB 之後，note 物件已不需要特別 migrate；
// 但若使用者從 v23 直接匯入匯出，title / content 仍是字串
function normalizeMigrated(n) {
  if (!n.updatedAtTs) {
    n.updatedAtTs = Date.parse(n.updatedAt) || Date.now();
  }
  if (!n.updatedAt) n.updatedAt = formatTime(n.updatedAtTs);
  if (!Array.isArray(n.links)) n.links = [];
  if (!Array.isArray(n.history)) n.history = [];
  return n;
}

export function sortNotesInPlace(arr) {
  arr.sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return (b.updatedAtTs || 0) - (a.updatedAtTs || 0);
  });
}

export function getFilteredNotes() {
  const kw = searchKeyword.get().trim().toLowerCase();
  const all = notesStore.get();
  if (!kw) return all;
  const mode = searchMode.get();
  const keys = kw.split(/\s+/).filter(Boolean);
  return all.filter((n) => {
    const txt = (n.title + n.content).toLowerCase();
    return mode === 'AND' ? keys.every((k) => txt.includes(k)) : keys.some((k) => txt.includes(k));
  });
}

export async function createNote(presetTitle = '') {
  const nowDate = new Date();
  const title = presetTitle ||
    `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}-${String(nowDate.getDate()).padStart(2, '0')} ${String(nowDate.getHours()).padStart(2, '0')}:${String(nowDate.getMinutes()).padStart(2, '0')}`;
  const note = makeNote({ title });
  const all = notesStore.get();
  notesStore.set([note, ...all]);
  await persist(note);
  activeNoteId.set(note.id);
  return note;
}

export function loadNote(id) {
  activeNoteId.set(id);
  const note = notesStore.get().find((n) => n.id === id);
  if (!note) return;
  const elTitle = document.getElementById('noteTitle');
  const elEditor = document.getElementById('editor');
  if (elTitle) elTitle.value = note.title || '';
  if (elEditor) elEditor.value = note.content || '';
  document.getElementById('noteContainer').style.display = 'flex';
  document.getElementById('emptyState').style.display = 'none';
  // 通知 links / history 重渲染
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
  const note = notesStore.get().find((n) => n.id === id);
  if (!note) return;
  const elTitle = document.getElementById('noteTitle');
  const elEditor = document.getElementById('editor');
  const newTitle = elTitle?.value ?? '';
  const newContent = elEditor?.value ?? '';
  if (!force && note.title === newTitle && note.content === newContent) return;

  // 時光機
  if (newContent !== note.content) {
    const last = note.history?.[0];
    if (!last || (now() - (last.timestamp || 0) >= HISTORY_INTERVAL)) {
      note.history = note.history || [];
      note.history.unshift({ time: formatTime(now()), timestamp: now(), content: note.content });
      if (note.history.length > MAX_HISTORY) note.history = note.history.slice(0, MAX_HISTORY);
    }
  }

  const next = applyLocalEdit(note, { title: newTitle, content: newContent });
  const all = notesStore.get();
  const idx = all.findIndex((n) => n.id === id);
  if (idx !== -1) all[idx] = next;
  sortNotesInPlace(all);
  notesStore.set([...all]);
  await persist(next);
  statusMessage.set('已儲存');
  setTimeout(() => statusMessage.set(''), 1500);
  // 觸發同步（Phase 1 暫時無 hub，僅在 main.js 註冊時呼叫）
  document.dispatchEvent(new CustomEvent('lb:note-saved', { detail: { id } }));
}

async function persist(note) {
  await putNote(note);
}

// 綁定輸入框事件（由 main.js 啟動時呼叫）
export function bindEditorInputs() {
  const elTitle = document.getElementById('noteTitle');
  const elEditor = document.getElementById('editor');
  if (elTitle) elTitle.addEventListener('input', scheduleSave);
  if (elEditor) elEditor.addEventListener('input', scheduleSave);
  if (elTitle) elTitle.addEventListener('click', () => elTitle.select());
}

export async function deleteCurrentNote() {
  const id = activeNoteId.get();
  if (!id) return;
  if (!confirm('刪除？')) return;
  await dbDeleteNote(id);
  const all = notesStore.get().filter((n) => n.id !== id);
  notesStore.set(all);
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
  const note = all.find((n) => n.id === id);
  if (!note) return;
  note.pinned = !note.pinned;
  note.updatedAtTs = now();
  note.updatedAt = formatTime(note.updatedAtTs);
  sortNotesInPlace(all);
  notesStore.set([...all]);
  persist(note);
  document.dispatchEvent(new CustomEvent('lb:pin-toggled', { detail: { id } }));
}

export async function deleteSelectedNotes(ids) {
  if (!ids || ids.length === 0) return;
  if (!confirm(`刪除 ${ids.length} 筆？`)) return;
  for (const id of ids) await dbDeleteNote(id);
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

// 對照（split）視圖
export function openSplitView(noteId) {
  const panel = document.getElementById('splitPanel');
  if (noteId == null) {
    panel.classList.remove('open');
    return;
  }
  const note = notesStore.get().find((n) => n.id === noteId);
  if (!note) return;
  document.getElementById('splitTitle').textContent = note.title;
  document.getElementById('splitEditor').value = note.content;
  panel.classList.add('open');
}

export function showEmptyState() {
  document.getElementById('noteContainer').style.display = 'none';
  document.getElementById('emptyState').style.display = 'flex';
}

// 搜尋狀態（由 sidebar 同步過來）
export function setSearchKeyword(v) { searchKeyword.set(v); }
export function setSearchMode(v) { searchMode.set(v); }
