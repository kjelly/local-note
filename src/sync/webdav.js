// sync/webdav.js — WebDAV GET/PUT 與測試
// Phase 3：設定改存 IndexedDB meta

import { getConfig } from '../core/config.js';

async function getCfg() {
  return (await getConfig('webdav')) || {};
}

function authHeader(cfg) {
  return cfg.user ? { Authorization: 'Basic ' + btoa(`${cfg.user}:${cfg.pass}`) } : {};
}

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

export async function webdavGet() {
  const cfg = await getCfg();
  if (!cfg.url) return null;
  const res = await fetch(cfg.url, {
    method: 'GET',
    headers: { ...authHeader(cfg), 'Cache-Control': 'no-cache' },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function webdavPut(payload) {
  const cfg = await getCfg();
  if (!cfg.url) return { ok: false, error: 'no url' };
  try {
    const res = await fetch(cfg.url, {
      method: 'PUT',
      headers: { ...authHeader(cfg), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return { ok: res.ok, error: res.ok ? null : `status ${res.status}` };
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
