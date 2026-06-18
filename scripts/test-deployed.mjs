// scripts/test-deployed.mjs — 用真實 Chromium 測試 GitHub Pages 部署
import { chromium } from 'playwright';

const URL = 'https://kjelly.github.io/local-note/';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

const consoleLogs = [];
const pageErrors = [];
page.on('console', (msg) => consoleLogs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => pageErrors.push(String(err)));

await page.goto(URL, { waitUntil: 'networkidle' });
// 等 boot 完成
try {
  await page.waitForFunction(() => window.__lb_booted === true, { timeout: 10000 });
} catch (e) {
  console.log('boot timeout, will check console logs anyway');
}
await page.waitForTimeout(2000);

// 確認 DOM 結構
const noteListTag = await page.evaluate(() => {
  const el = document.getElementById('noteList');
  return el ? el.tagName : null;
});
console.log('noteList tag:', noteListTag);

// 新增 2 筆筆記（透過 UI 按 +）
await page.click('#addBtn');
await page.click('#addBtn');
await page.waitForTimeout(500);

// 看 sidebar 是否有 .note-item
const itemsBefore = await page.locator('.note-item').count();
console.log('items after add:', itemsBefore);

const noteIdsBefore = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('.note-item')).map(el => el.dataset.id);
});
console.log('note ids:', noteIdsBefore);

// 點第二個
const secondId = noteIdsBefore[1];
const secondItem = page.locator(`[data-id="${secondId}"]`).first();
const beforeActive = await page.evaluate(() => {
  return document.querySelector('.note-item.active')?.dataset.id;
});
console.log('active before click:', beforeActive);

await secondItem.click();
await page.waitForTimeout(300);

const afterActive = await page.evaluate(() => {
  return document.querySelector('.note-item.active')?.dataset.id;
});
console.log('active after click:', afterActive);

const noteTitle = await page.locator('#noteTitle').inputValue();
console.log('noteTitle after click:', noteTitle);

console.log('\n--- console logs ---');
consoleLogs.forEach(l => console.log(l));
if (pageErrors.length) {
  console.log('\n--- PAGE ERRORS ---');
  pageErrors.forEach(e => console.log(e));
}

await browser.close();
