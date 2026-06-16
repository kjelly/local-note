// sync/manager.js — 同步編排（Phase 5）
// pull-merge-push 三步驟；衝突時 mergeNote 再嘗試

import { webdavGetWithEtag, webdavPutWithEtag, ConflictError } from './webdav.js';
import { writeJsonFile } from './disk.js';
import { mergeNote } from '../core/lww.js';
import { getAllNotes, putNote, getMeta, setMeta } from '../core/idb.js';
import { getConfig } from '../core/config.js';
import { enqueue, drain } from './queue.js';

let localFileHandle = null;
let syncTimer = null;
let lastEtag = null;

export function setLocalFileHandle(h) { localFileHandle = h; }

export function scheduleSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncUp, 1500);
}

export async function syncUp() {
  await drain(async (op) => {
    if (op === 'push:webdav') await pushToWebDAV();
    else if (op === 'push:disk') await pushToDisk();
    else throw new Error('unknown op: ' + op);
  });
}

export async function pushToDisk() {
  const all = await getAllNotes();
  if (localFileHandle) {
    await writeJsonFile(localFileHandle, all);
    updateBtn('diskBtn', 'synced', '硬碟');
  }
}

export async function pushToWebDAV() {
  const webdavCfg = await getConfig('webdav');
  if (!webdavCfg?.url) return;
  const all = await getAllNotes();
  const r = await webdavPutWithEtag(all, lastEtag);
  if (r.etag) lastEtag = r.etag;
  await setMeta('webdavEtag', lastEtag);
  updateBtn('cloudBtn', 'synced', '雲端');
}

// 完整 reconcile：GET 遠端 → 與本地 LWW 合併 → 寫回本地 → 再 PUT（帶 ETag）
export async function reconcile() {
  const webdavCfg = await getConfig('webdav');
  if (!webdavCfg?.url) return { skipped: 'no webdav' };
  lastEtag = (await getMeta('webdavEtag')) || null;
  // 1. 拉遠端
  const remote0 = await webdavGetWithEtag();
  const remote = remote0.data;
  if (remote0.etag) lastEtag = remote0.etag;

  // 2. 與本地合併
  const local = await getAllNotes();
  const localMap = new Map(local.map((n) => [n.id, n]));
  let merged = local;
  if (Array.isArray(remote)) {
    for (const r of remote) {
      const l = localMap.get(r.id);
      if (!l) {
        merged.push(r);
        await putNote(r);
        continue;
      }
      const m = mergeNote(l, r);
      if (m && m !== l) {
        await putNote(m);
        const idx = merged.findIndex((n) => n.id === m.id);
        if (idx !== -1) merged[idx] = m;
      }
    }
  }

  // 3. 帶 ETag 上傳
  try {
    const r = await webdavPutWithEtag(merged, lastEtag);
    if (r.etag) lastEtag = r.etag;
    await setMeta('webdavEtag', lastEtag);
    updateBtn('cloudBtn', 'synced', '雲端');
    document.dispatchEvent(new CustomEvent('lb:notes-updated', { detail: { source: 'reconcile' } }));
    return { ok: true, changes: merged.length };
  } catch (err) {
    if (err instanceof ConflictError) {
      // 退一步：再 pull 一次、合併、再嘗試（最多 3 次）
      for (let i = 0; i < 3; i++) {
        try {
          const cur = await webdavGetWithEtag();
          if (cur.etag) lastEtag = cur.etag;
          // 與我們的 merged 再合併一次
          const curMap = new Map((cur.data || []).map((n) => [n.id, n]));
          for (const r of (cur.data || [])) {
            const ours = merged.find((n) => n.id === r.id);
            if (!ours) { merged.push(r); await putNote(r); continue; }
            const m = mergeNote(ours, r);
            if (m && m !== ours) {
              await putNote(m);
              const idx = merged.findIndex((n) => n.id === m.id);
              if (idx !== -1) merged[idx] = m;
            }
          }
          const r2 = await webdavPutWithEtag(merged, lastEtag);
          if (r2.etag) lastEtag = r2.etag;
          await setMeta('webdavEtag', lastEtag);
          updateBtn('cloudBtn', 'synced', '雲端');
          document.dispatchEvent(new CustomEvent('lb:notes-updated', { detail: { source: 'reconcile-retry' } }));
          return { ok: true, retried: i + 1 };
        } catch (e2) {
          if (!(e2 instanceof ConflictError)) throw e2;
        }
      }
      updateBtn('cloudBtn', 'error', '衝突');
      return { ok: false, conflict: true };
    }
    updateBtn('cloudBtn', 'error', '失敗');
    throw err;
  }
}

export async function syncDown() {
  return reconcile();
}

// 本地變動時加入 push 排程
export function enqueuePush(target = 'webdav') {
  return enqueue(`push:${target}`);
}

function updateBtn(id, cls, text) {
  const b = document.getElementById(id);
  if (!b) return;
  b.className = cls;
  b.innerText = text;
}

// 啟動時把 lastEtag 讀回
export async function bootstrapSync() {
  lastEtag = (await getMeta('webdavEtag')) || null;
}

// 註冊背景同步：在 SW sync 事件被觸發時主動 reconcile
export function registerBackgroundSync() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  if (typeof SyncManager === 'undefined') return;
  navigator.serviceWorker.ready.then((reg) => {
    return reg.sync.register('lb-reconcile').catch(() => {});
  });
}
