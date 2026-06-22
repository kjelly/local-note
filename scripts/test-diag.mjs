// scripts/test-diag.mjs — 驗證 loadNote 診斷 log 並確認功能正常
import { chromium } from 'playwright';

const URL = 'https://kjelly.github.io/local-note/';
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext()).newPage();

const logs = [];
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));

await page.goto(URL, { waitUntil: 'networkidle' });
try { await page.waitForFunction(() => window.__lb_booted === true, { timeout: 10000 }); } catch {}
await page.waitForTimeout(2000);

// 建立 2 筆
async function addNote(title, content) {
  await page.click('#addBtn');
  await page.waitForTimeout(300);
  await page.fill('#noteTitle', title);
  await page.fill('#editor', content);
  await page.waitForTimeout(1500);
}
await addNote('Diag A', 'Content A');
await addNote('Diag B', 'Content B');

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
const a = idb.find((n) => n.title === 'Diag A');
const b = idb.find((n) => n.title === 'Diag B');

await page.reload({ waitUntil: 'networkidle' });
try { await page.waitForFunction(() => window.__lb_booted === true, { timeout: 10000 }); } catch {}
await page.waitForTimeout(2000);

console.log('--- 點擊 A ---');
await page.locator(`.note-item[data-id="${a.id}"]`).first().click();
await page.waitForTimeout(500);
console.log('title:', await page.locator('#noteTitle').inputValue());
console.log('content:', await page.locator('#editor').inputValue());

console.log('\n--- 點擊 B ---');
await page.locator(`.note-item[data-id="${b.id}"]`).first().click();
await page.waitForTimeout(500);
console.log('title:', await page.locator('#noteTitle').inputValue());
console.log('content:', await page.locator('#editor').inputValue());

console.log('\n--- 點回 A ---');
await page.locator(`.note-item[data-id="${a.id}"]`).first().click();
await page.waitForTimeout(500);
console.log('title:', await page.locator('#noteTitle').inputValue());
console.log('content:', await page.locator('#editor').inputValue());

console.log('\n--- 所有 console (含 loadNote 診斷 log) ---');
logs.forEach((l) => console.log(l));

await browser.close();