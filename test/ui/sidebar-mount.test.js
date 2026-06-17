// test/ui/sidebar-mount.test.js — 驗證 sidebar mount 後 click 事件可觸發
// 之前的 bug：<ul id="noteList"> 內放 <div> (sentinel/itemsLayer)，
// 瀏覽器 parser 自動把 <div> 移到 <ul> 外，導致 click listener 失效。
// 修法：把 #noteList 改成 <div>。

import { describe, it, expect, beforeEach, vi } from 'vitest';
import 'fake-indexeddb/auto';

describe('sidebar mount', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('mount 後 #noteList 是 <div> 且內含 sentinel/itemsLayer 結構', async () => {
    document.body.innerHTML = `
      <div id="sidebar">
        <div class="search-box"><input type="text" id="searchInput"></div>
        <div id="noteList"></div>
      </div>
    `;
    const sidebarMod = await import('../../src/ui/sidebar.js');
    const { mountSidebar, renderSidebarList } = sidebarMod;
    const { createNote } = await import('../../src/ui/editor.js');

    const noteList = document.getElementById('noteList');
    expect(noteList.tagName).toBe('DIV');

    mountSidebar(document.getElementById('sidebar'));
    const n1 = createNote('A');
    const n2 = createNote('B');
    renderSidebarList([n1, n2], null);
    await new Promise((r) => requestAnimationFrame(r));

    const children = [...noteList.children];
    const tags = children.map((c) => c.className.split(' ')[0]);
    expect(tags).toContain('vl-sentinel');
    expect(tags).toContain('vl-items');
    const items = noteList.querySelectorAll('.note-item');
    expect(items.length).toBeGreaterThan(0);
  });

  it('點擊 .note-item 會呼叫 loadNote', async () => {
    document.body.innerHTML = `
      <div id="sidebar">
        <div class="search-box"><input type="text" id="searchInput"></div>
        <div id="noteList"></div>
      </div>
      <div id="noteContainer" style="display:none;">
        <input id="noteTitle">
        <textarea id="editor"></textarea>
      </div>
      <div id="emptyState" style="display:none;"></div>
      <div id="previewArea" style="display:none;"></div>
      <div id="previewModal"></div>
    `;
    const sidebarMod = await import('../../src/ui/sidebar.js');
    const { mountSidebar, renderSidebarList } = sidebarMod;
    const editorMod = await import('../../src/ui/editor.js');
    const { createNote, loadNote } = editorMod;

    const spy = vi.spyOn(editorMod, 'loadNote');

    mountSidebar(document.getElementById('sidebar'));
    const n = await createNote('Click me');
    renderSidebarList([n], null);
    await new Promise((r) => requestAnimationFrame(r));

    const items = document.querySelectorAll('.note-item');
    expect(items.length).toBe(1);

    spy.mockClear();
    items[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(spy).toHaveBeenCalledWith(n.id);
    spy.mockRestore();
  });
});
