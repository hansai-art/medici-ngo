# 營運手冊

這一份寫的是「只有在 Cloudflare 後台才能做、程式碼做不到」的事。
程式碼裡出現 `見 docs/OPERATIONS.md` 的地方，指的都是這裡。

---

## 1. 部署密鑰（唯一必須在後台做的事）

部署走 GitHub Actions：檢查全過 → `wrangler pages deploy`。
Actions 需要一組 Cloudflare API token，**這是整條管線唯一沒辦法用程式建的東西**
（建 token 這個動作本身 API 不開放）。

Cloudflare Dashboard → 右上角頭像 → **API Tokens** → Create Token →
用 **Edit Cloudflare Workers** 範本，然後：

| 欄位 | 填什麼 |
|---|---|
| Permissions | `Account` → `Cloudflare Pages` → **Edit**（範本已含，確認有就好） |
| Permissions（再加一列） | `Zone` → `DNS` → **Edit** |
| Account Resources | Include → `Hans@groupg.org's Account` |
| Zone Resources | Include → Specific zone → `medici.ngo` |
| TTL | 不設到期，或設一年並記得續 |

**`Zone → DNS → Edit` 這一列不能省**。Pages 的「加自訂網域」API 只是登記，
真正把流量導過來的是 DNS 記錄；沒有 DNS 權限的話 API 會回成功，
網域狀態卻永遠停在 `pending / CNAME record not set`，而瀏覽器打開看到的是舊站，
很容易誤判成「綁好了」。

拿到 token 之後：

```bash
gh secret set CLOUDFLARE_API_TOKEN --repo <owner>/medici-ngo
# 貼上 token，Enter。帳號 ID 已經是 repo variable，不用再設
```

**NEVER 把 token 貼進任何檔案或聊天視窗**，只用 `gh secret set` 從標準輸入送進去。

沒設也不會讓 PR 變紅燈：CI 會跳過部署段並留一則 warning，檢查照跑。

## 2. D1 資料庫

已經建好了（2026-07-26，region APAC），`database_id` 在 `wrangler.toml`，
不是密鑰所以進版控。表也已經開好。要重建的話：

```bash
npx wrangler d1 create medici-ngo
# 把輸出的 database_id 填進 wrangler.toml，然後：
npx wrangler d1 execute medici-ngo --remote --file=./schema.sql
```

**綁定不用在後台設**。`wrangler.toml` 的 `[[d1_databases]]` 會跟著
`wrangler pages deploy` 一起上去，Production 與 Preview 都吃同一份設定。
（如果哪天改回 Pages 的 Git 整合，就要回後台手動綁，而且 Production 與 Preview
兩個環境都要綁：只綁一邊的話，另一邊的投票與追蹤會靜靜地不寫入而且不報錯。）

本機開發用的是完全隔離的另一份資料庫：

```bash
npm run db:init      # 建本機 D1 的表
npm run build
npm run dev:api      # http://localhost:8788，含 Functions 與本機 D1
```

## 3. 保護 /internal 與 /api/stats（上線前必做）

儀表板現在只靠 robots.txt 擋爬蟲，**那不是存取控制**，任何人打得到網址就看得到數字。
資料本身不含個資，但那是我們的營運資料。

Cloudflare Dashboard → Zero Trust → Access → Applications → Add an application：

- Type: Self-hosted
- Application domain: `medici.ngo`，Path 各建一條：`internal/*` 與 `api/stats`
- Policy: Allow，Include → Emails → 填自己的信箱

免費方案含 50 個使用者，夠用。設完之後用無痕視窗開
`https://medici.ngo/internal/dashboard`，應該要跳登入畫面，
**跳不出來就是沒生效，不要當作設好了**。

## 4. 洪水攻擊防護（Rate Limiting）

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

## 5. 額度與容量

