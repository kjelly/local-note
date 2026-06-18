// main.js — bootstrap
// 1. 註冊 service worker
// 2. 跑 IndexedDB migration
// 3. 初始化各 UI 元件
// 4. 串接 store 訂閱，驅動畫面重渲染
// 5. 用 data-action 屬性綁定 inline button（避免 CSP 阻擋 inline onclick）

import { putNote, storageUsageRatio } from './core/idb.js';
import { runMigration, clearLegacyIfExpired } from './core/migration.js';
import { mountSidebar, renderSidebarList, setBatchMode } from './ui/sidebar.js';
import {
  notesStore, activeNoteId, statusMessage,
  loadAllNotes, loadNote, showEmptyState,
  bindEditorInputs, createNote,
  deleteCurrentNote, togglePin,
  deleteSelectedNotes, openSplitView,
  getFilteredNotes,
} from './ui/editor.js';
import { bindLinks, toggleLinkSearch } from './ui/links.js';
import { bindHistory, closePreview, confirmRestore } from './ui/history.js';
import {
  bindAIPanel, toggleAISidebar, sendToAI, summarizeNote, clearChat,
} from './ui/ai-panel.js';
import {
  bindCloudModal, switchTab, toggleCloudModal, saveCloudConfig,
} from './ui/modal.js';
import { installShortcuts, onShortcut } from './util/shortcut.js';
import { initGapi } from './sync/gdrive.js';
import { pickAndLinkFile } from './sync/disk.js';
import {
  setLocalFileHandle, scheduleSync, reconcile,
  enqueuePush, bootstrapSync, registerBackgroundSync,
} from './sync/manager.js';
import { webdavTestHandler } from './sync/webdav.js';

async function boot() {
  console.log('[lb] booting v24...');

  // 1. 註冊 PWA manifest（data URL）與 service worker
  registerManifest();
  registerSW();

  // 2. 跑 migration
  try {
    const r = await runMigration();
    if (r.migrated) console.log(`[lb] migration: ${r.migrated} 筆從 localStorage 匯入`);
  } catch (e) { console.error('[lb] migration failed', e); }
  clearLegacyIfExpired().catch(() => {});

  // 3. 載入所有筆記
  try {
    await loadAllNotes();
    console.log(`[lb] 載入 ${notesStore.get().length} 筆筆記`);
  } catch (e) { console.error('[lb] loadAllNotes failed', e); }

  // 4. 配額
  checkQuota();

  // 5. 綁定 UI 元件
  try {
    bindUI();
    bindCloudModal();
    bindAIPanel();
    bindHistory();
    bindLinks();
    mountSidebar(document.getElementById('sidebar'));
    bindEditorInputs();
  } catch (e) { console.error('[lb] bindUI failed', e); }

  // 6. 初始顯示
  if (notesStore.get().length > 0) loadNote(notesStore.get()[0].id);
  else showEmptyState();

  // 7. 立刻 render 一次 sidebar（即使沒有 subscribe 觸發）
  try {
    renderSidebarList(getFilteredNotes(), activeNoteId.get());
  } catch (e) { console.error('[lb] initial render failed', e); }

  // 8. store 訂閱 → 畫面
  notesStore.subscribe((all) => {
    renderSidebarList(getFilteredNotes(), activeNoteId.get());
  });
  activeNoteId.subscribe((id) => {
    if (id) {
      document.getElementById('noteContainer').style.display = 'flex';
      document.getElementById('emptyState').style.display = 'none';
    }
  });
  statusMessage.subscribe((m) => {
    const el = document.getElementById('status');
    if (el) el.innerText = m || '';
  });

  // 9. 同步 bootstrap
  await bootstrapSync();
  reconcile().catch((e) => console.warn('reconcile failed', e));
  await initGapi().catch((e) => console.warn('gapi init skipped', e));

  // 10. 背景同步訊息
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data?.type === 'lb:sync-trigger') reconcile().catch(() => {});
    });
  }
  registerBackgroundSync();

  // 11. 線上 / 焦點恢復時自動 reconcile
  window.addEventListener('online', () => reconcile().catch(() => {}));
  window.addEventListener('focus', () => reconcile().catch(() => {}));

  // 12. 本地變更 → 排入佇列
  document.addEventListener('lb:note-saved', () => {
    enqueuePush('webdav').then(() => scheduleSync());
  });

  console.log('[lb] boot 完成');
  window.__lb_booted = true;
}

