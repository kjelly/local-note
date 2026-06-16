import { describe, it, expect, beforeEach } from 'vitest';
import { getFocusable, focusFirst, focusLast, trapFocus, onEscape, setAria } from '../../src/core/a11y.js';

describe('a11y helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('getFocusable 找出按鈕與輸入', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <button>A</button>
      <input type="text" />
      <a href="#">link</a>
      <button disabled>D</button>
      <div tabindex="0">focusable</div>
      <div tabindex="-1">not</div>
    `;
    document.body.appendChild(root);
    const list = getFocusable(root);
    expect(list.map((el) => el.textContent.trim())).toEqual(['A', '', 'link', 'focusable']);
  });

  it('focusFirst 與 focusLast 設定 focus', () => {
    const root = document.createElement('div');
    root.innerHTML = '<button id="a">A</button><button id="b">B</button>';
    document.body.appendChild(root);
    focusFirst(root);
    expect(document.activeElement.id).toBe('a');
    focusLast(root);
    expect(document.activeElement.id).toBe('b');
  });

  it('trapFocus：Tab 在最後一個元素循環到第一個', () => {
    const root = document.createElement('div');
    root.innerHTML = '<button id="a">A</button><button id="b">B</button>';
    document.body.appendChild(root);
    const off = trapFocus(root);
    document.getElementById('b').focus();
    const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    root.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(document.activeElement.id).toBe('a');
    off();
  });

  it('trapFocus：Shift+Tab 在第一個元素循環到最後一個', () => {
    const root = document.createElement('div');
    root.innerHTML = '<button id="a">A</button><button id="b">B</button>';
    document.body.appendChild(root);
    const off = trapFocus(root);
    document.getElementById('a').focus();
    const ev = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    root.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(document.activeElement.id).toBe('b');
    off();
  });

  it('onEscape 觸發 handler', () => {
    const root = document.createElement('div');
    document.body.appendChild(root);
    let called = 0;
    const off = onEscape(root, () => called++);
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(called).toBe(1);
    off();
  });

  it('setAria 一次設定多個屬性', () => {
    const el = document.createElement('div');
    setAria(el, { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'x' });
    expect(el.getAttribute('role')).toBe('dialog');
    expect(el.getAttribute('aria-modal')).toBe('true');
    expect(el.getAttribute('aria-label')).toBe('x');
  });
});
