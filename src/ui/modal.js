// ui/modal.js — 雲端設定 modal（Phase 3：改用 IndexedDB meta 取代 localStorage）

import { getConfig, setConfig } from '../core/config.js';
import { webdavTestHandler } from '../sync/webdav.js';

export async function bindCloudModal() {
  const dav = (await getConfig('webdav')) || {};
  if (dav.url) document.getElementById('davUrl').value = dav.url;
  if (dav.user) document.getElementById('davUser').value = dav.user;
  if (dav.pass) document.getElementById('davPass').value = dav.pass;
  const g = (await getConfig('gdrive')) || {};
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

window.saveCloudConfig = async function () {
  const webdavConfig = {
    url: document.getElementById('davUrl').value.trim(),
    user: document.getElementById('davUser').value.trim(),
    pass: document.getElementById('davPass').value.trim(),
  };
  await setConfig('webdav', webdavConfig);
  const googleConfig = {
    clientId: document.getElementById('gClientId').value.trim(),
    apiKey: document.getElementById('gApiKey').value.trim(),
  };
  await setConfig('gdrive', googleConfig);
  window.toggleCloudModal(false);
  const cb = document.getElementById('cloudBtn');
  if (cb) { cb.className = 'synced'; cb.innerText = '☁️ 雲端'; }
};

window.testWebDAV = webdavTestHandler;