function bindUI() {
  // 一般按鈕（id 直綁）
  document.getElementById('addBtn').addEventListener('click', () => createNote());
  document.getElementById('emptyCreateBtn').addEventListener('click', () => createNote());
  document.getElementById('deleteBtn').addEventListener('click', () => deleteCurrentNote());
  document.getElementById('pinBtn').addEventListener('click', () => togglePin());
  document.getElementById('aiBtn').addEventListener('click', () => toggleAISidebar());
  document.getElementById('openAIBtn').addEventListener('click', () => toggleAISidebar());
  document.getElementById('openSidebarBtn').addEventListener('click', () => toggleSidebar(true));
  document.getElementById('overlayBackdrop').addEventListener('click', () => toggleSidebar(false));
  document.getElementById('closeSplitBtn').addEventListener('click', () => openSplitView(null));
  document.getElementById('addLinkBtn').addEventListener('click', () => toggleLinkSearch());

  document.getElementById('batchBtn').addEventListener('click', () => setBatchMode(true));
  document.getElementById('cancelBatchBtn').addEventListener('click', () => setBatchMode(false));
  document.getElementById('deleteBatchBtn').addEventListener('click', () => {
    const ids = Array.from(document.querySelectorAll('.batch-checkbox:checked')).map((cb) => cb.value);
    deleteSelectedNotes(ids);
  });

  document.getElementById('cloudBtn').addEventListener('click', () => toggleCloudModal(true));
  document.getElementById('diskBtn').addEventListener('click', async () => {
    const h = await pickAndLinkFile();
    if (!h) return;
    setLocalFileHandle(h);
    const btn = document.getElementById('diskBtn');
    if (btn) { btn.className = 'synced'; btn.innerText = '💾 已連結'; }
  });
  document.getElementById('gDriveBtn').addEventListener('click', () => {
    console.log('gdrive sync: pending Phase 5');
  });

  document.getElementById('davTestBtn').addEventListener('click', () => webdavTestHandler());

  document.getElementById('exportBtn').addEventListener('click', () => exportData());
  document.getElementById('importBtn').addEventListener('click', () => document.getElementById('fileInput').click());
  document.getElementById('fileInput').addEventListener('change', (e) => importData(e.target));

  // AI
  document.getElementById('sendBtn').addEventListener('click', () => sendToAI());
  document.getElementById('summarizeBtn').addEventListener('click', () => summarizeNote());
  document.getElementById('clearChatBtn').addEventListener('click', () => clearChat());

  // 用 data-action 綁定（取代 index.html 內的 inline onclick）
  delegateDataAction(document, 'click', {
    'close-cloud-modal': () => toggleCloudModal(false),
    'save-cloud-config': () => saveCloudConfig(),
    'close-sidebar': () => toggleSidebar(false),
    'close-ai-sidebar': () => toggleAISidebar(),
    'close-preview': () => closePreview(),
    'confirm-restore': () => confirmRestore(),
  });
  delegateDataAction(document, 'click', {
    'switch-tab': (el) => switchTab(el.dataset.tab),
  });

  // 快捷鍵
  installShortcuts();
  onShortcut('Ctrl+P', () => document.getElementById('searchInput').focus(), { allowInInputs: false });
  onShortcut('Ctrl+O', () => { const t = document.getElementById('noteTitle'); t.focus(); t.select(); });
  onShortcut('Ctrl+I', () => document.getElementById('editor').focus());
  onShortcut('Ctrl+L', () => toggleLinkSearch());
  onShortcut('Ctrl+J', () => navigateList(1));
  onShortcut('Ctrl+K', () => navigateList(-1));
}

// data-action 事件委派
function delegateDataAction(root, type, handlers) {
  root.addEventListener(type, (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || !root.contains(el)) return;
    const action = el.dataset.action;
    const handler = handlers[action];
    if (handler) handler(el, e);
  });
}

function navigateList(dir) {
  const filtered = getFilteredNotes();
  if (filtered.length === 0) return;
  const cur = activeNoteId.get();
  const idx = filtered.findIndex((n) => n.id === cur);
  let next = idx + dir;
  if (next < 0) next = 0;
  if (next >= filtered.length) next = filtered.length - 1;
  if (next !== idx || !cur) loadNote(filtered[next].id);
}

function toggleSidebar(show) {
  const s = document.getElementById('sidebar');
  const o = document.getElementById('overlayBackdrop');
  if (show) { s.classList.add('mobile-open'); o.style.display = 'block'; }
  else { s.classList.remove('mobile-open'); o.style.display = 'none'; }
}

async function exportData() {
  const all = notesStore.get();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' }));
  a.download = `brain_v24_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
}

async function importData(input) {
  const file = input.files?.[0];
  if (!file) return;
  if (!confirm('覆蓋資料？')) { input.value = ''; return; }
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    for (const n of parsed) await putNote(n);
    await loadAllNotes();
  } catch (e) {
    alert('匯入失敗：' + e.message);
  }
  input.value = '';
}

function registerManifest() {
  const manifest = {
    name: 'Local Brain',
    short_name: 'LocalBrain',
    start_url: '.',
    display: 'standalone',
    background_color: '#2c3e50',
    theme_color: '#2c3e50',
    icons: [{
      src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIiBzdHlsZT0iYmFja2dyb3VuZDojMmMzZTUwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI0MCIgZmlsbD0iIzM0NDk1ZSIvPjxjaXJjbGUgY3g9IjMwIiBjeT0iNDAiIHI9IjUiIGZpbGw9IiMzNDk4ZGIiLz48Y2lyY2xlIGN4PSI3MCIgY3k9IjQwIiByPSI1IiBmaWxsPSIjMzQ5OGRiIi8+PGNpcmNsZSBjeD0iNTAiIGN5PSI3MCIgcj0iNSIgZmlsbD0iIzM0OThkYiIvPjxjaXJjbGUgY3g9IjUwIiBjeT0iMzAiIHI9IjUiIGZpbGw9IiMzNDk4ZGIiLz48cGF0aCBkPSJNMzAgNDAgTDUwIDMwIEw3MCA0MCBMNTAgNzAgWiIgc3Ryb2tlPSIjZWNmMGYxIiBzdHJva2Utd2lkdGg9IjIiIGZpbGw9Im5vbmUiLz48L3N2Zz4=',
      sizes: '192x192 512x512',
      type: 'image/svg+xml',
    }],
  };
  const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
  const ph = document.getElementById('my-manifest-placeholder');
  if (ph) ph.href = URL.createObjectURL(blob);
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  // dev server 不註冊
  if (location.hostname === 'localhost' && location.port === '5173') return;
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('SW register failed', e));
}

async function checkQuota() {
  const r = await storageUsageRatio();
  if (r == null) return;
  if (r > 0.8) {
    console.warn(`[quota] 已使用 ${(r * 100).toFixed(1)}% 的儲存空間`);
  }
}

boot();
