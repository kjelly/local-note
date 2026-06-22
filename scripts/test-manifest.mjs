// scripts/test-manifest.mjs — 確認部署後 manifest 與 SW v4 沒有 CSP error
import { chromium } from 'playwright';

const URL = 'https://kjelly.github.io/local-note/';
const browser = await chromium.launch({ headless: true });
const page = await (await browser.newContext()).newPage();

const errs = [];
const cspViolations = [];
page.on('pageerror', (e) => errs.push(String(e)));
page.on('console', (msg) => {
  const text = msg.text();
  if (text.includes('Content Security Policy') || text.includes('manifest')) {
    cspViolations.push(text);
  }
});

await page.goto(URL, { waitUntil: 'networkidle' });
try { await page.waitForFunction(() => window.__lb_booted === true, { timeout: 10000 }); } catch {}
await page.waitForTimeout(3000);

// 確認 manifest 是從 ./manifest.webmanifest 載入（不是 blob:）
const manifestSrc = await page.evaluate(async () => {
  const link = document.querySelector('link[rel="manifest"]');
  return link?.href || null;
});
console.log('manifest link href:', manifestSrc);

// 試 fetch manifest
const manifestStatus = await page.evaluate(async () => {
  const r = await fetch('./manifest.webmanifest');
  return { status: r.status, type: r.headers.get('content-type'), len: (await r.text()).length };
});
console.log('manifest fetch:', JSON.stringify(manifestStatus));

console.log('\n--- CSP / manifest console messages ---');
if (cspViolations.length === 0) console.log('(none)');
else cspViolations.forEach((m) => console.log(m));

console.log('\n--- PAGE ERRORS ---');
if (errs.length === 0) console.log('(none)');
else errs.forEach((e) => console.log(e));

const ok = cspViolations.length === 0 && errs.length === 0 && manifestStatus.status === 200;
console.log('\n=== RESULT:', ok ? '✅ no CSP errors, manifest loads from /manifest.webmanifest' : '❌', '===');

await browser.close();
process.exit(ok ? 0 : 1);
