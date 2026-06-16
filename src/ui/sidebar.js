// sidebar.js — 側邊欄列表、批次模式、搜尋框
// 對應原 index.html 內的 #sidebar / #noteList / 搜尋邏輯

import { h, clear, delegate } from '../util/dom.js';
import { createNote, loadNote, openSplitView, setSearchKeyword, setSearchMode } from './editor.js';

let isBatchMode = false;

export function mountSidebar(root) {
  const noteList = root.querySelector('#noteList');
  const searchInput = root.querySelector('#searchInput');

  searchInput.addEventListener('input', () => {
    setSearchKeyword(searchInput.value);
  });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const list = noteList.querySelectorAll('.note-item');
      if (list.length === 0 && searchInput.value.trim()) {
        createNote(searchInput.value.trim());
        searchInput.value = '';
      }
    }
  });

  root.querySelectorAll('input[name="searchMode"]').forEach((r) => {
    r.addEventListener('change', () => setSearchMode(r.value));
  });

  delegate(noteList, 'click', '.note-item', (e, li) => {
    if (e.target.tagName === 'BUTTON' || e.target.classList.contains('split-btn')) return;
    const id = li.dataset.id;
    if (isBatchMode) {
      if (e.target.tagName === 'INPUT') return;
      const cb = li.querySelector('.batch-checkbox');
      if (cb) cb.checked = !cb.checked;
    } else {
      loadNote(id);
    }
  });

  delegate(noteList, 'click', '.split-btn', (e, btn) => {
    e.stopPropagation();
    const id = btn.dataset.id;
    openSplitView(id);
  });
}

export function getBatchMode() { return isBatchMode; }
export function setBatchMode(v) {
  isBatchMode = !!v;
  const sidebar = document.getElementById('sidebar');
  const normal = document.getElementById('normalActions');
  const batch = document.getElementById('batchActions');
  if (!sidebar) return;
  sidebar.classList.toggle('batch-mode', isBatchMode);
  if (normal) normal.style.display = isBatchMode ? 'none' : 'flex';
  if (batch) batch.style.display = isBatchMode ? 'flex' : 'none';
}

// 渲染列表（呼叫方傳入 notes 與當前 activeNoteId）
export function renderSidebarList(notes, activeNoteId) {
  const list = document.getElementById('noteList');
  if (!list) return;
  clear(list);
  if (notes.length === 0) {
    list.appendChild(h('div', { style: 'padding:20px; text-align:center; color:#888;' }, '無筆記'));
    return;
  }
  for (const n of notes) {
    const li = h('li', {
      class: 'note-item' + (n.id === activeNoteId ? ' active' : ''),
      dataset: { id: n.id },
    });
    const info = h('div', { class: 'note-info' });
    if (n.pinned) info.appendChild(h('span', { style: 'color:#f1c40f;margin-right:5px;' }, '📌'));
    info.appendChild(h('span', { class: 'title' }, n.title || '(無標題)'));
    info.appendChild(h('span', { class: 'preview' }, (n.content || '').slice(0, 40).replace(/\n/g, ' ')));
    li.appendChild(info);
    if (isBatchMode) {
      const cb = h('input', { type: 'checkbox', class: 'batch-checkbox', value: n.id });
      li.appendChild(cb);
    } else {
      li.appendChild(h('button', {
        class: 'split-btn',
        title: '對照',
        dataset: { id: n.id },
      }, '👀'));
    }
    list.appendChild(li);
  }
}
