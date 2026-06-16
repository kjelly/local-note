# Local Brain v24 重構計畫

> 對象：`/home/kjelly/github/local-note`
> 現況：單一 `index.html`（517 行），vanilla SPA，無建置工具，`localStorage` 儲存，無框架。

---

## 1. 目標重述

| 目標 | 具體指標 |
|---|---|
| **協作規模** | 支援多裝置（WebDAV / GDrive / 本機檔三方中任一為 sync hub）；千筆以上筆記仍秒開 |
| **衝突正確** | 同時編輯的兩台裝置不會互相覆蓋（用向量時鐘 + LWW） |
| **模組化** | 拆成 ~20 個 ESM 檔案，主檔 < 100 行；建置後仍是單一靜態部署 |
| **品質** | 補上單元測試與 e2e，CSP 啟用，無障礙 AA |
| **零後端** | 仍維持無自有伺服器；同步走現有 WebDAV / GDrive（CRDT 邏輯在前端做） |

---

## 2. 架構總覽

```
                ┌──────────────────────────────┐
                │           UI Layer            │
                │  (render functions, DOM API)  │
                └──────────────┬───────────────┘
                               │ subscribes
                ┌──────────────▼───────────────┐
                │         Reactive Store        │
                │  (signals, IndexedDB backed)  │
                └──────────────┬───────────────┘
                               │ events
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
┌───────▼────────┐    ┌────────▼────────┐    ┌────────▼─────────┐
│  Local Repo    │    │  Sync Manager   │    │  Services        │
│  (IndexedDB)   │◄──►│  (3-way merge)  │    │  (Ollama, etc)   │
└────────────────┘    └────────┬────────┘    └──────────────────┘
                               │
            ┌──────────────────┼──────────────────┐
            ▼                  ▼                  ▼
       ┌─────────┐       ┌──────────┐       ┌──────────┐
       │ WebDAV  │       │ GDrive   │       │ Local FS │
       └─────────┘       └──────────┘       └──────────┘
```

**關鍵設計決策**：
- **資料模型**：每筆 note 有 `id`, `rev`（單調遞增的修訂號）, `clock`（向量時鐘 `{[deviceId]: n}`）, `title`, `content`, `links[]`, `pinned`, `history[]`（仍保留時光機）
- **衝突解決**：`rev` 高者勝；同 `rev` 時比 `clock` dominates；都不分勝負時欄位級 LWW（title 與 content 各自獨立 `rev`/`clock`，避免一邊改標題就吃掉另一邊的內容）
- **裝置識別**：開機時產生/讀取 `deviceId`（UUIDv7）存於 IndexedDB
- **同步觸發**：
  - 本地變更 → debounce 2s → 排入同步佇列
  - 啟動時、視窗 focus、網路回復 → 拉遠端
  - Service Worker `sync` 事件 → 背景補傳
- **本地儲存**：`IndexedDB` 取代 `localStorage`；用 `idb` 輕量包裝
- **多 hub 策略**：所有設定的 hub 都會在背景維持「最新資料」；同步時誰最後成功回 200/204，誰就被標記為「最後勝出的 hub」，下次本機變更優先推給它；其他 hub 仍在背景週期性 reconcile

---

## 3. 目錄結構

