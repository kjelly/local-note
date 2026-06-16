// 極簡 DOM helper：h(tag, props, ...children) 建立元素；delegate(root, type, selector, fn) 事件委派

export function h(tag, props = null, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class' || k === 'className') {
        el.className = v;
      } else if (k === 'dataset') {
        for (const [dk, dv] of Object.entries(v)) el.dataset[dk] = dv;
      } else if (k === 'style' && typeof v === 'object') {
        for (const [sk, sv] of Object.entries(v)) el.style[sk] = sv;
      } else if (k === 'on' && typeof v === 'object') {
        for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
      } else if (k in el && typeof v !== 'string') {
        try { el[k] = v; } catch { el.setAttribute(k, v); }
      } else {
        el.setAttribute(k, v === true ? '' : String(v));
      }
    }
  }
  appendChildren(el, children);
  return el;
}

function appendChildren(parent, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) {
      appendChildren(parent, c);
    } else if (c instanceof Node) {
      parent.appendChild(c);
    } else {
      parent.appendChild(document.createTextNode(String(c)));
    }
  }
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function $(sel, root = document) {
  return root.querySelector(sel);
}

export function $$(sel, root = document) {
  return [...root.querySelectorAll(sel)];
}

export function delegate(root, type, selector, handler) {
  root.addEventListener(type, (e) => {
    const target = e.target.closest(selector);
    if (target && root.contains(target)) {
      handler(e, target);
    }
  });
}
