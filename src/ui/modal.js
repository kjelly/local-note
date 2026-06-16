// ui/modal.js — 雲端設定 modal
// Phase 7：focus trap、Esc 關閉、aria-modal/role

import { getConfig, setConfig } from '../core/config.js';
import { webdavTestHandler } from '../sync/webdav.js';
import { trapFocus, focusFirst, onEscape, setAria } from '../core/a11y.js';

let unbindTrap = null;
let unbindEsc = null;
let lastFocus = null;

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
  const overlay = document.getElementById('cloudModal');
  const box = overlay.querySelector('.modal-box');
  if (show) {
    lastFocus = document.activeElement;
    overlay.style.display = 'flex';
    document.getElementById('davTestStatus').innerText = '';
    setAria(overlay, { 'role': 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'cloudModalTitle' });
    if (box) box.id = box.id || 'cloudModalBox';
    focusFirst(box || overlay);
    unbindTrap = trapFocus(box || overlay);
    unbindEsc = onEscape(overlay, () => window.toggleCloudModal(false));
  } else {
    overlay.style.display = 'none';
    if (unbindTrap) { unbindTrap(); unbindTrap = null; }
    if (unbindEsc) { unbindEsc(); unbindEsc = null; }
    if (lastFocus && typeof lastFocus.focus === 'function') {
      lastFocus.focus();
      lastFocus = null;
    }
  }
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