```
local-note/
├─ index.html                     # 空殼：<div id="app"> + <script type="module" src="/src/main.js">
├─ public/
│  └─ icons/                      # PWA 圖示
├─ src/
│  ├─ main.js                     # bootstrap
│  ├─ core/
│  │  ├─ store.js                 # 30 行 signals
│  │  ├─ idb.js                   # IndexedDB 封裝
│  │  ├─ lww.js                   # 向量時鐘 + 欄位級合併
│  │  ├─ search-index.js
│  │  └─ event-bus.js
│  ├─ model/
│  │  └─ note.js                  # createNote / applyPatch / 序列化
│  ├─ sync/
│  │  ├─ manager.js               # 3-way reconcile
│  │  ├─ queue.js
│  │  ├─ webdav.js
│  │  ├─ gdrive.js
│  │  └─ disk.js
│  ├─ ui/
│  │  ├─ sidebar.js
│  │  ├─ editor.js
│  │  ├─ editor-toolbar.js        # 編輯/預覽切換、插入連結/圖片
│  │  ├─ links.js
│  │  ├─ history.js
│  │  ├─ attachments.js           # 拖拽/貼上 → IndexedDB blob
│  │  ├─ ai-panel.js
│  │  ├─ modal.js                 # 含 focus trap
│  │  ├─ command-palette.js
│  │  └─ toast.js
│  ├─ services/
│  │  ├─ ollama.js
│  │  └─ markdown.js              # marked + DOMPurify
│  ├─ util/
│  │  ├─ escape.js
│  │  ├─ time.js
│  │  ├─ dom.js                   # h() / delegate()
│  │  ├─ shortcut.js
│  │  └─ id.js                    # uuid v7
│  └─ styles/
│     ├─ base.css
│     ├─ sidebar.css
│     ├─ editor.css
│     ├─ modal.css
│     └─ ai.css
├─ test/
│  ├─ unit/
│  │  ├─ lww.test.js
│  │  ├─ search.test.js
│  │  ├─ escape.test.js
│  │  ├─ model.test.js
│  │  ├─ store.test.js
│  │  └─ markdown.test.js
│  ├─ ui/                         # @testing-library/dom + jsdom
│  │  ├─ sidebar.test.js
│  │  ├─ editor.test.js
│  │  ├─ links.test.js
│  │  ├─ history.test.js
│  │  └─ ai-panel.test.js
│  └─ e2e/                        # Playwright
│     └─ smoke.spec.js            # 新增→連結→同步→第二視窗→雙向保留
├─ sw.js
├─ vite.config.js
├─ vitest.config.js
├─ playwright.config.js
├─ package.json
├─ .eslintrc.cjs
├─ .prettierrc
└─ README.md
```

---

## 4. 核心資料模型

```js
// 存在 IndexedDB
{
  id: '01HXYZ...',                // uuidv7
  rev: 7,                          // 單調遞增
  clock: { 'dev-A': 3, 'dev-B': 2 }, // 向量時鐘
  deviceId: 'dev-A',               // 最後寫入者
  title:    { value: 'X',       rev: 7, clock: {...} },
  content:  { value: '...',     rev: 7, clock: {...} },
  links:    { value: [12,34],   rev: 5, clock: {...} },
  pinned:   { value: false,     rev: 1, clock: {...} },
  history:  [{ time, ts, content }],   // 時光機沿用
  createdAt: 1734567890
}
```

- **欄位級 LWW**：title 與 content 各自 `rev`/`clock`，避免一邊改標題就吃掉另一邊的內容
- **clock dominates** → **rev 大者勝** → 平手才比 timestamp
- 附件獨立表 `attachments: { id, noteId, blob, mime, createdAt }`

---

## 5. 同步流程

```
[本地變更]
   └─► store 通知
        └─► sync/queue 排入 (debounce 2s)
             └─► manager.pull(remote)
                  └─► 對每筆 LWW merge
                       └─► 寫回 IndexedDB
                            └─► diff 計算本地新變更
                                 └─► push(delta)
                                      └─► 失敗再 enqueue
```

- **WebDAV**：用 `If-Match: ETag`；ETag 不符代表遠端被改，退避重試一次再 merge
- **GDrive**：用 `modifiedTime` + `headRevisionId` 比對
- **本機檔**：寫入時重新讀回比對 mtime
- **三個 hub 任一** 成功即代表本機已收斂；其餘 hub 排隊下次輪詢
- **背景同步**：Service Worker `sync` 事件；UI 用 `online`/`offline` 事件 + 視窗 focus 觸發

---

## 6. Phase 拆解與時程

| Phase | 工作 | 估時 | 驗收 |
|---|---|---|---|
| **P1 修 bug** | escape 補強、innerHTML→DOM、SW 補完、CSP、localStorage→IndexedDB migration | 2 天 | migration 腳本可還原 v23 資料；CSP 不破壞功能 |
| **P2 新資料模型** | `model/note.js`、`lww.js` + 單元測試 | 2 天 | `lww.test.js` 100% case 通過 |
| **P3 拆模組** | 切檔、store、event-bus、UI 重寫 | 2~3 天 | 既有功能 1:1 對等，UI 測試通過 |
| **P4 效能** | 反向索引、虛擬捲動、render patch、rAF 批次 | 1~2 天 | 1000 筆冷啟 < 1s、搜尋 < 50ms |
| **P5 同步強化** | 3-way merge、ETag/If-Match、queue、bg sync | 2 天 | Playwright 雙視窗案例通過 |
| **P6 附件 + 預覽** | `attachments.js`、`marked`+`DOMPurify`、toolbar 切換 | 1~2 天 | 拖拽/貼上圖片可預覽、還原視窗資料仍在 |
| **P7 品質收尾** | focus trap、aria、IndexedDB 加密、ESLint/CI | 1~2 天 | Lighthouse PWA/A11y ≥ 90 |

