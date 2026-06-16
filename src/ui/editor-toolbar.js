// ui/editor-toolbar.js — 編輯/預覽切換、插入檔案按鈕
// 對應 index.html 的 #editorMode / #previewArea

import { renderMarkdown } from '../services/markdown.js';
import { fileToMarkdownImage } from './attachments.js';

let mode = 'edit'; // 'edit' | 'preview'
let editorEl, previewEl, modeBtn, fileInput;

export function bindEditorToolbar() {
  editorEl = document.getElementById('editor');
  previewEl = document.getElementById('previewArea');
  modeBtn = document.getElementById('editorModeBtn');
  const insertBtn = document.getElementById('insertFileBtn');
  fileInput = document.getElementById('fileInputMarkdown');

  if (modeBtn) modeBtn.addEventListener('click', () => setMode(mode === 'edit' ? 'preview' : 'edit'));
  if (insertBtn) insertBtn.addEventListener('click', () => fileInput?.click());
  if (fileInput) fileInput.addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const md = await fileToMarkdownImage(f);
    insertIntoEditor(md);
    fileInput.value = '';
  });

  // 編輯器內容變動時，若在預覽模式，重渲染
  if (editorEl) editorEl.addEventListener('input', () => { if (mode === 'preview') renderPreview(); });
  if (editorEl) editorEl.addEventListener('scroll', () => {
    if (mode === 'preview') {
      const ratio = editorEl.scrollTop / Math.max(1, editorEl.scrollHeight - editorEl.clientHeight);
      previewEl.scrollTop = ratio * Math.max(0, previewEl.scrollHeight - previewEl.clientHeight);
    }
  });
  setMode('edit');
}

export function getMode() { return mode; }

export function setMode(m) {
  mode = m;
  if (!editorEl || !previewEl) return;
  if (mode === 'preview') {
    editorEl.style.display = 'none';
    previewEl.style.display = 'block';
    renderPreview();
    if (modeBtn) modeBtn.textContent = '✏️ 編輯';
  } else {
    editorEl.style.display = 'block';
    previewEl.style.display = 'none';
    if (modeBtn) modeBtn.textContent = '👁️ 預覽';
  }
}

export function renderPreview() {
  if (!previewEl || !editorEl) return;
  const html = renderMarkdown(editorEl.value || '');
  previewEl.innerHTML = html;
}

function insertIntoEditor(text) {
  if (!editorEl) return;
  const start = editorEl.selectionStart ?? editorEl.value.length;
  editorEl.value = editorEl.value.slice(0, start) + text + editorEl.value.slice(start);
  editorEl.focus();
  editorEl.dispatchEvent(new Event('input'));
}

// 載入新 note 時重置預覽
export function resetPreview() {
  if (previewEl) previewEl.innerHTML = '';
  setMode('edit');
}
