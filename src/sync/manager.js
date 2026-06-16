// sync/manager.js — 同步編排（Phase 2：欄位級 LWW 合併）
// Phase 5 才會接上 ETag / 背景同步，這裡先做 pull-merge-push 骨架

import { webdavGet, webdavPut } from './webdav.js';
import { writeJsonFile } from './disk.js';
import { mergeNote, diffNote } from '../core/lww.js';
import { getAllNotes, putNote, getMeta, setMeta } from '../core/idb.js';

let localFileHandle = null;
let syncTimer = null;

export function setLocalFileHandle(h) { localFileHandle = h; }

export function scheduleSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncUp, 2000);
}

export async function syncUp() {
  const all = await getAllNotes();
  try {
    await webdavPut(all);
    await setMeta('lastSyncUp', Date.now());
    updateBtn('cloudBtn', 'synced', '雲端');
  } catch (e) {
    updateBtn('cloudBtn', 'error', '失敗');
  }
  if (localFileHandle) {
    await writeJsonFile(localFileHandle, all);
    updateBtn('diskBtn', 'synced', '硬碟');
  }
}

// 拉遠端並做欄位級合併
export async function syncDown() {
  const remote = await webdavGet();
  if (!Array.isArray(remote)) return;
  const local = await getAllNotes();
  const localMap = new Map(local.map((n) => [n.id, n]));
  let changes = 0;
  for (const r of remote) {
    const rn = r.id ? r : null;
    if (!rn) continue;
    const l = localMap.get(rn.id);
    if (!l) { await putNote(rn); changes++; continue; }
    const merged = mergeNote(l, rn);
    if (merged && merged !== l) { await putNote(merged); changes++; }
  }
  if (changes > 0) {
    document.dispatchEvent(new CustomEvent('lb:notes-updated'));
  }
  await setMeta('lastSyncDown', Date.now());
  return { changes };
}

function updateBtn(id, cls, text) {
  const b = document.getElementById(id);
  if (!b) return;
  b.className = cls;
  b.innerText = text;
}
