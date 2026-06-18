# Local Brain v24

可離線、可同步的純前端筆記 SPA，從 v23 (單一 HTML 檔) 拆出 ESM 模組、IndexedDB 與 PWA 的現代化版本。

詳細重構計畫見 [PLAN.md](./PLAN.md)。

## 開發

```bash
npm install
npm run dev       # 開發伺服器 http://localhost:5173
npm run build     # 產出靜態檔到 dist/
npm run preview   # 預覽 build 結果
npm test          # 跑單元測試（Vitest）
```

## 目錄

```
index.html                # 殼：含 manifest、CSP、模組 entry
sw.js                     # Service Worker
src/
  main.js                 # bootstrap
  core/                   # store, idb, migration
  model/                  # note 模型
  ui/                     # sidebar, editor, links, history, ai-panel, modal
  sync/                   # webdav, gdrive, disk, manager, queue
  services/               # (預留) ollama, markdown
  util/                   # escape, id, time, dom, shortcut
  styles/                 # 拆出去的 CSS
test/                     # Vitest 單元測試
```

## Phase 進度

- [x] **P1** 修 bug：escape 補強、innerHTML→DOM API、CSP、SW、localStorage→IndexedDB migration
- [x] **P2** 欄位級 LWW + 全新資料模型（title/content/links/pinned 各自 LWW）
- [x] **P3** 搜尋反向索引（Map<token, Set<id>>）+ 設定改存 IndexedDB meta
- [x] **P4** 虛擬捲動（固定列高 + overscan）+ render patch
- [x] **P5** 同步強化：3-way merge + ETag/If-Match + 背景同步佇列（指數退避）
- [x] **P6** 附件（IndexedDB blob）+ Markdown 預覽（marked + DOMPurify）
- [x] **P7** 無障礙（focus trap / aria）+ 安全（Web Crypto）+ 工程化（ESLint / CI / perf）

## 指令

```bash
npm run dev       # 開發伺服器
npm run build     # 產出靜態檔到 dist/
npm test          # 跑單元 + UI 測試（146 個）
npm run lint      # ESLint 檢查
npm run perf      # 1000 筆冷啟/搜尋效能 smoke test
node scripts/test-content.mjs  # 用 Playwright 跑真實瀏覽器測試部署
```

部署到 https://kjelly.github.io/local-note/ 後若功能異常（特別是 SW cache 還在舊版），請於 DevTools → Application → Service Workers 點 **Unregister**，再強制重整（Ctrl+Shift+R）。

## 部署到 GitHub Pages

推到 `main` 分支後，`.github/workflows/deploy.yml` 會自動：
1. 跑 `npm test`
2. 跑 `npm run build`
3. 把 `dist/` 部署到 GitHub Pages

首次使用要：
- Repo → Settings → Pages → Source 設為 **GitHub Actions**
- 之後 `https://<user>.github.io/<repo>/` 就會拿到靜態站

路徑用 `./` 相對（`base: './'`），所以子路徑部署也正常。`sw.js` / `.nojekyll` / `404.html` 放在 `public/`，Vite 會原樣複製到 `dist/`。
