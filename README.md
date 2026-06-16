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
- [ ] P2 欄位級 LWW + 全新資料模型
- [ ] P3 拆模組（已部分完成）
- [ ] P4 效能：反向索引、虛擬捲動
- [ ] P5 同步強化（3-way merge / ETag / bg sync）
- [ ] P6 附件（IndexedDB blob）+ Markdown 預覽
- [ ] P7 無障礙、安全、工程化
