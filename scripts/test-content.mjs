// scripts/test-content.mjs — 驗證點擊切換是否更新右側內容
import { chromium } from 'playwright';

const URL = 'https://kjelly.github.io/local-note/';
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext()).newPage();

const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
const logs = [];
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));

await page.goto(URL, { waitUntil: 'networkidle' });
try { await page.waitForFunction(() => window.__lb_booted === true, { timeout: 10000 }); } catch {}
await page.waitForTimeout(1500);

// 新增 2 筆：直接在每筆 save 之間等久一點
async function addNoteWithTitle(title, content) {
  await page.click('#addBtn');
  await page.waitForTimeout(300);
  await page.fill('#noteTitle', title);
  await page.fill('#editor', content);
  await page.waitForTimeout(1200); // 等 scheduleSave 完整跑完 + IDB write
}
await addNoteWithTitle('第一個筆記標題', '第一個筆記的內容 AAAA');
await addNoteWithTitle('第二個筆記標題', '第二個筆記的內容 BBBB');
await page.waitForTimeout(500);

const ids = await page.evaluate(() => Array.from(document.querySelectorAll('.note-item')).map((el) => el.dataset.id));
console.log('note ids (DOM):', ids);

const idbAll = await page.evaluate(() => new Promise((resolve, reject) => {
  const req = indexedDB.open('local_brain_db', 3);
  req.onsuccess = () => {
    const tx = req.result.transaction('notes', 'readonly');
    const allReq = tx.objectStore('notes').getAll();
    allReq.onsuccess = () => resolve(allReq.result.map((n) => ({ id: n.id, title: n.title?.value, content: n.content?.value })));
    allReq.onerror = () => reject(allReq.error);
  };
  req.onerror = () => reject(req.error);
}));
console.log('IDB notes:', JSON.stringify(idbAll));

// 用 IDB 內真實 id（依 title 內容對應）
const firstNote = idbAll.find((n) => n.title === '第一個筆記標題');
const secondNote = idbAll.find((n) => n.title === '第二個筆記標題');
const firstId = firstNote.id;
const secondId = secondNote.id;
console.log('first id (in IDB):', firstId, 'second id (in IDB):', secondId);

const beforeTitle = await page.locator('#noteTitle').inputValue();
console.log('title before any click:', beforeTitle);

// 點 first
await page.locator(`.note-item[data-id="${firstId}"]`).first().click();
await page.waitForTimeout(300);
const afterFirstTitle = await page.locator('#noteTitle').inputValue();
const afterFirstContent = await page.locator('#editor').inputValue();
console.log('after click first → title:', afterFirstTitle, 'content:', afterFirstContent);

// 點 second
await page.locator(`.note-item[data-id="${secondId}"]`).first().click();
await page.waitForTimeout(300);
const afterSecondTitle = await page.locator('#noteTitle').inputValue();
const afterSecondContent = await page.locator('#editor').inputValue();
console.log('after click second → title:', afterSecondTitle, 'content:', afterSecondContent);

const switched = afterFirstTitle === '第一個筆記標題' && afterSecondTitle === '第二個筆記標題';
console.log('\n=== RESULT:', switched ? '✅ content switches' : '❌ content did NOT switch', '===');

if (errs.length) {
  console.log('\n--- PAGE ERRORS ---');
  errs.forEach((e) => console.log(e));
}
console.log('\n--- CONSOLE ---');
logs.forEach((l) => console.log(l));

await browser.close();
process.exit(switched ? 0 : 1);
