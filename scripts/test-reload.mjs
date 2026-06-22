// scripts/test-reload.mjs — 完整重現「reload 頁面後點擊切換內容」
import { chromium } from 'playwright';

const URL = 'https://kjelly.github.io/local-note/';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

const errs = [];
const logs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));

console.log('--- Step 1: 第一次載入，建立 3 筆 notes ---');
await page.goto(URL, { waitUntil: 'networkidle' });
try { await page.waitForFunction(() => window.__lb_booted === true, { timeout: 10000 }); } catch {}
await page.waitForTimeout(2000);

async function addNote(title, content) {
  await page.click('#addBtn');
  await page.waitForTimeout(300);
  await page.fill('#noteTitle', title);
  await page.fill('#editor', content);
  await page.waitForTimeout(1500);
}
await addNote('Note X', 'Content X');
await addNote('Note Y', 'Content Y');
await addNote('Note Z', 'Content Z');

const idbAll = await page.evaluate(() => new Promise((resolve) => {
  const req = indexedDB.open('local_brain_db', 3);
  req.onsuccess = () => {
    const tx = req.result.transaction('notes', 'readonly');
    const allReq = tx.objectStore('notes').getAll();
    allReq.onsuccess = () => resolve(allReq.result.map((n) => ({
      id: n.id, title: n.title?.value, content: n.content?.value,
    })));
  };
}));
console.log('IDB after build:', JSON.stringify(idbAll.map((n) => n.title)));

console.log('\n--- Step 2: 重新整理頁面（模擬使用者 reload） ---');
await page.reload({ waitUntil: 'networkidle' });
try { await page.waitForFunction(() => window.__lb_booted === true, { timeout: 10000 }); } catch {}
await page.waitForTimeout(2000);

const notesAfterReload = await page.evaluate(() => Array.from(document.querySelectorAll('.note-item')).map((el) => ({
  id: el.dataset.id,
  title: el.querySelector('.title')?.textContent,
  isActive: el.classList.contains('active'),
})));
console.log('DOM after reload:', JSON.stringify(notesAfterReload));

const titleAfterReload = await page.locator('#noteTitle').inputValue();
const contentAfterReload = await page.locator('#editor').inputValue();
console.log('right pane after reload:', titleAfterReload, '/', contentAfterReload);

console.log('\n--- Step 3: 點擊第一個 note ---');
const id1 = notesAfterReload[0].id;
await page.locator(`.note-item[data-id="${id1}"]`).first().click();
await page.waitForTimeout(500);
const c1 = await page.evaluate(() => ({
  title: document.getElementById('noteTitle').value,
  content: document.getElementById('editor').value,
  activeId: document.querySelector('.note-item.active')?.dataset.id,
}));
console.log('click first →', JSON.stringify(c1));

console.log('\n--- Step 4: 點擊第二個 note ---');
const id2 = notesAfterReload[1].id;
await page.locator(`.note-item[data-id="${id2}"]`).first().click();
await page.waitForTimeout(500);
const c2 = await page.evaluate(() => ({
  title: document.getElementById('noteTitle').value,
  content: document.getElementById('editor').value,
  activeId: document.querySelector('.note-item.active')?.dataset.id,
}));
console.log('click second →', JSON.stringify(c2));

console.log('\n--- Step 5: 點擊第三個 note ---');
const id3 = notesAfterReload[2].id;
await page.locator(`.note-item[data-id="${id3}"]`).first().click();
await page.waitForTimeout(500);
const c3 = await page.evaluate(() => ({
  title: document.getElementById('noteTitle').value,
  content: document.getElementById('editor').value,
  activeId: document.querySelector('.note-item.active')?.dataset.id,
}));
console.log('click third →', JSON.stringify(c3));

if (errs.length) {
  console.log('\n--- PAGE ERRORS ---');
  errs.forEach((e) => console.log(e));
}
console.log('\n--- Console (last 10) ---');
logs.slice(-10).forEach((l) => console.log(l));

await browser.close();