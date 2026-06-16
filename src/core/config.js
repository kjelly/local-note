// core/config.js — 應用程式設定（IndexedDB meta 取代 localStorage）
// 各個 key：
//   webdav:  { url, user, pass }
//   gdrive:  { clientId, apiKey }
//   ai:      { host, model }

import { getMeta, setMeta } from './idb.js';

const KEYS = {
  webdav: 'config.webdav',
  gdrive: 'config.gdrive',
  ai: 'config.ai',
};

export const DEFAULT_AI = { host: 'http://localhost:11434', model: 'llama3.2' };

export async function getConfig(name) {
  if (!KEYS[name]) throw new Error(`unknown config: ${name}`);
  const v = await getMeta(KEYS[name]);
  if (v == null) {
    if (name === 'ai') return { ...DEFAULT_AI };
    return null;
  }
  if (name === 'ai') return { ...DEFAULT_AI, ...v };
  return v;
}

export async function setConfig(name, value) {
  if (!KEYS[name]) throw new Error(`unknown config: ${name}`);
  await setMeta(KEYS[name], value);
}
