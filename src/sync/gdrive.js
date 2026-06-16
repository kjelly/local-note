// sync/gdrive.js — Google Drive
// Phase 1 僅佔位（建立 gapi 載入 + 登入流程），實際同步在 Phase 5 接入

const LS_GDRIVE = 'lb_gdrive';

function getConfig() {
  try { return JSON.parse(localStorage.getItem(LS_GDRIVE) || '{}'); }
  catch { return {}; }
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
  const cfg = getConfig();
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
