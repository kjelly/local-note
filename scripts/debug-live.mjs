// scripts/debug-live.mjs — 針對 https://kjelly.github.io/local-note/ 完整驗證
import { chromium } from 'playwright';

const URL = 'https://kjelly.github.io/local-note/';
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext()).newPage();

const errs = [];
const logs = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));

console.log('--- Step 1: 載入頁面 ---');
await page.goto(URL, { waitUntil: 'networkidle' });
try { await page.waitForFunction(() => window.__lb_booted === true, { timeout: 10000 }); } catch {}
await page.waitForTimeout(2000);

const bootStatus = await page.evaluate(() => ({
  booted: !!window.__lb_booted,
  swActive: !!navigator.serviceWorker?.controller,
  swScript: navigator.serviceWorker?.controller?.scriptURL || null,
}));
console.log('boot status:', JSON.stringify(bootStatus));

console.log('\n--- Step 2: 看當前所有 notes ---');
const notes = await page.evaluate(() => Array.from(document.querySelectorAll('.note-item')).map((el) => ({
  id: el.dataset.id,
  title: el.querySelector('.title')?.textContent,
  isActive: el.classList.contains('active'),
})));
console.log('DOM notes:', JSON.stringify(notes));

if (notes.length < 2) {
  console.log('\n--- Step 3: 建立兩筆測試 notes ---');
  async function addNote(title, content) {
    await page.click('#addBtn');
    await page.waitForTimeout(300);
    await page.fill('#noteTitle', title);
    await page.fill('#editor', content);
    await page.waitForTimeout(1500);
  }
  await addNote('Note A', 'Content A');
  await addNote('Note B', 'Content B');
}

console.log('\n--- Step 4: 重新讀取 notes 列表 ---');
const idbAll = await page.evaluate(() => new Promise((resolve, reject) => {
  const req = indexedDB.open('local_brain_db', 3);
  req.onsuccess = () => {
    const tx = req.result.transaction('notes', 'readonly');
    const allReq = tx.objectStore('notes').getAll();
    allReq.onsuccess = () => resolve(allReq.result.map((n) => ({
      id: n.id, title: n.title?.value, content: n.content?.value,
    })));
    allReq.onerror = () => reject(allReq.error);
  };
  req.onerror = () => reject(req.error);
}));
console.log('IDB notes:', JSON.stringify(idbAll.map((n) => ({ id: n.id, title: n.title }))));

if (idbAll.length < 2) {
  console.log('❌ 測試終止：notes 數量 < 2');
  await browser.close();
  process.exit(1);
}

const a = idbAll.find((n) => n.title === 'Note A');
const b = idbAll.find((n) => n.title === 'Note B');

console.log('\n--- Step 5: 點擊 Note A ---');
await page.locator(`.note-item[data-id="${a.id}"]`).first().click();
await page.waitForTimeout(500);
const afterA = await page.evaluate(() => ({
  title: document.getElementById('noteTitle').value,
  content: document.getElementById('editor').value,
  activeId: document.querySelector('.note-item.active')?.dataset.id,
}));
console.log('after click A:', JSON.stringify(afterA));

console.log('\n--- Step 6: 點擊 Note B ---');
await page.locator(`.note-item[data-id="${b.id}"]`).first().click();
await page.waitForTimeout(500);
const afterB = await page.evaluate(() => ({
  title: document.getElementById('noteTitle').value,
  content: document.getElementById('editor').value,
  activeId: document.querySelector('.note-item.active')?.dataset.id,
}));
console.log('after click B:', JSON.stringify(afterB));

console.log('\n--- Page errors ---');
if (errs.length === 0) console.log('(none)');
else errs.forEach((e) => console.log(e));

console.log('\n--- Console messages (last 20) ---');
logs.slice(-20).forEach((l) => console.log(l));

// 判斷
const okA = afterA.title === 'Note A' && afterA.content === 'Content A' && afterA.activeId === a.id;
const okB = afterB.title === 'Note B' && afterB.content === 'Content B' && afterB.activeId === b.id;
console.log('\n=== RESULT:');
console.log('click A:', okA ? '✅' : '❌', `title=${afterA.title} content=${afterA.content} activeId=${afterA.activeId}`);
console.log('click B:', okB ? '✅' : '❌', `title=${afterB.title} content=${afterB.content} activeId=${afterB.activeId}`);
console.log('=== Overall:', okA && okB ? '✅ WORKS' : '❌ BROKEN', '===');

await browser.close();
process.exit(okA && okB ? 0 : 1);