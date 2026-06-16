// scripts/perf-1000.mjs — 1000 筆冷啟 / 搜尋效能 smoke test
// 用 fake-indexeddb + jsdom 模擬瀏覽器環境
// 量測：loadAllNotes 耗時、buildIndex 耗時、searchIndex 100 次平均

import 'fake-indexeddb/auto';
import { JSDOM } from 'jsdom';
import { performance } from 'node:perf_hooks';

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
if (!('navigator' in globalThis)) globalThis.navigator = dom.window.navigator;
globalThis.URL = dom.window.URL;

const { createNote } = await import('../src/model/note.js');
const { buildIndex, searchIndex } = await import('../src/core/search-index.js');
const { putNote, getAllNotes, _resetForTest, getDB, STORES } = await import('../src/core/idb.js');

const N = 1000;
console.log(`[perf] 建立 ${N} 筆假資料...`);

const t0 = performance.now();
const notes = [];
for (let i = 0; i < N; i++) {
  notes.push({
    ...createNote({
      title: `Note ${i} — keyword${i % 50}`,
      content: `This is content for note ${i}. Lorem ipsum dolor sit amet. Keyword${i % 50} appears here.`.repeat(3),
    }),
    updatedAt: Date.now() - i * 1000,
  });
}
console.log(`[perf] 建立 notes：${(performance.now() - t0).toFixed(1)} ms`);

_resetForTest();
const t1 = performance.now();
for (const n of notes) await putNote(n);
const tPut = performance.now() - t1;
console.log(`[perf] putNote ${N} 次：${tPut.toFixed(1)} ms（avg ${(tPut / N).toFixed(2)} ms/筆）`);

const t2 = performance.now();
const loaded = await getAllNotes();
const tGet = performance.now() - t2;
console.log(`[perf] getAllNotes 1 次：${tGet.toFixed(1)} ms（${loaded.length} 筆）`);

const t3 = performance.now();
const idx = buildIndex(loaded);
const tIdx = performance.now() - t3;
console.log(`[perf] buildIndex：${tIdx.toFixed(1)} ms（${idx.size} 個 token）`);

const queries = ['keyword0', 'keyword25', 'keyword49', 'Note 100', 'Lorem'];
const t4 = performance.now();
for (let i = 0; i < 100; i++) {
  const q = queries[i % queries.length];
  searchIndex(idx, q, 'AND');
}
const tSearch = performance.now() - t4;
console.log(`[perf] searchIndex 100 次：${tSearch.toFixed(1)} ms（avg ${(tSearch / 100).toFixed(3)} ms/次）`);

// 驗收
const passed =
  tGet < 1000 && tIdx < 1000 && tSearch / 100 < 50;
console.log(`[perf] 結果：${passed ? '✅ 達標' : '❌ 未達標'}（冷啟 < 1s、搜尋 < 50ms）`);
process.exit(passed ? 0 : 1);
