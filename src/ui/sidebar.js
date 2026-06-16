// sidebar.js — 側邊欄列表、批次模式、搜尋框（Phase 4：虛擬捲動 + render patch）

import { h, clear, delegate } from '../util/dom.js';
import { escapeHtml } from '../util/escape.js';
import {
  createNote, loadNote, openSplitView,
  setSearchKeyword, setSearchMode,
} from './editor.js';
import { computeRange, totalHeight } from '../core/virtual-list.js';

const ITEM_HEIGHT = 70; // px：固定列高（依 .note-item 估算）
const OVERSCAN = 5;

let isBatchMode = false;
let currentNotes = [];
let currentActiveId = null;
let scrollContainer = null;
let sentinelTop, sentinelBottom, itemsLayer;
let lastRange = { start: 0, end: 0 };

// mount 時呼叫：把 noteList 內部改造成 scrollContainer + top sentinel + items + bottom sentinel
export function mountSidebar(root) {
  const noteList = root.querySelector('#noteList');
  scrollContainer = noteList;
  clear(scrollContainer);

  // 內部建立：top 預留空間、items 層、bottom 預留空間
  sentinelTop = h('div', { class: 'vl-sentinel vl-top', style: 'height:0;' });
  itemsLayer = h('div', { class: 'vl-items' });
  sentinelBottom = h('div', { class: 'vl-sentinel vl-bottom', style: 'height:0;' });
  scrollContainer.appendChild(sentinelTop);
  scrollContainer.appendChild(itemsLayer);
  scrollContainer.appendChild(sentinelBottom);

  scrollContainer.style.position = 'relative';

  scrollContainer.addEventListener('scroll', () => {
    requestAnimationFrame(() => patchVisible());
  });
  window.addEventListener('resize', () => requestAnimationFrame(() => patchVisible()));

  const searchInput = root.querySelector('#searchInput');

  searchInput.addEventListener('input', () => setSearchKeyword(searchInput.value));
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const visible = countRenderedItems();
      if (visible === 0 && searchInput.value.trim()) {
        createNote(searchInput.value.trim());
        searchInput.value = '';
      }
    }
  });

  root.querySelectorAll('input[name="searchMode"]').forEach((r) => {
    r.addEventListener('change', () => setSearchMode(r.value));
  });

  // 事件委派
  delegate(itemsLayer, 'click', '.note-item', (e, li) => {
    if (e.target.tagName === 'BUTTON' || e.target.classList.contains('split-btn')) return;
    const id = li.dataset.id;
    if (isBatchMode) {
      if (e.target.tagName === 'INPUT') return;
      const cb = li.querySelector('.batch-checkbox');
      if (cb) cb.checked = !cb.checked;
    } else {
      loadNote(id);
    }
  });

  delegate(itemsLayer, 'click', '.split-btn', (e, btn) => {
    e.stopPropagation();
    openSplitView(btn.dataset.id);
  });
}

function countRenderedItems() {
  return itemsLayer?.querySelectorAll('.note-item').length || 0;
}

export function getBatchMode() { return isBatchMode; }
export function setBatchMode(v) {
  isBatchMode = !!v;
  const sidebar = document.getElementById('sidebar');
  const normal = document.getElementById('normalActions');
  const batch = document.getElementById('batchActions');
  if (!sidebar) return;
  sidebar.classList.toggle('batch-mode', isBatchMode);
  if (normal) normal.style.display = isBatchMode ? 'none' : 'flex';
  if (batch) batch.style.display = isBatchMode ? 'flex' : 'none';
  // 立刻重繪（checkbox 顯示）
  requestAnimationFrame(() => patchVisible());
}

// 給外部：notes / activeNoteId 變動時呼叫
export function renderSidebarList(notes, activeId) {
  currentNotes = notes;
  currentActiveId = activeId;
  if (!scrollContainer) return;
  if (notes.length === 0) {
    sentinelTop.style.height = '0px';
    sentinelBottom.style.height = '0px';
    clear(itemsLayer);
    const empty = h('div', { style: 'padding:24px 16px; text-align:center; color:#7f8c8d;' });
    empty.appendChild(h('p', { style: 'margin:0 0 12px 0; font-size:0.95rem;' }, '📝 還沒有任何筆記'));
    empty.appendChild(h('p', { style: 'margin:0 0 12px 0; font-size:0.8rem; opacity:0.8;' }, '按 + 新增，或從選單匯入 JSON 備份'));
    itemsLayer.appendChild(empty);
    return;
  }
  // 第一次 render 或 items 總數變動 → 重新建立
  if (lastRange.end - lastRange.start === 0 || currentNotes.length === 0) {
    rebuildAll();
    return;
  }
  patchVisible();
}

