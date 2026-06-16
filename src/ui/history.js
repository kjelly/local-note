// history.js — 時光機

import { h, clear } from '../util/dom.js';
import { notesStore, activeNoteId, scheduleSave, restoreFromHistory } from './editor.js';
import { putNote } from '../core/idb.js';
import { trapFocus, focusFirst, onEscape, setAria } from '../core/a11y.js';

let unbindTrap = null;
let unbindEsc = null;
let lastFocus = null;

export function bindHistory() {
  const sel = document.getElementById('historySelect');
  if (!sel) return;
  sel.addEventListener('change', (e) => {
    const idx = e.target.value;
    if (idx !== -1) openPreview(parseInt(idx, 10));
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
  const overlay = document.getElementById('previewModal');
  const box = overlay.querySelector('.modal-box');
  const content = document.getElementById('previewContent');
  content.textContent = cur.history[idx].content;
  lastFocus = document.activeElement;
  overlay.style.display = 'flex';
  setAria(overlay, { 'role': 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'previewModalTitle' });
  focusFirst(box || overlay);
  unbindTrap = trapFocus(box || overlay);
  unbindEsc = onEscape(overlay, closePreview);
}

function closePreview() {
  const overlay = document.getElementById('previewModal');
  overlay.style.display = 'none';
  pendingRestoreIndex = -1;
  if (unbindTrap) { unbindTrap(); unbindTrap = null; }
  if (unbindEsc) { unbindEsc(); unbindEsc = null; }
  if (lastFocus && typeof lastFocus.focus === 'function') {
    lastFocus.focus();
    lastFocus = null;
  }
}

function confirmRestore() {
  if (pendingRestoreIndex === -1) return;
  const all = notesStore.get();
  const idx = all.findIndex((n) => n.id === activeNoteId.get());
  if (idx === -1) return;
  const cur = all[idx];
  const next = restoreFromHistory(cur, pendingRestoreIndex);
  if (next === cur) return;
  all[idx] = next;
  notesStore.set([...all]);
  document.getElementById('editor').value = next.content.value;
  putNote({ ...next, updatedAt: Date.now() });
  closePreview();
  scheduleSave();
}

window.closePreview = closePreview;
window.confirmRestore = confirmRestore;