| 資源 | 免費額度 | 我們的用量 | 撞牆點 |
|---|---|---|---|
| D1 寫入 | 10 萬列/天 | 一次完整觀看約 20 列 | 約 5000 次觀看/天 |
| D1 讀取 | 500 萬列/天 | 儀表板一次查詢數千列 | 幾乎不可能撞到 |
| D1 儲存 | 5 GB | 一次觀看約 1 KB | 幾乎不可能撞到 |
| Pages 建置 | 500 次/月 | **0** | 用不到：建置在 GitHub Actions，Cloudflare 只收檔案 |
| Pages 請求 | 無限 | 不限 | 撞不到 |
| GitHub Actions | 公開 repo 不計費 | 每個 PR 每次推送約 4 分鐘 | 撞不到（repo 若轉私有就會開始計費，每月 2000 分鐘） |

2026-07-26 查證：這個帳號底下 4 個 Pages 專案全部是 direct upload
（API 回報 `source: none`），從來沒有用過 Git 整合，所以 500 次/月的建置額度是滿的。
把建置搬到 Actions 之後這一格永遠是 0，不用再擔心額度。

撞到 D1 寫入上限時，第一個要改的不是升方案，是把心跳間隔從 3 秒拉長到 5 秒，
或改成只送 exit 那一發（會失去中途的曲線，但保得住「在第幾秒離開」）。

## 6. 資料清理

`watch_beats` 會一直長。每季跑一次：

```bash
npx wrangler d1 execute medici-ngo --remote \
  --command "DELETE FROM watch_beats WHERE ts < unixepoch('now','-180 day') * 1000"
```

刪之前先把要留的聚合結果導出來，明細刪掉就回不來了。

## 7. 第三方追蹤工具

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

## 8. 素材重建（字型與 OG 圖）

字型子集與 OG 圖是產生出來的檔案，不是手工做的。兩者都需要完整的
Noto Sans TC（思源黑體）原檔（各約 5.7 MB，SIL Open Font License 1.1，不進版控）：

```bash
mkdir -p _fonts && cd _fonts
curl -LO https://github.com/notofonts/noto-cjk/raw/main/Sans/SubsetOTF/TC/NotoSansTC-Regular.otf
curl -LO https://github.com/notofonts/noto-cjk/raw/main/Sans/SubsetOTF/TC/NotoSansTC-Bold.otf
```

放別的位置就設 `NOTO_SRC=/path/to/fonts`。子集需要 `pip3 install fonttools brotli`。

| 什麼時候要重跑 | 指令 |
|---|---|
| 加了新內容、出現原本沒有的字 | `npm run font:build` |
| 改了頁面標題或說明文字 | `npm run og:build` |
| 兩者都懶得判斷 | 兩個都跑，各約 30 秒 |

忘了跑不會靜靜地過去：`npm run check:font` 會列出缺哪些字，
`npm run check:meta` 會指出哪一頁的 OG 圖不存在。兩個都在 `npm run verify` 裡。

**換了 OG 圖的內容，MUST 同時把頁面的 `ogImage` 版本號往上加**（`?v=1` → `?v=2`）。
LINE 會用網址當快取鍵，不換網址就永遠是舊圖，而且你在自己手機上看不出來。

## 9. 搜尋引擎驗證與收錄

| 平台 | 驗證方式 | 之後要做什麼 |
|---|---|---|
| Google Search Console | DNS TXT（Cloudflare 加一筆） | 提交 `https://medici.ngo/sitemap.xml` |
| Bing Webmaster Tools | 可以直接從 GSC 匯入 | 同上 |
| IndexNow | 已備好，金鑰檔在 `public/` | 部署後跑 `npm run seo:indexnow` |

IndexNow **只在真的有內容變動之後跑**，NEVER 每次部署都送：
短時間重複送同一批網址會被降權處理。先用 `node scripts/indexnow.mjs --dry-run`
看要送哪些網址。

## 10. 隱私立場

不存 IP、不存 User-Agent、不做裝置指紋。session id 是隨機值放 sessionStorage，
關掉分頁就消失，不落 cookie，所以不需要 cookie 同意橫幅。
這是刻意的選擇：這個站的定位是公開配方，追蹤只用來改劇本，不用來追人。
要加任何會落 cookie 的工具之前，先想清楚要不要連橫幅一起加。
