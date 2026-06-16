// sync/webdav.js — WebDAV GET/PUT/測試
// Phase 5：支援 ETag 拿取與 If-Match 衝突偵測

import { getConfig } from '../core/config.js';

async function getCfg() {
  return (await getConfig('webdav')) || {};
}

function authHeader(cfg) {
  return cfg.user ? { Authorization: 'Basic ' + btoa(`${cfg.user}:${cfg.pass}`) } : {};
}

// 測試連線
export async function testWebDAV(url, user, pass) {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      headers: { Authorization: 'Basic ' + btoa(`${user}:${pass}`) },
    });
    if (res.ok || res.status === 404) return { ok: true };
    return { ok: false, error: String(res.status) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export const webdavTestHandler = async function () {
  const url = document.getElementById('davUrl').value;
  const user = document.getElementById('davUser').value;
  const pass = document.getElementById('davPass').value;
  const status = document.getElementById('davTestStatus');
  status.innerText = '連線中...';
  const r = await testWebDAV(url, user, pass);
  if (r.ok) { status.innerText = '成功'; status.style.color = 'green'; }
  else { status.innerText = '失敗: ' + r.error; status.style.color = 'red'; }
};

// 衝突：throw ConflictError，攜帶 current ETag 與 current body
export class ConflictError extends Error {
  constructor({ etag, body }) {
    super('webdav 412 precondition failed');
    this.name = 'ConflictError';
    this.etag = etag || null;
    this.body = body || null;
  }
}

// GET：回傳 { data, etag }；etag 可能為 null
export async function webdavGetWithEtag() {
  const cfg = await getCfg();
  if (!cfg.url) return { data: null, etag: null };
  const res = await fetch(cfg.url, {
    method: 'GET',
    headers: { ...authHeader(cfg), 'Cache-Control': 'no-cache' },
  });
  if (res.status === 404) return { data: null, etag: null };
  if (!res.ok) throw new Error(`GET failed: ${res.status}`);
  const data = await res.json();
  const etag = res.headers.get('ETag') || res.headers.get('etag') || null;
  return { data, etag };
}

export async function webdavGet() {
  const r = await webdavGetWithEtag();
  return r.data;
}

// PUT with If-Match：etag 為 null 表示強制覆寫
export async function webdavPutWithEtag(payload, etag = null) {
  const cfg = await getCfg();
  if (!cfg.url) return { ok: false, error: 'no url', etag: null };
  const headers = { ...authHeader(cfg), 'Content-Type': 'application/json' };
  if (etag) headers['If-Match'] = etag;
  const res = await fetch(cfg.url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(payload),
  });
  if (res.status === 412) {
    // 衝突：取回當前遠端內容
    const cur = await webdavGetWithEtag();
    throw new ConflictError({ etag: cur.etag, body: cur.data });
  }
  if (!res.ok) return { ok: false, error: `status ${res.status}`, etag: null };
  const newEtag = res.headers.get('ETag') || res.headers.get('etag') || null;
  return { ok: true, error: null, etag: newEtag };
}

export async function webdavPut(payload) {
  try {
    const r = await webdavPutWithEtag(payload, null);
    return { ok: r.ok, error: r.error };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
