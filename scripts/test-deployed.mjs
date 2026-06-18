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
try {
  await page.waitForFunction(() => window.__lb_booted === true, { timeout: 10000 });
} catch (e) {
  console.log('boot timeout');
}
await page.waitForTimeout(2000);

console.log('noteList tag:', await page.evaluate(() => document.getElementById('noteList')?.tagName));

// 新增 2 筆
await page.click('#addBtn');
await page.click('#addBtn');
await page.waitForTimeout(500);

const noteIds = await page.evaluate(() => Array.from(document.querySelectorAll('.note-item')).map((el) => el.dataset.id));
console.log('note ids:', noteIds);

// 注入 capture-phase listener 看 click 是否真的抵達 .note-item
await page.evaluate(() => {
  window.__lb_click_trace = [];
  document.querySelectorAll('.note-item').forEach((el) => {
    el.addEventListener('click', (e) => {
      window.__lb_click_trace.push({
        targetTag: e.target.tagName,
        targetClass: e.target.className,
        currentTargetId: e.currentTarget.dataset.id,
        defaultPrevented: e.defaultPrevented,
        path: e.composedPath().slice(0, 4).map((n) => n.tagName + (n.id ? '#' + n.id : '')).join(' > '),
      });
    }, true);
  });
});

const firstId = noteIds[0];
const secondId = noteIds[1];

// 攔截 activeNoteId 變化（觀察 DOM 的 active class 切換）
await page.evaluate(() => {
  window.__lb_active_changes = [];
  document.body.addEventListener('click', (e) => {
    const active = document.querySelector('.note-item.active');
    window.__lb_active_changes.push({
      clickTarget: e.target.tagName + (e.target.className ? '.' + e.target.className.split(' ')[0] : ''),
      clickDataId: e.target.dataset?.id,
      activeAtTime: active?.dataset.id,
    });
  }, true); // capture phase，看每次 click 時 active 是誰

  // 用 MutationObserver 觀察 .active class 變化
  window.__lb_muts = [];
  const obs = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'attributes' && m.attributeName === 'class') {
        const el = m.target;
        if (el.classList.contains('note-item')) {
          window.__lb_muts.push({
            id: el.dataset.id,
            hasActive: el.classList.contains('active'),
          });
        }
      }
    }
  });
  document.querySelectorAll('.note-item').forEach((el) => {
    obs.observe(el, { attributes: true, attributeFilter: ['class'] });
  });
  window.__lb_obs = obs;
});

// Dump #noteList 結構 + vl-items 細節
const dom = await page.evaluate(() => {
  const nl = document.getElementById('noteList');
  const vl = nl.querySelector('.vl-items');
  return {
    noteListChildren: Array.from(nl.children).map((c) => ({
      tag: c.tagName,
      class: c.className,
      childCount: c.children.length,
    })),
    vlItemsChildren: vl ? Array.from(vl.children).map((c) => ({
      tag: c.tagName,
      class: c.className,
      parentClass: c.parentElement?.className,
      parentTag: c.parentElement?.tagName,
      parentId: c.parentElement?.id,
    })) : null,
    noteItemParents: Array.from(document.querySelectorAll('.note-item')).map((el) => ({
      dataId: el.dataset.id,
      parentTag: el.parentElement?.tagName,
      parentClass: el.parentElement?.className,
      parentParentTag: el.parentElement?.parentElement?.tagName,
      parentParentId: el.parentElement?.parentElement?.id,
    })),
  };
});
console.log('\n--- DOM deep ---');
console.log(JSON.stringify(dom, null, 2));

const beforeActive = await page.evaluate(() => document.querySelector('.note-item.active')?.dataset.id);
console.log('active before:', beforeActive);

// 點第二個：用 .note-item[data-id] 確保選到 li，不是 split-btn
await page.evaluate(() => {
  window.__lb_poll = [];
  let last = '';
  const interval = setInterval(() => {
    const a = document.querySelector('.note-item.active');
    const cur = a?.dataset.id || null;
    if (cur !== last) {
      window.__lb_poll.push({ time: Date.now(), active: cur });
      last = cur;
    }
  }, 30);
  window.__lb_stop_poll = () => clearInterval(interval);
});

await page.locator(`.note-item[data-id="${secondId}"]`).first().click();
await page.waitForTimeout(500);
await page.evaluate(() => window.__lb_stop_poll?.());
const poll1 = await page.evaluate(() => window.__lb_poll || []);
console.log('\n--- poll during/after click second ---');
poll1.forEach((p) => console.log(JSON.stringify(p)));
const afterSecond = await page.evaluate(() => document.querySelector('.note-item.active')?.dataset.id);
const titleAfterSecond = await page.locator('#noteTitle').inputValue();
console.log('after click second → active:', afterSecond, 'title:', titleAfterSecond);

// 點第一個
await page.evaluate(() => {
  window.__lb_poll2 = [];
  let last = '';
  const interval = setInterval(() => {
    const a = document.querySelector('.note-item.active');
    const cur = a?.dataset.id || null;
    if (cur !== last) {
      window.__lb_poll2.push({ time: Date.now(), active: cur });
      last = cur;
    }
  }, 30);
  window.__lb_stop_poll2 = () => clearInterval(interval);
});
await page.locator(`.note-item[data-id="${firstId}"]`).first().click();
await page.waitForTimeout(500);
await page.evaluate(() => window.__lb_stop_poll2?.());
const poll2 = await page.evaluate(() => window.__lb_poll2 || []);
console.log('\n--- poll during/after click first ---');
poll2.forEach((p) => console.log(JSON.stringify(p)));
const afterFirst = await page.evaluate(() => document.querySelector('.note-item.active')?.dataset.id);
const titleAfterFirst = await page.locator('#noteTitle').inputValue();
console.log('after click first → active:', afterFirst, 'title:', titleAfterFirst);

const trace = await page.evaluate(() => window.__lb_click_trace || []);
console.log('\n--- click trace (capture phase on .note-item) ---');
trace.forEach((t) => console.log(JSON.stringify(t)));

const changes = await page.evaluate(() => window.__lb_active_changes || []);
console.log('\n--- active changes around clicks ---');
changes.forEach((c) => console.log(JSON.stringify(c)));

const muts = await page.evaluate(() => window.__lb_muts || []);
console.log('\n--- note-item class mutations ---');
muts.forEach((m) => console.log(JSON.stringify(m)));

const switched = afterSecond === secondId && afterFirst === firstId;
console.log('\n=== RESULT:', switched ? '✅ click switches active note' : '❌ click did NOT switch', '===');

console.log('\n--- console logs ---');
consoleLogs.forEach((l) => console.log(l));
if (pageErrors.length) {
  console.log('\n--- PAGE ERRORS ---');
  pageErrors.forEach((e) => console.log(e));
}

await browser.close();
process.exit(switched ? 0 : 1);
