// modal.js — 雲端設定 modal
// Phase 1 仍沿用 localStorage 存放 webdav 與 gdrive 設定；Phase 5 再改 IndexedDB

import { h, clear, $ } from '../util/dom.js';
import { getMeta, setMeta } from '../core/idb.js';

const LS_WEBDAV = 'lb_webdav';
const LS_GDRIVE = 'lb_gdrive';

export function bindCloudModal() {
  // 還原設定
  const dav = JSON.parse(localStorage.getItem(LS_WEBDAV) || '{}');
  if (dav.url) document.getElementById('davUrl').value = dav.url;
  if (dav.user) document.getElementById('davUser').value = dav.user;
  if (dav.pass) document.getElementById('davPass').value = dav.pass;
  const g = JSON.parse(localStorage.getItem(LS_GDRIVE) || '{}');
  if (g.clientId) document.getElementById('gClientId').value = g.clientId;
  if (g.apiKey) document.getElementById('gApiKey').value = g.apiKey;
}

window.switchTab = function (tab) {
  if (tab === 'webdav') {
    document.getElementById('webdav-section').style.display = 'block';
    document.getElementById('gdrive-section').style.display = 'none';
    document.getElementById('tab-webdav').style.borderBottom = '2px solid #3498db';
    document.getElementById('tab-gdrive').style.borderBottom = 'none';
  } else {
    document.getElementById('webdav-section').style.display = 'none';
    document.getElementById('gdrive-section').style.display = 'block';
    document.getElementById('tab-gdrive').style.borderBottom = '2px solid #3498db';
    document.getElementById('tab-webdav').style.borderBottom = 'none';
  }
};

window.toggleCloudModal = function (show) {
  document.getElementById('cloudModal').style.display = show ? 'flex' : 'none';
  document.getElementById('davTestStatus').innerText = '';
};

window.saveCloudConfig = function () {
  const webdavConfig = {
    url: document.getElementById('davUrl').value.trim(),
    user: document.getElementById('davUser').value.trim(),
    pass: document.getElementById('davPass').value.trim(),
  };
  localStorage.setItem(LS_WEBDAV, JSON.stringify(webdavConfig));
  const googleConfig = {
    clientId: document.getElementById('gClientId').value.trim(),
    apiKey: document.getElementById('gApiKey').value.trim(),
  };
  localStorage.setItem(LS_GDRIVE, JSON.stringify(googleConfig));
  window.toggleCloudModal(false);
  // Phase 5 才接上實際同步；這裡只更新按鈕狀態
  const cb = document.getElementById('cloudBtn');
  if (cb) { cb.className = 'synced'; cb.innerText = '☁️ 雲端'; }
};
