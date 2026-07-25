# 營運手冊

這一份寫的是「只有在 Cloudflare 後台才能做、程式碼做不到」的事。
程式碼裡出現 `見 docs/OPERATIONS.md` 的地方，指的都是這裡。

---

## 1. 建 D1 資料庫

```bash
npx wrangler d1 create medici-ngo
# 把輸出的 database_id 填進 wrangler.toml，然後：
npx wrangler d1 execute medici-ngo --remote --file=./schema.sql
```

`database_id` 不是密鑰，可以進版控。

Pages 專案本身也要綁：Cloudflare Dashboard → Workers & Pages → medici-ngo →
Settings → Functions → D1 database bindings，變數名稱填 `DB`，
**Production 與 Preview 兩個環境都要綁**。只綁 Production 的話，
PR 預覽站的投票與追蹤會靜靜地不寫入，而且不會報錯。

本機開發用的是完全隔離的另一份資料庫：

```bash
npm run db:init      # 建本機 D1 的表
npm run build
npm run dev:api      # http://localhost:8788，含 Functions 與本機 D1
```

## 2. 保護 /internal 與 /api/stats（上線前必做）

儀表板現在只靠 robots.txt 擋爬蟲，**那不是存取控制**，任何人打得到網址就看得到數字。
資料本身不含個資，但那是我們的營運資料。

Cloudflare Dashboard → Zero Trust → Access → Applications → Add an application：

- Type: Self-hosted
- Application domain: `medici.ngo`，Path 各建一條：`internal/*` 與 `api/stats`
- Policy: Allow，Include → Emails → 填自己的信箱

免費方案含 50 個使用者，夠用。設完之後用無痕視窗開
`https://medici.ngo/internal/dashboard`，應該要跳登入畫面，
**跳不出來就是沒生效，不要當作設好了**。

## 3. 洪水攻擊防護（Rate Limiting）

`/api/beat` 與 `/api/vote` 是公開的寫入端點。程式碼只做輸入驗證與體積上限，
擋不住有人拿腳本猛打。D1 免費額度每天 10 萬次寫入，被打爆的下場是
當天的真實資料寫不進去。

Cloudflare Dashboard → Security → WAF → Rate limiting rules：

| 規則 | 設定 |
|---|---|
| 條件 | `URI Path starts with /api/` |
| 計數 | 同一 IP，1 分鐘內 |
| 上限 | 120 次（正常觀看一分鐘最多 20 次心跳，留 6 倍空間） |
| 動作 | Block，持續 1 分鐘 |

免費方案可以建一條，用在這裡剛好。

## 4. 額度與容量

| 資源 | 免費額度 | 我們的用量 | 撞牆點 |
|---|---|---|---|
| D1 寫入 | 10 萬列/天 | 一次完整觀看約 20 列 | 約 5000 次觀看/天 |
| D1 讀取 | 500 萬列/天 | 儀表板一次查詢數千列 | 幾乎不可能撞到 |
| D1 儲存 | 5 GB | 一次觀看約 1 KB | 幾乎不可能撞到 |
| Pages 建置 | 500 次/月 | 每個 PR 與每次 merge 各一次 | **共編流程的硬前提，開站前先確認還剩多少** |
| Pages 請求 | 無限 | — | — |

撞到 D1 寫入上限時，第一個要改的不是升方案，是把心跳間隔從 3 秒拉長到 5 秒，
或改成只送 exit 那一發（會失去中途的曲線，但保得住「在第幾秒離開」）。

## 5. 資料清理

`watch_beats` 會一直長。每季跑一次：

```bash
npx wrangler d1 execute medici-ngo --remote \
  --command "DELETE FROM watch_beats WHERE ts < unixepoch('now','-180 day') * 1000"
```

刪之前先把要留的聚合結果導出來，明細刪掉就回不來了。

## 6. 第三方追蹤工具

| 工具 | 用途 | 要填進哪裡 |
|---|---|---|
| GA4 | 流量與來源 | `src/components/seo/Analytics.astro` 的 measurement id |
| Microsoft Clarity | 操作錄影與熱區圖 | 同上，project id |
| Cloudflare Web Analytics | 免 cookie 的流量底線 | 同上，token |
| Google Search Console | 收錄狀況與搜尋字詞 | DNS TXT 驗證 |
| Bing Webmaster Tools | Bing 系收錄 | 同上 |
| YouTube Studio | 站外觀看的續看率 | 頻道後台，站內抓不到那一半只能在這看 |

三個腳本都只在 production 載入，而且延到首次互動或 idle 才載。
`/internal` 底下不掛任何追蹤，不然我們自己看數據會污染數據。

## 7. 隱私立場

不存 IP、不存 User-Agent、不做裝置指紋。session id 是隨機值放 sessionStorage，
關掉分頁就消失，不落 cookie，所以不需要 cookie 同意橫幅。
這是刻意的選擇：這個站的定位是公開配方，追蹤只用來改劇本，不用來追人。
要加任何會落 cookie 的工具之前，先想清楚要不要連橫幅一起加。
