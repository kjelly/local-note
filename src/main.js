// main.js — bootstrap
// 1. 註冊 service worker
// 2. 跑 IndexedDB migration
// 3. 初始化各 UI 元件
// 4. 串接 store 訂閱，驅動畫面重渲染

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
import { bindHistory } from './ui/history.js';
import { bindAIPanel } from './ui/ai-panel.js';
import { bindCloudModal } from './ui/modal.js';
import { installShortcuts, onShortcut } from './util/shortcut.js';
import { initGapi } from './sync/gdrive.js';
import { pickAndLinkFile } from './sync/disk.js';
import { setLocalFileHandle, scheduleSync } from './sync/manager.js';
import { webdavTestHandler } from './sync/webdav.js';

async function boot() {
  // 1. 註冊 PWA manifest（data URL）與 service worker
  registerManifest();
  registerSW();

  // 2. 跑 migration 並清掉過期 legacy
  try {
    const r = await runMigration();
    if (r.migrated) console.log(`[migration] ${r.migrated} 筆從 localStorage 匯入`);
  } catch (e) { console.error('migration failed', e); }
  clearLegacyIfExpired().catch(() => {});

  // 3. 從 IndexedDB 載入所有筆記
  await loadAllNotes();

  // 4. 配額檢查
  checkQuota();

  // 5. 綁定 UI
  bindUI();
  bindCloudModal();
  bindAIPanel();
  bindHistory();
  bindLinks();
  mountSidebar(document.getElementById('sidebar'));
  bindEditorInputs();

  // 6. 初始顯示
  if (notesStore.get().length > 0) loadNote(notesStore.get()[0].id);
  else showEmptyState();

  // 7. store 訂閱 → 畫面
  notesStore.subscribe((all) => {
    const filtered = getFilteredNotes();
    renderSidebarList(filtered, activeNoteId.get());
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

  // 8. 同步按鈕（Phase 1 暫時只更新視覺）
  await initGapi().catch((e) => console.warn('gapi init skipped', e));

  // 9. 註：sync 觸發在 saveCurrentState 內部
  document.addEventListener('lb:note-saved', () => scheduleSync());
}

function bindUI() {
  document.getElementById('addBtn').addEventListener('click', () => createNote());
  document.getElementById('emptyCreateBtn').addEventListener('click', () => createNote());
  document.getElementById('deleteBtn').addEventListener('click', () => deleteCurrentNote());
  document.getElementById('pinBtn').addEventListener('click', () => togglePin());
  document.getElementById('aiBtn').addEventListener('click', () => window.toggleAISidebar());
  document.getElementById('openAIBtn').addEventListener('click', () => window.toggleAISidebar());
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

  document.getElementById('cloudBtn').addEventListener('click', () => window.toggleCloudModal(true));
  document.getElementById('diskBtn').addEventListener('click', async () => {
    const h = await pickAndLinkFile();
    if (!h) return;
    setLocalFileHandle(h);
    const btn = document.getElementById('diskBtn');
    if (btn) { btn.className = 'synced'; btn.innerText = '💾 已連結'; }
  });
  document.getElementById('gDriveBtn').addEventListener('click', () => {
    // Phase 5 接入；Phase 1 暫無行為
    console.log('gdrive sync: pending Phase 5');
  });

  document.getElementById('davTestBtn').addEventListener('click', () => webdavTestHandler());

  document.getElementById('exportBtn').addEventListener('click', () => exportData());
  document.getElementById('importBtn').addEventListener('click', () => document.getElementById('fileInput').click());
  document.getElementById('fileInput').addEventListener('change', (e) => importData(e.target));

  // AI
  document.getElementById('sendBtn').addEventListener('click', () => window.sendToAI());
  document.getElementById('summarizeBtn').addEventListener('click', () => window.summarizeNote());
  document.getElementById('clearChatBtn').addEventListener('click', () => window.clearChat());

  // 快捷鍵
  installShortcuts();
  onShortcut('Ctrl+P', () => document.getElementById('searchInput').focus(), { allowInInputs: false });
  onShortcut('Ctrl+O', () => { const t = document.getElementById('noteTitle'); t.focus(); t.select(); });
  onShortcut('Ctrl+I', () => document.getElementById('editor').focus());
  onShortcut('Ctrl+L', () => toggleLinkSearch());
  onShortcut('Ctrl+J', () => navigateList(1));
  onShortcut('Ctrl+K', () => navigateList(-1));
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
  document.getElementById('my-manifest-placeholder').href = URL.createObjectURL(blob);
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  // 開發時用 vite dev server 不註冊 sw（避免 HMR 衝突）
  if (location.hostname === 'localhost' && location.port === '5173') return;
  navigator.serviceWorker.register('/sw.js').catch((e) => console.warn('SW register failed', e));
}

async function checkQuota() {
  const r = await storageUsageRatio();
  if (r == null) return;
  if (r > 0.8) {
    console.warn(`[quota] 已使用 ${(r * 100).toFixed(1)}% 的儲存空間`);
  }
}

boot();
