// sync/gdrive.js — Google Drive
// Phase 3：設定改存 IndexedDB meta

import { getConfig } from '../core/config.js';

async function getCfg() {
  return (await getConfig('gdrive')) || {};
}

export function ensureGapiLoaded() {
  return new Promise((resolve) => {
    if (typeof gapi !== 'undefined') return resolve();
    const s = document.createElement('script');
    s.src = 'https://apis.google.com/js/api.js';
    s.onload = () => resolve();
    document.head.appendChild(s);
  });
}

export async function initGapi() {
  const cfg = await getCfg();
  if (!cfg.apiKey) return;
  await new Promise((res) => gapi.load('client', res));
  try {
    await gapi.client.init({ apiKey: cfg.apiKey, discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'] });
    await gapi.client.load('drive', 'v3');
  } catch (e) {
    const el = document.getElementById('gDriveStatus');
    if (el) el.innerText = 'GAPI Init Fail. Check Console.';
    console.error(e);
  }
}
