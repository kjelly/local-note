// history.js — 時光機

import { h, clear } from '../util/dom.js';
import { notesStore, activeNoteId, scheduleSave } from './editor.js';

export function bindHistory() {
  const sel = document.getElementById('historySelect');
  if (!sel) return;
  sel.addEventListener('change', (e) => {
    const idx = e.target.value;
    if (idx != -1) openPreview(parseInt(idx, 10));
    e.target.value = '-1';
  });
  document.addEventListener('lb:note-loaded', () => updateHistoryUI());
}

function updateHistoryUI() {
  const sel = document.getElementById('historySelect');
  if (!sel) return;
  clear(sel);
  sel.appendChild(h('option', { value: '-1' }, '時光機'));
  const cur = notesStore.get().find((n) => n.id === activeNoteId.get());
  if (!cur) return;
  (cur.history || []).forEach((h0, i) => {
    const opt = h('option', { value: String(i) }, h0.time);
    sel.appendChild(opt);
  });
}

let pendingRestoreIndex = -1;

function openPreview(idx) {
  const cur = notesStore.get().find((n) => n.id === activeNoteId.get());
  if (!cur || !cur.history[idx]) return;
  pendingRestoreIndex = idx;
  const content = document.getElementById('previewContent');
  content.textContent = cur.history[idx].content;
  document.getElementById('previewModal').style.display = 'flex';
}

function closePreview() {
  document.getElementById('previewModal').style.display = 'none';
  pendingRestoreIndex = -1;
}

function confirmRestore() {
  if (pendingRestoreIndex === -1) return;
  const all = notesStore.get();
  const cur = all.find((n) => n.id === activeNoteId.get());
  if (!cur) return;
  const ed = document.getElementById('editor');
  if (!cur.history) cur.history = [];
  cur.history.unshift({ time: new Date().toLocaleString(), timestamp: Date.now(), content: cur.content });
  ed.value = cur.history[pendingRestoreIndex].content;
  closePreview();
  scheduleSave();
}

// 提供給 HTML 內 inline button
window.closePreview = closePreview;
window.confirmRestore = confirmRestore;