**總估時 11~14 天**，可依狀況分批交付。

---

## 7. 範圍（in/out of scope）

| 項目 | 採用 | 說明 |
|---|---|---|
| Markdown | **純預覽模式** | toolbar 切換「編輯 / 預覽」；`marked` + `DOMPurify`；預覽用 split-view 與現有對照功能共存 |
| 附件 | **圖片進 IndexedDB** | 拖拽/貼上自動轉 blob，markdown 引用 `![](id)`；不同步到雲端 |
| 測試 | **較全面 UI 測試** | Vitest 純函式 + `@testing-library/dom` 測互動 + Playwright e2e（新增→連結→同步→模擬第二裝置） |
| i18n | **維持中文** | 不抽 key；註解與 commit 仍以中文 |
| 建置 | **Vite** | 仍可 `vite preview` 開檔即用；`npm run build` 產靜態檔 |
| 模組 | **ESM 拆檔** | 無框架；自製 30 行 reactive store |

---

## 8. 驗收標準

1. `npm run build` → 靜態檔可丟 GitHub Pages / Netlify / 自架 WebDAV
2. `npm test` 全綠（純函式 + UI 測試）
3. `npm run e2e` 通過
4. 1000 筆：冷啟 < 1s、搜尋 < 50ms
5. Lighthouse：PWA / Performance / Accessibility / Best Practices ≥ 90
6. CSP 啟用，無內聯腳本（`addEventListener` 而非 `onclick`）

---

## 9. 風險與取捨

| 議題 | 風險 | 緩解 |
|---|---|---|
| 引入 Vite | 失去「打開 HTML 就能跑」 | dev 用 `vite`，build 產出靜態檔；README 寫明兩種使用方式 |
| 向量時鐘體積 | 每筆 note 多 100~200 bytes | 可接受；用 `lz-string` 壓縮整包 JSON 後再上傳 |
| Markdown XSS | 渲染後注入 | 強制 `DOMPurify` |
| WebDAV 部分寫入 | 多人同時 PUT 覆蓋 | 用 `If-Match` 帶 ETag，衝突時退避重試 |
| 既有資料遷移 | v23 → v24 失敗 | 寫入前先把 localStorage 備份到 `IndexedDB` 內 `_legacy_v23` 表 |
| GDrive 速率限制 | 短時間大量 sync | 同步 manager 內建 token bucket |

---

## 10. 交付原則

- **從 P1 修 bug + IndexedDB 遷移起手**
- **多 hub 策略**：所有設定的 hub 都會在背景維持「最新資料」；同步時誰最後成功回 200/204，誰就被標記為「最後勝出的 hub」，下次本機變更優先推給它；其他 hub 仍在背景週期性 reconcile
- **每個 Phase 結束 commit 一次**（中文 commit message，沿用 repo 風格）

---

## 11. P1 詳細工作清單

1. **escape 補強**：`>`, `"`, `'`；掃所有 `innerHTML` 拼接改 DOM API
2. **innerHTML 全面盤點**：`renderList`、`renderLinksSection`、`addBtn` 等 → DOM API
3. **Service Worker 補完**：cache-first 給 `index.html`/icons；stale-while-revalidate 給其他
4. **CSP `<meta>`**：禁 inline、限制外部 script 來源
5. **本地儲存遷移**：`localStorage` → `IndexedDB`（`idb` 套件輕量包裝）
   - 啟動時偵測舊資料 → 寫入 `notes` 表 → 保留 `localStorage` 30 天作為 fallback
   - 移除 `localStorage` 後釋出配額
6. **5MB / 配額偵測**：`navigator.storage.estimate()` 滿 80% 提示匯出
7. **時間格式**：仍用 `toLocaleString()` 顯示，但內部比較改用 `Date.now()` 數字（為 P2 鋪路）
8. **基本單元測試骨架**：Vitest + jsdom 跑 `escape.test.js`

## 12. P1 完成定義

- `npm run dev` / `npm run build` 啟動成功
- `npm test` 全綠
- 重新整理後資料完整（從 IndexedDB 讀回）
- DevTools console 無 CSP 違規
- 既有功能 1:1 對等運作
