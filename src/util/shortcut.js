// 全域快捷鍵登錄：避免到處 addEventListener 散落
// 格式：{ combo: 'Ctrl+P', handler, allowInInputs: false }

const REGISTRY = [];

export function onShortcut(combo, handler, opts = {}) {
  REGISTRY.push({ combo: combo.toLowerCase(), handler, opts });
}

function match(combo, e) {
  const cmd = e.ctrlKey || e.metaKey;
  if (combo.includes('ctrl') && !cmd) return false;
  if (combo.includes('shift') && !e.shiftKey) return false;
  if (combo.includes('alt') && !e.altKey) return false;
  const key = e.key.toLowerCase();
  const parts = combo.split('+').map((p) => p.trim());
  const target = parts[parts.length - 1];
  if (target === 'enter') return key === 'enter';
  if (target === 'esc' || target === 'escape') return key === 'escape';
  return key === target;
}

export function installShortcuts() {
  document.addEventListener('keydown', (e) => {
    for (const r of REGISTRY) {
      if (match(r.combo, e)) {
        if (!r.opts.allowInInputs) {
          const t = e.target;
          const tag = (t?.tagName || '').toLowerCase();
          if (tag === 'input' || tag === 'textarea' || t?.isContentEditable) {
            // 允許 esc
            if (r.combo.endsWith('esc') || r.combo.endsWith('escape')) {
              // pass
            } else {
              return;
            }
          }
        }
        e.preventDefault();
        r.handler(e);
        return;
      }
    }
  });
}
