// scripts/test-swap.mjs — 模擬使用者被 SW cache 卡住的真實情境
import { chromium } from 'playwright';

const URL = 'https://kjelly.github.io/local-note/';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ serviceWorkers: 'allow' });
const page = await ctx.newPage();

const errs = [];
page.on('pageerror', (e) => errs.push(String(e)));
const logs = [];
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));

// 第一次載入：會註冊 SW v3（fresh user）
await page.goto(URL, { waitUntil: 'networkidle' });
try { await page.waitForFunction(() => window.__lb_booted === true, { timeout: 10000 }); } catch {}
await page.waitForTimeout(2000);

let swVer = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  const scriptURL = reg?.active?.scriptURL || reg?.installing?.scriptURL || reg?.waiting?.scriptURL || '';
  const match = scriptURL.match(/v\d+/);
  return match ? match[0] : null;
});
console.log('SW version after first load:', swVer);

// 建立測試 notes
async function addNote(title, content) {
  await page.click('#addBtn');
  await page.waitForTimeout(300);
  await page.fill('#noteTitle', title);
  await page.fill('#editor', content);
  await page.waitForTimeout(1200);
}
await addNote('AAAA 標題', 'AAAA 內容');
await addNote('BBBB 標題', 'BBBB 內容');

// 取得 note id（用 IDB 對應）
const idb = await page.evaluate(() => new Promise((resolve, reject) => {
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
console.log('IDB notes:', JSON.stringify(idb.map((n) => ({ id: n.id, title: n.title }))));

const a = idb.find((n) => n.title === 'AAAA 標題');
const b = idb.find((n) => n.title === 'BBBB 標題');

// 第一次點擊
await page.locator(`.note-item[data-id="${a.id}"]`).first().click();
await page.waitForTimeout(300);
const t1 = await page.locator('#noteTitle').inputValue();
const c1 = await page.locator('#editor').inputValue();
console.log('click AAAA →', t1, '/', c1);

await page.locator(`.note-item[data-id="${b.id}"]`).first().click();
await page.waitForTimeout(300);
const t2 = await page.locator('#noteTitle').inputValue();
const c2 = await page.locator('#editor').inputValue();
console.log('click BBBB →', t2, '/', c2);

const ok = t1 === 'AAAA 標題' && c1 === 'AAAA 內容' && t2 === 'BBBB 標題' && c2 === 'BBBB 內容';
console.log('\n=== E2E RESULT:', ok ? '✅' : '❌', '===');

if (errs.length) {
  console.log('\n--- PAGE ERRORS ---');
  errs.forEach((e) => console.log(e));
}
console.log('\n--- CONSOLE (last 15) ---');
logs.slice(-15).forEach((l) => console.log(l));

await browser.close();
process.exit(ok ? 0 : 1);
