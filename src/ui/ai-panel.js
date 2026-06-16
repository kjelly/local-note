// ai-panel.js — Ollama 聊天（串流）
// Phase 3：設定改存 IndexedDB meta

import { h, clear } from '../util/dom.js';
import { activeNoteId } from './editor.js';
import { getConfig, setConfig } from '../core/config.js';

export async function bindAIPanel() {
  const ai = document.getElementById('aiSidebar');
  const aiPrompt = document.getElementById('aiPrompt');
  const cfg = await getConfig('ai');
  document.getElementById('aiHost').value = cfg.host;
  document.getElementById('aiModel').value = cfg.model;

  aiPrompt.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); window.sendToAI(); }
  });
}

window.toggleAISidebar = function () {
  document.getElementById('aiSidebar').classList.toggle('open');
};
window.clearChat = function () {
  clear(document.getElementById('aiChat'));
  appendMsg('ai', '助手準備就緒。');
};
window.summarizeNote = function () {
  if (!activeNoteId.get()) return;
  const ed = document.getElementById('editor');
  window.sendToAI(`Summarize this in Traditional Chinese:\n${ed.value}`);
};

window.sendToAI = async function (customPrompt) {
  const prompt = customPrompt ?? document.getElementById('aiPrompt').value;
  if (!prompt) return;
  const host = (document.getElementById('aiHost').value || '').replace(/\/$/, '');
  const model = document.getElementById('aiModel').value;
  await setConfig('ai', { host, model });
  if (!customPrompt) {
    appendMsg('user', prompt);
    document.getElementById('aiPrompt').value = '';
  }
  document.getElementById('sendBtn').disabled = true;
  const msgDiv = appendMsg('ai', 'Thinking...');
  let full = '';
  try {
    const res = await fetch(`${host}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: true }),
    });
    if (!res.ok) throw new Error('Error');
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    msgDiv.textContent = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value, { stream: true }).split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const j = JSON.parse(line);
          if (j.response) {
            full += j.response;
            msgDiv.textContent = full;
            document.getElementById('aiChat').scrollTop = document.getElementById('aiChat').scrollHeight;
          }
        } catch (_) {}
      }
    }
    const insert = h('button', { class: 'toolbar-btn', style: 'background:#6c5ce7;color:white;margin-top:5px;' }, '📋 插入');
    insert.addEventListener('click', () => {
      const ed = document.getElementById('editor');
      const start = ed.selectionStart;
      ed.value = ed.value.slice(0, start) + full + ed.value.slice(start);
      ed.dispatchEvent(new Event('input'));
      if (window.innerWidth <= 768) window.toggleAISidebar();
    });
    msgDiv.appendChild(insert);
  } catch (e) {
    msgDiv.textContent = 'Error: ' + e.message;
  } finally {
    document.getElementById('sendBtn').disabled = false;
  }
};

function appendMsg(role, text) {
  const d = h('div', { class: `message msg-${role}` }, text);
  document.getElementById('aiChat').appendChild(d);
  document.getElementById('aiChat').scrollTop = document.getElementById('aiChat').scrollHeight;
  return d;
}
