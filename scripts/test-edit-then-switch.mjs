// scripts/test-edit-then-switch.mjs — 模擬「正在編輯時切換」
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

// 建立 2 筆
async function addNote(title, content) {
  await page.click('#addBtn');
  await page.waitForTimeout(300);
  await page.fill('#noteTitle', title);
  await page.fill('#editor', content);
  await page.waitForTimeout(1500);
}
await addNote('Note One', 'Original Content One');
await addNote('Note Two', 'Original Content Two');

const idb = await page.evaluate(() => new Promise((resolve) => {
  const req = indexedDB.open('local_brain_db', 3);
  req.onsuccess = () => {
    const tx = req.result.transaction('notes', 'readonly');
    const allReq = tx.objectStore('notes').getAll();
    allReq.onsuccess = () => resolve(allReq.result.map((n) => ({
      id: n.id, title: n.title?.value, content: n.content?.value,
    })));
  };
}));
const noteOne = idb.find((n) => n.title === 'Note One');
const noteTwo = idb.find((n) => n.title === 'Note Two');
console.log('建立完成:', JSON.stringify(idb.map((n) => n.title)));

// reload
await page.reload({ waitUntil: 'networkidle' });
try { await page.waitForFunction(() => window.__lb_booted === true, { timeout: 10000 }); } catch {}
await page.waitForTimeout(1500);

console.log('\n--- Scenario 1: 切換到 Note One，內容應該是 Original Content One ---');
await page.locator(`.note-item[data-id="${noteOne.id}"]`).first().click();
await page.waitForTimeout(300);
const r1 = await page.evaluate(() => ({
  title: document.getElementById('noteTitle').value,
  content: document.getElementById('editor').value,
  activeId: document.querySelector('.note-item.active')?.dataset.id,
}));
console.log('result:', JSON.stringify(r1));

console.log('\n--- Scenario 2: 編輯 Note One 內容（不等 save）---');
await page.fill('#editor', '正在打字的中途');
// 立刻點 Note Two（不等 debounce 800ms）
await page.locator(`.note-item[data-id="${noteTwo.id}"]`).first().click();
await page.waitForTimeout(300);
const r2 = await page.evaluate(() => ({
  title: document.getElementById('noteTitle').value,
  content: document.getElementById('editor').value,
  activeId: document.querySelector('.note-item.active')?.dataset.id,
}));
console.log('result:', JSON.stringify(r2));

// 看 IDB 是否被污染
await page.waitForTimeout(1200);
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
console.log('IDB after:', JSON.stringify(idbAfter.map((n) => `${n.title}=${n.content}`)));

console.log('\n--- Scenario 3: 切回 Note One ---');
await page.locator(`.note-item[data-id="${noteOne.id}"]`).first().click();
await page.waitForTimeout(300);
const r3 = await page.evaluate(() => ({
  title: document.getElementById('noteTitle').value,
  content: document.getElementById('editor').value,
  activeId: document.querySelector('.note-item.active')?.dataset.id,
}));
console.log('result:', JSON.stringify(r3));

console.log('\n--- Page errors ---');
if (errs.length === 0) console.log('(none)');
else errs.forEach((e) => console.log(e));

await browser.close();