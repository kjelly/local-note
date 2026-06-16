// services/markdown.js — marked + DOMPurify
// 把 markdown 字串轉成安全的 HTML 字串（注意：回傳字串，由呼叫端塞到 innerHTML）
// 為了在 jsdom 環境也能運作，DOMPurify 在測試時不強制走 window-only 模式

import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({
  gfm: true,
  breaks: true,
  headerIds: false,
  mangle: false,
});

const ALLOWED_TAGS = [
  'a', 'p', 'br', 'hr', 'strong', 'em', 'b', 'i', 'u', 's', 'del', 'ins', 'mark',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'pre', 'code',
  'img', 'figure', 'figcaption',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'span', 'div', 'small', 'sub', 'sup',
];

const ALLOWED_ATTR = ['href', 'src', 'alt', 'title', 'class', 'id', 'target', 'rel', 'data-id', 'data-note-id'];

const PURIFY_CFG = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  ALLOW_DATA_ATTR: true,
  FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick'],
};

export function renderMarkdown(text) {
  if (!text) return '';
  const raw = marked.parse(text, { async: false });
  return DOMPurify.sanitize(raw, PURIFY_CFG);
}

// 純字串（不過濾）— 給測試或特殊情境
export function renderMarkdownUnsafe(text) {
  if (!text) return '';
  return marked.parse(text, { async: false });
}

// 取得 DOMPurify 實例（讓測試可以驗證 cfg）
export function getPurify() { return DOMPurify; }
