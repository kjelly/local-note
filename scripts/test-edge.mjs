// scripts/test-edge.mjs — 邊界情境：只改 title、reload、快速點擊等
import { chromium } from 'playwright';

const URL = 'https://kjelly.github.io/local-note/';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
const logs = [];
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));

await page.goto(URL, { waitUntil: 'networkidle' });
try { await page.waitForFunction(() => window.__lb_booted === true, { timeout: 10000 }); } catch {}
await page.waitForTimeout(1500);

// 模擬使用者常見操作：add → fill title → 不填 content → 再 add → 切換
async function addNote(title, content = '') {
  await page.click('#addBtn');
  await page.waitForTimeout(300);
  if (title) await page.fill('#noteTitle', title);
  if (content) await page.fill('#editor', content);
  await page.waitForTimeout(1200);
}

console.log('--- Case 1: 建立兩筆，只填 title ---');
await addNote('僅標題 A');
await addNote('僅標題 B');

// 看 IDB
const idb1 = await page.evaluate(() => new Promise((resolve) => {
  const req = indexedDB.open('local_brain_db', 3);
  req.onsuccess = () => {
    const tx = req.result.transaction('notes', 'readonly');
    const allReq = tx.objectStore('notes').getAll();
    allReq.onsuccess = () => resolve(allReq.result.map((n) => ({
      id: n.id, title: n.title?.value, content: n.content?.value,
    })));
  };
}));
console.log('IDB:', JSON.stringify(idb1));

console.log('\n--- Case 2: 快速連續點擊兩個 note（不 reload） ---');
const ids = idb1.map((n) => n.id);
await page.locator(`.note-item[data-id="${ids[0]}"]`).first().click();
await page.waitForTimeout(50);
await page.locator(`.note-item[data-id="${ids[1]}"]`).first().click();
await page.waitForTimeout(500);
const c2 = await page.evaluate(() => ({
  title: document.getElementById('noteTitle').value,
  content: document.getElementById('editor').value,
  activeId: document.querySelector('.note-item.active')?.dataset.id,
}));
console.log('after fast clicks →', JSON.stringify(c2));

console.log('\n--- Case 3: reload 然後點擊 ---');
await page.reload({ waitUntil: 'networkidle' });
try { await page.waitForFunction(() => window.__lb_booted === true, { timeout: 10000 }); } catch {}
await page.waitForTimeout(1500);

const idbAfter = await page.evaluate(() => new Promise((resolve) => {
  const req = indexedDB.open('local_brain_db', 3);
  req.onsuccess = () => {
    const tx = req.result.transaction('notes', 'readonly');
    const allReq = tx.objectStore('notes').getAll();
    allReq.onsuccess = () => resolve(allReq.result.map((n) => ({
      id: n.id, title: n.title?.value, content: n.content?.value,
    })));
  };
}));
console.log('IDB after reload:', JSON.stringify(idbAfter));

const notesInDom = await page.evaluate(() => Array.from(document.querySelectorAll('.note-item')).map((el) => ({
  id: el.dataset.id,
  title: el.querySelector('.title')?.textContent,
  isActive: el.classList.contains('active'),
})));
console.log('DOM after reload:', JSON.stringify(notesInDom));

// 點擊每個 note 看內容切換
for (let i = 0; i < idbAfter.length; i++) {
  const n = idbAfter[i];
  await page.locator(`.note-item[data-id="${n.id}"]`).first().click();
  await page.waitForTimeout(300);
  const result = await page.evaluate(() => ({
    title: document.getElementById('noteTitle').value,
    content: document.getElementById('editor').value,
  }));
  console.log(`click ${n.title} → title="${result.title}" content="${result.content}"`);
}

console.log('\n--- Page errors ---');
if (errs.length === 0) console.log('(none)');
else errs.forEach((e) => console.log(e));
console.log('\n--- Console (last 15) ---');
logs.slice(-15).forEach((l) => console.log(l));

await browser.close();