function rebuildAll() {
  if (!scrollContainer) return;
  sentinelTop.style.height = totalHeight(currentNotes.length, ITEM_HEIGHT) + 'px';
  sentinelBottom.style.height = '0px';
  clear(itemsLayer);
  // 初次只 render 視窗內的範圍（避免 1k+ DOM）
  requestAnimationFrame(() => patchVisible());
}

// 計算當前 scroll 範圍，diff 渲染
function patchVisible() {
  if (!scrollContainer || !sentinelTop) return;
  if (currentNotes.length === 0) return;
  const range = computeRange({
    scrollTop: scrollContainer.scrollTop,
    viewportHeight: scrollContainer.clientHeight,
    itemHeight: ITEM_HEIGHT,
    total: currentNotes.length,
    overscan: OVERSCAN,
  });
  // 沒變就不重繪
  if (range.start === lastRange.start && range.end === lastRange.end) return;
  // sentinel 高度：top 給到 start 之前，bottom 給 end 之後
  sentinelTop.style.height = range.topPad + 'px';
  sentinelBottom.style.height = range.bottomPad + 'px';

  // diff render：移除超出範圍的、新增進入範圍的
  const visible = currentNotes.slice(range.start, range.end);
  // 移除目前 items 內不在 visible 內的 DOM
  const visibleIds = new Set(visible.map((n) => n.id));
  const toRemove = [...itemsLayer.children].filter((el) => !visibleIds.has(el.dataset.id));
  toRemove.forEach((el) => el.remove());
  // 新增缺失的（從頭到尾順序）
  const existingIds = new Set([...itemsLayer.children].map((el) => el.dataset.id));
  for (let i = 0; i < visible.length; i++) {
    const n = visible[i];
    const existing = itemsLayer.querySelector(`[data-id="${cssEsc(n.id)}"]`);
    if (existing) {
      // 更新 active 狀態
      const wantActive = n.id === currentActiveId;
      if (wantActive !== existing.classList.contains('active')) {
        existing.classList.toggle('active', wantActive);
      }
      // 同步到正確位置（用 appendChild 會搬移）
      const target = itemsLayer.children[i];
      if (target !== existing) itemsLayer.insertBefore(existing, target);
    } else {
      const el = renderItem(n);
      // 插到第 i 個位置
      if (itemsLayer.children[i]) itemsLayer.insertBefore(el, itemsLayer.children[i]);
      else itemsLayer.appendChild(el);
    }
  }
  lastRange = range;
}

function cssEsc(s) {
  return String(s).replace(/"/g, '\\"');
}

function renderItem(n) {
  const title = n.title?.value || '(無標題)';
  const preview = (n.content?.value || '').slice(0, 40).replace(/\n/g, ' ');
  const li = h('li', {
    class: 'note-item' + (n.id === currentActiveId ? ' active' : ''),
    dataset: { id: n.id },
    style: `min-height:${ITEM_HEIGHT}px;`,
  });
  const info = h('div', { class: 'note-info' });
  if (n.pinned?.value) info.appendChild(h('span', { style: 'color:#f1c40f;margin-right:5px;' }, '📌'));
  info.appendChild(h('span', { class: 'title' }, title));
  info.appendChild(h('span', { class: 'preview' }, preview || ' '));
  li.appendChild(info);
  if (isBatchMode) {
    li.appendChild(h('input', { type: 'checkbox', class: 'batch-checkbox', value: n.id }));
  } else {
    li.appendChild(h('button', {
      class: 'split-btn',
      title: '對照',
      dataset: { id: n.id },
    }, '👀'));
  }
  return li;
}

// 匯出讓測試 / 其他模組能讀取內部狀態
export function _internalForTest() {
  return { currentNotes, currentActiveId, lastRange, itemsLayer };
}
