// core/a11y.js — 無障礙輔助

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

// 取得容器內所有可聚焦元素
// jsdom 沒實作 layout，offsetParent 永遠是 null；用 disabled 與 tabindex 判斷
export function getFocusable(root) {
  return [...root.querySelectorAll(FOCUSABLE)].filter((el) => {
    if (el.disabled) return false;
    if (el.getAttribute('tabindex') === '-1') return false;
    if (el.tagName === 'A' && !el.getAttribute('href')) return false;
    return true;
  });
}

// 把 focus 設到容器內第一個 / 最後一個可聚焦元素
export function focusFirst(root) {
  const list = getFocusable(root);
  if (list.length > 0) list[0].focus();
}

export function focusLast(root) {
  const list = getFocusable(root);
  if (list.length > 0) list[list.length - 1].focus();
}

// 安裝 focus trap：Tab / Shift+Tab 在容器內循環
// 回傳卸載函式
export function trapFocus(root) {
  const handler = (e) => {
    if (e.key !== 'Tab') return;
    const list = getFocusable(root);
    if (list.length === 0) {
      e.preventDefault();
      return;
    }
    const first = list[0];
    const last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  root.addEventListener('keydown', handler);
  return () => root.removeEventListener('keydown', handler);
}

// Esc 鍵監聽（modal 關閉常用）
export function onEscape(root, handler) {
  const fn = (e) => { if (e.key === 'Escape') handler(e); };
  root.addEventListener('keydown', fn);
  return () => root.removeEventListener('keydown', fn);
}

// 設定 aria 屬性
export function setAria(el, attrs) {
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
}
