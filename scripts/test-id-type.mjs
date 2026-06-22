// scripts/test-id-type.mjs — 檢查 IDB 內 id 的型別
import { chromium } from 'playwright';

const URL = 'https://kjelly.github.io/local-note/';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ storageState: undefined });
const page = await ctx.newPage();

// 先建立一些 v23 風格的 notes（number id）模擬從 localStorage migration 進來的資料
await page.goto(URL, { waitUntil: 'networkidle' });
try { await page.waitForFunction(() => window.__lb_booted === true, { timeout: 10000 }); } catch {}
await page.waitForTimeout(1500);

// 模擬 v23 資料：直接寫入 IDB
await page.evaluate(() => new Promise((resolve, reject) => {
  const req = indexedDB.open('local_brain_db', 3);
  req.onsuccess = () => {
    const db = req.result;
    const tx = db.transaction('notes', 'readwrite');
    const store = tx.objectStore('notes');
    // 模擬 v23 migration 寫入的 note（id 為 number timestamp）
    const note = {
      id: 1770273642056,
      createdAt: Date.now(),
      title: { value: 'Test Note', rev: 1, clock: { 'dev-A': 1 }, updatedAt: Date.now() },
      content: { value: 'Test Content', rev: 1, clock: { 'dev-A': 1 }, updatedAt: Date.now() },
      links: { value: [], rev: 1, clock: { 'dev-A': 1 }, updatedAt: Date.now() },
      pinned: { value: false, rev: 1, clock: { 'dev-A': 1 }, updatedAt: Date.now() },
      history: [],
      updatedAt: Date.now(),
    };
    store.put(note).onsuccess = () => {
      tx.oncomplete = () => resolve();
    };
  };
  req.onerror = () => reject(req.error);
}));
await page.waitForTimeout(500);

const info = await page.evaluate(() => new Promise((resolve) => {
  const req = indexedDB.open('local_brain_db', 3);
  req.onsuccess = () => {
    const tx = req.result.transaction('notes', 'readonly');
    const allReq = tx.objectStore('notes').getAll();
    allReq.onsuccess = () => {
      const notes = allReq.result;
      resolve({
        total: notes.length,
        sample: notes.slice(0, 3).map((n) => ({
          id: n.id,
          idType: typeof n.id,
        })),
      });
    };
  };
}));
console.log('IDB 內 note 結構:');
console.log(JSON.stringify(info, null, 2));

// 直接拿 notesStore 試 find
const findTest = await page.evaluate(async () => {
  // 重新 reload 後取 notesStore
  // 直接從 IDB 拿
  const idb = await new Promise((resolve) => {
    const req = indexedDB.open('local_brain_db', 3);
    req.onsuccess = () => resolve(req.result);
  });
  const notes = await new Promise((resolve) => {
    const tx = idb.transaction('notes', 'readonly');
    const allReq = tx.objectStore('notes').getAll();
    allReq.onsuccess = () => resolve(allReq.result);
  });
  if (notes.length === 0) return { error: 'no notes' };
  const first = notes[0];
  // 用不同型別 find
  return {
    originalId: first.id,
    originalIdType: typeof first.id,
    findBySameType: !!notes.find((n) => n.id === first.id),
    findByNumber: !!notes.find((n) => n.id === Number(first.id)),
    findByString: !!notes.find((n) => n.id === String(first.id)),
  };
});
console.log('\nfind 測試:');
console.log(JSON.stringify(findTest, null, 2));