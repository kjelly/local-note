// ui/attachments.js — 附件（IndexedDB blob）
// 對外：insertAttachment(file) → 回傳 { id, src }，src 是 object URL
//       getAttachmentUrl(id) → 若已建立 URL 回傳
//       releaseAll() → 切換/卸載時呼叫，撤銷所有 URL

import { uuidv7 } from '../util/id.js';
import { putAttachment, getAttachment, deleteAttachment, getAttachmentsByNote } from '../core/idb.js';

// 目前 active 的 object URLs：id → url
const urlCache = new Map();

export async function insertAttachment(file, noteId = null) {
  const id = uuidv7();
  const att = {
    id,
    noteId,
    mime: file.type || 'application/octet-stream',
    name: file.name || id,
    blob: file,
    size: file.size,
    createdAt: Date.now(),
  };
  await putAttachment(att);
  const url = URL.createObjectURL(file);
  urlCache.set(id, url);
  return { id, src: url, mime: att.mime, name: att.name };
}

export async function loadAttachmentSrc(id) {
  if (urlCache.has(id)) return urlCache.get(id);
  const att = await getAttachment(id);
  if (!att) return null;
  const url = URL.createObjectURL(att.blob);
  urlCache.set(id, url);
  return url;
}

export function releaseAll() {
  for (const url of urlCache.values()) URL.revokeObjectURL(url);
  urlCache.clear();
}

export function release(id) {
  const url = urlCache.get(id);
  if (url) { URL.revokeObjectURL(url); urlCache.delete(id); }
}

export async function removeAttachment(id) {
  release(id);
  return deleteAttachment(id);
}

export async function getAttachmentsForNote(noteId) {
  return getAttachmentsByNote(noteId);
}

// 把使用者拖入或貼上的 File 轉成 markdown 圖片語法
// 回傳要插入編輯器的字串（含換行）
export async function fileToMarkdownImage(file) {
  const { id, src, name, mime } = await insertAttachment(file);
  if (!mime.startsWith('image/')) {
    return `[${name}](${src})`;
  }
  return `![${name || id}](${src})`;
}

// 編輯器 drop / paste 事件處理
export function attachToEditor(editor, { noteId = null } = {}) {
  if (!editor) return;
  const onDrop = async (e) => {
    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length === 0) return;
    e.preventDefault();
    let insertAt = editor.selectionStart ?? editor.value.length;
    for (const f of files) {
      const md = await fileToMarkdownImage(f);
      editor.value = editor.value.slice(0, insertAt) + md + editor.value.slice(insertAt);
      insertAt += md.length;
    }
    editor.dispatchEvent(new Event('input'));
  };
  const onPaste = async (e) => {
    const items = Array.from(e.clipboardData?.items || []);
    const files = items
      .filter((it) => it.kind === 'file')
      .map((it) => it.getAsFile())
      .filter(Boolean);
    if (files.length === 0) return;
    e.preventDefault();
    let insertAt = editor.selectionStart ?? editor.value.length;
    for (const f of files) {
      const md = await fileToMarkdownImage(f);
      editor.value = editor.value.slice(0, insertAt) + md + editor.value.slice(insertAt);
      insertAt += md.length;
    }
    editor.dispatchEvent(new Event('input'));
  };
  editor.addEventListener('drop', onDrop);
  editor.addEventListener('paste', onPaste);
  return () => {
    editor.removeEventListener('drop', onDrop);
    editor.removeEventListener('paste', onPaste);
  };
}
