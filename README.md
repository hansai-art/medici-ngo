# 動畫接龍 · medici.ngo

一場 AI 短劇接力：每位創作者做 60 秒的一集，交出完整劇本與提示詞，讓下一個人接下去。
觀眾與作者都猜不到下一集。美第奇 AI 學院出品。

這個 repo 同時是三件事：

1. **網站正本**（<https://medici.ngo>）
2. **每一集劇本與提示詞的正本**：`src/content/episodes/`，一集一個 markdown 檔
3. **接棒的入口**：新增一集 = 開一個 PR

想接棒 → 讀 [CONTRIBUTING.md](CONTRIBUTING.md)，創作規則在 <https://medici.ngo/join>。

---

## 技術

| 項目 | 選擇 | 為什麼 |
|---|---|---|
| 框架 | Astro 6，static output，不裝 adapter | 頁面 100% 靜態，JS 只在必要處 inline |
| 部署 | GitHub Actions 建置 → `wrangler pages deploy` | 建置不吃 Cloudflare 額度，而且預覽網址只有在檢查全過之後才會出現 |
| 動態端點 | Cloudflare Pages Functions（`functions/`） | 只有兩個：`/api/beat` 追蹤、`/api/vote` 投票 |
| 資料 | Cloudflare D1 | 免費額度每天 10 萬筆寫入，遠超需求。沒有後台，內容全在 Git |
| 樣式 | 三層 token（primitive → semantic → 頁面） | 改視覺只改 `src/styles/tokens/semantic.css`，不動頁面 |

不用 Supabase、不用 CMS、不用資料庫後台。內容的單一來源就是 markdown 檔。

### 資料層的關鍵設計

分鏡劇本與提示詞放在**同一個 `shots` 陣列**，一鏡一組。
規格本來就要求每鏡對應一個提示詞，合成一個陣列之後兩者永遠不可能不同步，
「一鍵複製提示詞」與「劇本逐字比對」也共用同一份資料。

`src/content.config.ts` 的 zod schema 就是投稿契約：欄位不齊、鏡號跳號、
接點卡不是 3 必守 1 懸念，build 直接失敗，PR 進不來。

---

## 開發

```bash
npm install
npm run dev          # http://localhost:4321，純靜態頁
npm run dev:api      # http://localhost:8788，含 Functions 與本機 D1（要先 npm run build）
```

送 PR 之前跑一次全部：

```bash
npm run verify
```

它會依序跑：內容 lint → 設計 token lint → 單元測試 → 型別 → 建置 →
版面 → 字型缺字 → SEO metadata。CI 跑的是同一組，本機綠了 CI 才會綠。

### 常用指令

| 指令 | 做什麼 |
|---|---|
| `npm run lint` | 內容規則 + 設計 token |
| `npm run check:layout` | 真瀏覽器量手機版有沒有破版、貼邊 |
| `npm run font:build` | 重新蒐集字集並重切子集（加了新內容之後） |
| `npm run og:build` | 重產 OG 分享圖 |
| `npm run db:init` | 建本機 D1 的表 |
| `npm run seo:indexnow` | 內容真的有變動之後才送，NEVER 每次部署都送 |

`font:build` 與 `og:build` 需要 Noto Sans TC（思源黑體）原檔，取得方式見
[docs/OPERATIONS.md](docs/OPERATIONS.md) 第 8 節。

---

## 文件

| 檔案 | 內容 |
|---|---|
| [CONTRIBUTING.md](CONTRIBUTING.md) | 接棒流程、會遇到的機器檢查 |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | 只有在 Cloudflare 後台才能做的事：D1、存取控制、額度、資料清理 |
| [docs/LESSONS.md](docs/LESSONS.md) | 踩坑紀錄。每一條都附一個機器檢查 |
| [CONTENT-LICENSE](CONTENT-LICENSE) | 劇本與提示詞的授權範圍 |
| [LICENSE](LICENSE) | 程式碼授權 |

---

## 授權

| 範圍 | 授權 |
|---|---|
| 劇本與提示詞（`src/content/`） | CC BY 4.0，署名即可自由使用、改作、商用 |
| 程式碼 | MIT |
| 成品影片 | 著作權屬創作者本人，不在上述授權內 |
| 影像素材（`public/`） | 各自標示，見 `public/credits/ASSET-MANIFEST.json` |

## 隱私

不存 IP、不存 User-Agent、不做裝置指紋、不落 cookie。
session id 是隨機值放 sessionStorage，關掉分頁就消失。
追蹤只用來改劇本，不用來追人。
