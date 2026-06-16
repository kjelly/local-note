// toast.js — 簡單的提示元件
// Phase 1 用 alert / console 即可；這個檔案先留著當 placeholder，避免日後 UI 改不斷改 main.js

import { h } from '../util/dom.js';

export function toast(message, { type = 'info', timeout = 3000 } = {}) {
  const root = document.getElementById('toast-root') || createRoot();
  const el = h('div', { class: `toast toast-${type}` }, message);
  root.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, timeout);
}

function createRoot() {
  const r = h('div', { id: 'toast-root', style: 'position:fixed;bottom:20px;right:20px;z-index:3000;display:flex;flex-direction:column;gap:8px;' });
  document.body.appendChild(r);
  return r;
}
