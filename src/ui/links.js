// links.js — 雙向連結

import { h, clear, delegate } from '../util/dom.js';
import { notesStore, activeNoteId, scheduleSave, loadNote } from './editor.js';
import { putNote } from '../core/idb.js';

let linkSearchIndex = -1;

export function bindLinks() {
  document.addEventListener('lb:note-loaded', () => renderLinksSection());
  const drop = document.getElementById('linkSearchDropdown');
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
  const cands = notesStore.get().filter((n) =>
    n.id !== cur.id &&
    (!cur.links || !cur.links.includes(n.id)) &&
    (n.title.toLowerCase().includes(kw) || n.content.toLowerCase().includes(kw))
  );
  if (cands.length === 0) {
    list.appendChild(h('div', { style: 'padding:10px;color:#999;' }, '無'));
    return;
  }
  cands.slice(0, 10).forEach((n) => {
    const d = h('div', { class: 'link-option', dataset: { id: n.id } }, n.title || '(無標題)');
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
  if (!cur.links) cur.links = [];
  if (!cur.links.includes(targetId)) {
    cur.links.push(targetId);
    putNote(cur);
  }
  document.getElementById('linkSearchDropdown').style.display = 'none';
  scheduleSave();
  renderLinksSection();
}

function removeLink(targetId) {
  const all = notesStore.get();
  const cur = all.find((n) => n.id === activeNoteId.get());
  if (!cur) return;
  cur.links = (cur.links || []).filter((id) => id !== targetId);
  putNote(cur);
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

  // outbound
  if (cur.links && cur.links.length > 0) {
    cur.links.forEach((lid) => {
      const t = all.find((n) => n.id === lid);
      if (!t) return;
      const tag = h('span', { class: 'link-tag' });
      const goto = h('span', { dataset: { id: lid } }, t.title || '(無標題)');
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

  // inbound
  const back = all.filter((n) => n.links && n.links.includes(cur.id));
  if (back.length > 0) {
    back.forEach((bn) => {
      const tag = h('span', { class: 'backlink-tag' }, '← ' + (bn.title || '(無標題)'));
      tag.addEventListener('click', () => loadNote(bn.id));
      inn.appendChild(tag);
    });
  } else {
    inn.appendChild(h('span', { style: 'color:#ccc; font-size:0.8rem;' }, '無'));
  }
}
