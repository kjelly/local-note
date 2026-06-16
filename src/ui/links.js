// links.js — 雙向連結（Phase 2：note 改為 LWW 結構）

import { h, clear, delegate } from '../util/dom.js';
import { notesStore, activeNoteId, scheduleSave, loadNote } from './editor.js';
import { putNote } from '../core/idb.js';
import { applyPatch, noteView } from '../model/note.js';

let linkSearchIndex = -1;

export function bindLinks() {
  document.addEventListener('lb:note-loaded', () => renderLinksSection());
  const input = document.getElementById('linkSearchInput');
  const list = document.getElementById('linkOptionsList');

  if (input) {
    input.addEventListener('input', () => filterLinkOptions());
    input.addEventListener('keydown', (e) => {
      const cmd = e.ctrlKey || e.metaKey;
      if (cmd && e.key === 'j') { e.preventDefault(); navLink(1); }
      else if (cmd && e.key === 'k') { e.preventDefault(); navLink(-1); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        const sel = list.children[linkSearchIndex];
        if (sel) sel.click();
        else if (list.children.length > 0) list.children[0].click();
      } else if (e.key === 'Escape') {
        document.getElementById('linkSearchDropdown').style.display = 'none';
      }
    });
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.add-link-wrapper')) {
      const d = document.getElementById('linkSearchDropdown');
      if (d) d.style.display = 'none';
    }
  });
}

export function toggleLinkSearch() {
  const d = document.getElementById('linkSearchDropdown');
  if (!d) return;
  const show = d.style.display !== 'block';
  d.style.display = show ? 'block' : 'none';
  if (show) {
    document.getElementById('linkSearchInput').value = '';
    document.getElementById('linkSearchInput').focus();
    linkSearchIndex = -1;
    filterLinkOptions();
  }
}

function filterLinkOptions() {
  const kw = (document.getElementById('linkSearchInput').value || '').toLowerCase();
  const cur = notesStore.get().find((n) => n.id === activeNoteId.get());
  const list = document.getElementById('linkOptionsList');
  clear(list);
  linkSearchIndex = -1;
  if (!cur) return;
  const curLinks = cur.links?.value || [];
  const cands = notesStore.get().filter((n) =>
    n.id !== cur.id &&
    !curLinks.includes(n.id) &&
    (n.title.value.toLowerCase().includes(kw) || n.content.value.toLowerCase().includes(kw))
  );
  if (cands.length === 0) {
    list.appendChild(h('div', { style: 'padding:10px;color:#999;' }, '無'));
    return;
  }
  cands.slice(0, 10).forEach((n) => {
    const d = h('div', { class: 'link-option', dataset: { id: n.id } }, n.title.value || '(無標題)');
    d.addEventListener('click', () => addLink(n.id));
    list.appendChild(d);
  });
}

function navLink(dir) {
  const list = document.getElementById('linkOptionsList');
  const opts = list.children;
  if (opts.length === 0) return;
  if (linkSearchIndex >= 0 && linkSearchIndex < opts.length) opts[linkSearchIndex].classList.remove('selected');
  linkSearchIndex += dir;
  if (linkSearchIndex < 0) linkSearchIndex = 0;
  if (linkSearchIndex >= opts.length) linkSearchIndex = opts.length - 1;
  opts[linkSearchIndex].classList.add('selected');
  opts[linkSearchIndex].scrollIntoView({ block: 'nearest' });
}

function addLink(targetId) {
  const all = notesStore.get();
  const cur = all.find((n) => n.id === activeNoteId.get());
  if (!cur) return;
  const curLinks = cur.links?.value || [];
  if (curLinks.includes(targetId)) return;
  const next = applyPatch(cur, { links: [...curLinks, targetId] });
  if (next === cur) return;
  Object.assign(cur, next);
  // 同步到 store
  const idx = all.findIndex((n) => n.id === cur.id);
  if (idx !== -1) all[idx] = next;
  notesStore.set([...all]);
  putNote({ ...next, updatedAt: Date.now() });
  document.getElementById('linkSearchDropdown').style.display = 'none';
  scheduleSave();
  renderLinksSection();
}

function removeLink(targetId) {
  const all = notesStore.get();
  const cur = all.find((n) => n.id === activeNoteId.get());
  if (!cur) return;
  const curLinks = cur.links?.value || [];
  const next = applyPatch(cur, { links: curLinks.filter((id) => id !== targetId) });
  if (next === cur) return;
  const idx = all.findIndex((n) => n.id === cur.id);
  if (idx !== -1) all[idx] = next;
  notesStore.set([...all]);
  putNote({ ...next, updatedAt: Date.now() });
  scheduleSave();
  renderLinksSection();
}

function renderLinksSection() {
  const out = document.getElementById('outboundLinks');
  const inn = document.getElementById('inboundLinks');
  if (!out || !inn) return;
  clear(out);
  clear(inn);
  const cur = notesStore.get().find((n) => n.id === activeNoteId.get());
  if (!cur) return;
  const all = notesStore.get();
  const curLinks = cur.links?.value || [];

  if (curLinks.length > 0) {
    curLinks.forEach((lid) => {
      const t = all.find((n) => n.id === lid);
      if (!t) return;
      const tag = h('span', { class: 'link-tag' });
      const goto = h('span', { dataset: { id: lid } }, t.title.value || '(無標題)');
      goto.style.cursor = 'pointer';
      goto.addEventListener('click', () => loadNote(lid));
      const rm = h('span', { class: 'remove-link' }, '×');
      rm.style.cursor = 'pointer';
      rm.addEventListener('click', () => removeLink(lid));
      tag.appendChild(goto);
      tag.appendChild(rm);
      out.appendChild(tag);
    });
  } else {
    out.appendChild(h('span', { style: 'color:#ccc; font-size:0.8rem;' }, '無'));
  }

  const back = all.filter((n) => (n.links?.value || []).includes(cur.id));
  if (back.length > 0) {
    back.forEach((bn) => {
      const tag = h('span', { class: 'backlink-tag' }, '← ' + (bn.title.value || '(無標題)'));
      tag.addEventListener('click', () => loadNote(bn.id));
      inn.appendChild(tag);
    });
  } else {
    inn.appendChild(h('span', { style: 'color:#ccc; font-size:0.8rem;' }, '無'));
  }
}
