// sync/manager.js — 同步編排
// Phase 1：建立介面 + 簡易 debounce；Phase 5 接入三向合併

import { webdavGet, webdavPut } from './webdav.js';
import { writeJsonFile } from './disk.js';
import { mergeNoteByTimestamp } from '../model/note.js';
import { getAllNotes, putNote } from '../core/idb.js';

let localFileHandle = null;
let syncTimer = null;

export function setLocalFileHandle(h) { localFileHandle = h; }

export function scheduleSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncUp, 2000);
}

export async function syncUp() {
  const all = await getAllNotes();
  // WebDAV
  try {
    await webdavPut(all);
    updateBtn('cloudBtn', 'synced', '雲端');
  } catch (e) {
    updateBtn('cloudBtn', 'error', '失敗');
  }
  // 本機檔
  if (localFileHandle) {
    await writeJsonFile(localFileHandle, all);
    updateBtn('diskBtn', 'synced', '硬碟');
  }
}

export async function syncDown() {
  try {
    const remote = await webdavGet();
    if (!Array.isArray(remote)) return;
    const local = await getAllNotes();
    const localMap = new Map(local.map((n) => [n.id, n]));
    let changes = 0;
    for (const r of remote) {
      const l = localMap.get(r.id);
      if (!l) { await putNote(r); changes++; continue; }
      const merged = mergeNoteByTimestamp(l, r);
      if (merged !== l) { await putNote(merged); changes++; }
    }
    if (changes > 0) {
      document.dispatchEvent(new CustomEvent('lb:notes-updated'));
    }
  } catch (e) {
    updateBtn('cloudBtn', 'error', '錯誤');
  }
}

function updateBtn(id, cls, text) {
  const b = document.getElementById(id);
  if (!b) return;
  b.className = cls;
  b.innerText = text;
}
