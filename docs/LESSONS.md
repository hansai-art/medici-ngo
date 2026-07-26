# 踩坑紀錄

規則：每一條都要附一個機器檢查，或明寫為什麼機器檢查不了。
靠自律的規則會在下一次編輯回歸，只有防線會留下來。

---

## A. 頁面自己的 `padding-left: 0` 會把共用的左右留白吃掉

- **日期**：2026-07-25
- **病徵**：`/join` 與 `/fork` 的清單序號（01、02）貼在螢幕最左邊，手機上看起來像破版。
- **根因**：清單為了拿掉 `ol` 預設縮排寫了 `padding-left: 0`。它跟共用的 `.pad`
  同樣是單一 class 的優先度，而頁面的 scoped style 排在 global.css 後面，所以蓋掉了
  `.pad { padding-left: var(--gutter) }`，整條清單的左緣變成 0。
- **正解**：不要寫 `padding-left: 0`。`.pad` 本身已經壓過瀏覽器預設的
  `padding-inline-start: 40px`，只留 `list-style: none` 就夠。
- **機器檢查**：`npm run check:layout`。它用 Range 量文字節點的真實左緣（不是元素邊框，
  元素邊框在 `.pad` 上本來就是 0），並且額外檢查帶 `::before` / `::after` 的元素框位置,
  因為序號是偽元素、Range 量不到。已反向驗證：把 `padding-left: 0` 加回去會失敗，拿掉會通過。

## B. 中文段落寫成多行，行尾換行會變成一個多餘空白

- **日期**：2026-07-25
- **病徵**：`。` 與下一句之間多出一個半形空白，整篇中文看起來鬆鬆的。
- **根因**：HTML 把換行當空白處理。CSS Text 有「東亞文字之間的換行要移除」的規則，
  但實測 Chromium 147 沒有照做：`樣子。所以` 寬 128px，中間插一個換行變 132px。
- **正解**：不要求所有人把段落寫成一行（共編者交的是 markdown，不可能這樣要求），
  改成 build 完成後清掉。見 `scripts/cjk-linebreaks.mjs`，只動兩個中日韓字元之間、
  中間只有空白與換行的位置，並跳過 `pre / code / script / style / textarea`。
- **機器檢查**：`npm run test`（`scripts/cjk-linebreaks.test.mjs`，9 個案例，
  含中英文之間不能動、`pre` 內不能動）。build 時會印出清掉幾個。
- **已知限制**：`astro dev` 不經過這一步，dev 看得到多餘空白，build 產物才是乾淨的。
  要驗排版請看 `npm run build` 之後的結果或 PR 預覽站。

## C. `<pre>` 裡的表達式換行寫，會變成畫面上的首行縮排

- **日期**：2026-07-25
- **病徵**：`/prompts` 每一段提示詞的第一行都往右縮排一大段。
- **根因**：`<pre>` 原樣呈現內容。模板寫成
  `<pre>\n  {r.prompt}\n</pre>` 的話，那個換行加縮排就是真的字元。
- **正解**：`<pre>` 的表達式必須跟標籤寫在同一行。
- **機器檢查**：`npm run check:layout` 會擋下任何內容以空白開頭的 `<pre>`。
  已反向驗證：把表達式換行寫回去會失敗。
- **附帶**：複製鈕本身有 `.trim()`，所以複製出去的提示詞沒被污染，只是畫面難看。
  不要因為「複製沒壞」就放著。

## D. content layer 的 glob loader 不會自動略過底線開頭的檔案

- **日期**：2026-07-25
- **病徵**：加了 `src/content/episodes/_template.md` 之後 build 直接失敗，
  範本被當成真的一集去驗 schema。
- **根因**：舊版 content collections 會略過底線檔，content layer 的 `glob()` 不會，
  pattern 寫什麼就收什麼。這是靠記憶會踩的坑，實測才知道。
- **正解**：pattern 寫 `[!_]*.md`。範本因此可以跟真集數放在同一個資料夾
  （共編者要新增的就是那個資料夾，範本擺旁邊最好找），又不會自己變成一集。
- **機器檢查**：`npm run build`。範本一旦被收錄就會 schema 驗證失敗，build 直接紅燈。

## E. `@tailwindcss/vite` 4.3.x 會拉進第二份 Vite

- **日期**：2026-07-25
- **病徵**：`astro build` 炸在
  `Missing field tsconfigPaths on BindingViteResolvePluginConfig.resolveOptions`。
- **根因**：`@tailwindcss/vite` 4.3.x 依賴 Vite 8（rolldown），Astro 6.4.8 帶的是 Vite 7，
  兩份併存就爆。
- **正解**：鎖 `4.2.2`，它會 dedupe 到 Astro 的 Vite 7。這是 aiterms.tw 線上驗證過的組合。
- **機器檢查**：`package.json` 的版本鎖死不加 `^`，理由寫在同檔 `comments.tailwind-pin`。
  升 Tailwind 前必須先確認 Astro 的 Vite 主版本。

## F. OG 圖產生程式會被 noindex 頁面污染

- **日期**：2026-07-25
- **病徵**：全站預設分享圖 `default.jpg` 上面印著「內部儀表板」。
- **根因**：產圖程式掃 build 產物的 `og:image` 來決定要產哪些圖。
  內部儀表板沒有自己的 `og:image`，於是沿用 `BaseHead` 的預設值 `default.jpg`，
  程式就把那一頁的標題當成 default 的標題。
- **正解**：跳過帶 `noindex` 的頁面，而且 `default.jpg` 的內容寫死，
  用 `jobs.set()` 直接覆蓋，不要寫成 `if (!jobs.has(...))`。
- **機器檢查**：`npm run check:meta` 檢查每一頁的 `og:image` 檔案存在、
  不是 WebP（LINE 抓不到）、帶版本號。已反向驗證：刪掉一張 OG 圖會失敗。

## G. 字型子集會因為新內容而缺字

- **日期**：2026-07-25
- **病徵**：加了姊妹站連結（「詞典」「翰林」）之後，那幾個字掉回系統字型。
- **根因**：字型是子集，只含當時站上有的字。在 Mac 上看起來只是「有點不一樣」，
  在沒有中文襯線的裝置上就是豆腐字。這種問題肉眼幾乎看不出來。
- **正解**：`npm run font:build` 重新蒐集字集並重切。
- **機器檢查**：`npm run check:font` 比對 build 產物與 `public/fonts/coverage.json`，
  缺字就列出來並擋下 build。已反向驗證：塞一個生僻字進頁面會失敗。
- **附帶兩個坑**：
  - 收集字集時 NEVER 用 `c.trim()` 過濾空白：全形空白 U+3000 的 `trim()` 是空字串，
    會連它一起丟掉，中文排版裡的全形空白就變豆腐。
  - 檢查時要把 `<head>` 整段排除：`title` 與 `meta` 的字用的是系統介面字型，
    算進子集只會讓檔案變大，而且永遠用不到。

## H. playwright 版本要鎖死，不能浮動

- **日期**：2026-07-25
- **病徵**：`npm i -D playwright` 裝到 1.62，啟動時報
  `Executable doesn't exist at .../chromium_headless_shell-1234`。
- **根因**：每個 playwright minor 版綁一組自己的瀏覽器建置編號，浮動版號會讓
  本機快取的瀏覽器對不上，CI 與本機也會跑在不同版。
- **正解**：`"playwright": "1.59.1"`，不加 `^`。升版時連同
  `npx playwright install chromium` 一起做。
- **機器檢查**：版本鎖死本身就是防線，理由寫在 `package.json` 的
  `comments.playwright-pin`。

## I. lint 的屬性清單列不全，綠燈是假的

- **日期**：2026-07-25
- **病徵**：`lint-design-tokens.sh` 說「無違規」，但同一批檔案裡有 5 處寫死顏色。
- **根因**：檢查寫成 `(color|background|border-color|fill|stroke):` 開頭，
  漏了三種同樣會吃顏色的寫法：
  - `border: 1px dashed rgba(...)`（簡寫，不是 `border-color`）
  - `text-shadow: 0 2px 18px rgba(...)`
  - `background-image: linear-gradient(rgba(...))`
  只列想得到的屬性，等於把「我當下想得到幾種」變成防線的上限。
- **正解**：正面表列所有會吃顏色的 CSS 屬性，包含簡寫與 `--custom-property`。
  清單寫在腳本裡，加新屬性時一起加。
- **機器檢查**：`npm run lint:design` 第 3 項。已反向驗證：塞一行
  `border: 1px dashed rgba(1, 2, 3, 0.5)` 會被擋下來，舊版不會。
- **推論**：任何「列舉式」的檢查都有同一個弱點。寫完之後 MUST 反向驗證，
  而且要用「當初沒想到的那種寫法」去驗，不是用自己剛寫的那種。

## J. 視覺梗套在品牌名上，等於把品牌名弄不見

- **日期**：2026-07-25
- **病徵**：集數頁 header 的出品方名稱顯示成「院學 IA 奇第美」，讀不出來。
- **根因**：為了呼應達文西的鏡像筆記本，那一行加了 `transform: scaleX(-1)`。
  梗本身沒問題，問題是套用的對象是出品方的對外正式名稱。
  無障礙工具讀得到（文字本身沒被改），但看得到畫面的人讀不到。
- **正解**：品牌名恢復正常方向。達文西的梗要留，就留給裝飾性字串。
- **機器檢查**：**做不到，而且不該硬做**。
  「這個字串是不是品牌名」「這個視覺效果會不會讓它讀不出來」都是判斷題，
  寫成 lint 只會擋掉一堆合法的裝飾效果。
  真正抓到它的是「build 完在手機寬度截圖看一眼」這個習慣，
  這也是為什麼交付前一定要看實際畫面，不能只看檢查全綠。

## K. `kill()` 殺不到孫程序，CI 上檢查跑完了卻不肯結束

- **日期**：2026-07-26
- **病徵**：本機 `npm run check:layout` 5 秒跑完。同一支在 GitHub Actions 上
  5 頁全部印了 `✓`，然後就停在那裡，一路掛到 job timeout。
  介面上看起來像「檢查卡住」，實際上是「檢查做完了但 process 不肯退」。
- **根因**：腳本用 `spawn('npx', ['astro', 'preview'])` 起伺服器，收工時 `proc.kill()`。
  殺掉的是 `npx`，真正在跑的 `astro preview` 是它的**孫程序**，殺不到。
  孫程序繼承了同一組 stdio pipe，pipe 一直開著，node 的 event loop 就不會結束。
  macOS 上剛好收得掉，Linux 上收不掉：**這種平台差異在本機永遠測不出來**。
- **正解**：檢查腳本不要起子程序。改成行程內的 `node:http` 靜態伺服器
  （`scripts/lib/static-server.mjs`），`close()` 就真的關掉了。順便從 10 秒降到 5 秒。
  路徑對應要跟 `astro.config.mjs` 對齊：`build.format: 'file'` 所以 `/ep/1` 對到 `dist/ep/1.html`。
- **機器檢查**：CI 本身。job 有 `timeout-minutes: 20`，掛住會紅燈而不是無限等。
  已反向驗證換掉之後的 404 偵測仍然有效（在 dist 塞一個不存在的 css 連結會被抓到）。
- **推論**：**「本機會過」不是通過**。凡是牽涉子程序、訊號、檔案路徑大小寫的東西，
  第一次在 CI 上跑之前都不算驗證過。

## L. 「加自訂網域成功」不等於網域接上了，而且舊站會幫你偽裝成功

- **日期**：2026-07-26
- **病徵**：Pages 的加網域 API 回 `success: true`，`curl https://medici.ngo/` 回 200，
  看起來像上線了。實際上打開的是這個網域上原本就有的另一個站，
  我們的頁面一頁都沒上去。
- **根因**：兩件事被混為一談。
  - 「加自訂網域」只是在 Pages 專案上**登記**這個名字，
    真正把流量導過來的是 DNS 記錄。
  - `medici.ngo` 早就有 DNS 記錄指向別的站，而部署用的權杖沒有
    `Zone → DNS → Edit`，Cloudflare 自然沒動那筆記錄。
    網域狀態停在 `pending`，錯誤訊息是 `CNAME record not set`，
    但**不查那個欄位就看不到**。
  - 最陰的是舊站：它自己有 www 轉 apex 的規則，所以連
    `https://www.medici.ngo/join` 都乖乖 301 到 `https://medici.ngo/join`，
    看起來就像我們寫的 `_redirects` 生效了。
- **正解**：權杖要含 `Zone → DNS → Edit`。綁完之後查
  `GET /accounts/{acc}/pages/projects/{proj}/domains` 的 `status`，
  必須是 `active`，不是 `pending`。
- **機器檢查**：CI 的「線上回讀」步驟，**它一次打 5 個路徑而不是只打首頁**。
  舊站的首頁會回 200，但 `/ep/1`、`/ep/1.md`、`/sitemap.xml` 一定 404，
  所以只要多打幾條就穿幫了。已實際踩到並被這個檢查抓出來。
- **推論**：驗證上線 NEVER 只打首頁。首頁 200 是最容易造假的訊號：
  任何佔位站、任何錯誤頁、任何舊版本都會給你 200。

## M. 手機優先做過頭：桌機版是「中間一條手機」，而且沒有任何檢查會抓到

- **日期**：2026-07-26
- **病徵**：Hans 用桌機打開，2000px 的螢幕上內容擠在中間 720px，兩側全黑。
  手機版好好的，`npm run verify` 全綠，CI 全綠，沒有任何錯誤訊息。
- **根因**：整站的寬度只有一個權威 `.shell { max-width: 480px }`，
  加上唯一一個斷點 `@media (min-width: 900px) { .shell { max-width: 720px } }`。
  「限寬」被放在最外層的共用外殼，於是每一頁、包括滿版的 hero 與海報列，
  一起被關進同一條窄欄。900px 以下更糟：768px 的平板拿到 480px 的欄，兩側各留 144px。
- **正解**：把「限寬」從外殼下放到區塊，因為只有區塊自己知道它是圖、是字、還是卡列。
  - 外殼不限寬
  - 媒體（hero、卡列）滿版，用 `--edge` 決定內容從哪裡開始
  - 文字用 `.measure` / `.doc` 自己收窄
  - 超寬螢幕靠 `--edge: max(--gutter, (100vw - --content-max) / 2)` 收邊，
    標題與滿版卡列因此自動對齊同一條線
- **機器檢查**：`scripts/check-layout.mjs` 加了桌機 1440 視窗與兩項斷言。
  - `main` 的寬度必須等於視窗寬度（擋「共用外殼被限寬」這個根因）
  - 每頁自己宣告 `desktopSpan`（內容至少橫跨螢幕的幾成）。
    門檻按頁面意圖給，不是全站一個數字：首頁 90%（billboard），
    `/join` 這種文件頁 50%（刻意收成一欄置中）。
  - 已反向驗證：把 `.shell { max-width: 720px }` 加回去，5 頁全部變紅。
- **推論**：溢出有人擋，空曠沒人擋，但兩者是同一種病的兩面。
  「手機優先」是開發順序，不是驗收標準：只在 390px 驗收，
  等於把桌機版整個交給運氣。

## N. 深色底配灰字，靠肉眼永遠看不出來要改

- **日期**：2026-07-26
- **病徵**：Hans 說「黑底加灰字看不清楚，Netflix 不會犯這種錯」。
- **根因**：`--text-faint` 指到 `--c-parchment-700`（#5C554B），
  在 `--bg-page`（#0B0A0D）上只有 **2.7 : 1**，遠低於 WCAG AA 的 4.5。
  「美第奇 AI 學院 出品」「SEASON 1」這些字實際上接近隱形。
  沒被抓到的原因很簡單：在開發者的螢幕上、在亮度全開的房間裡，它看得到。
  對比是可以算的，但沒人算，就變成靠感覺，而感覺會被環境騙。
- **正解**：文字色階收成三階，而且三階都 ≥ 7 : 1（AAA 內文標準，不是 4.5）。
  站上大量文字是 `--fs-xs` / `--fs-sm`，中文筆畫又比拉丁字母密。
  要更低調就換字級與字重，NEVER 換更暗的顏色。
  壓在海報上的字一律實色 + `--text-shadow-*`，NEVER 加 alpha：
  半透明的實際對比取決於底下那張畫的哪一塊，算不出來也保證不了。
- **機器檢查**：新增 `scripts/check-contrast.mjs`（`npm run check:contrast`，
  已進 `npm run lint` 與 CI）。它解析 token 檔、跟著 `var()` 追到實際色值、
  用 WCAG 相對亮度算比值，任何 `--text-*` / `--status-*` 低於 7 : 1 就擋；
  另外擋「拿 `--border-*` / `--scrim-*` 當字色」。
  已反向驗證兩條規則都會變紅。
- **副產物**：`--status-fiction` 原本是 5.1 : 1（9px 的小字），一起被抓出來修掉。
- **推論**：任何「看起來還好」的視覺判斷，只要能算，就該算。
  算得出來的東西不要投票。

## O. 兩個「單獨看都對」的設定，湊起來就是自己跟自己搶收錄

- **日期**：2026-07-26
- **病徵**：切網域之後回讀線上 HTML，首頁的 canonical 是
  `https://medici.ngo/index.html`，但 sitemap 送出去的是 `https://medici.ngo/`。
  `/join`、`/prompts`、`/fork`、`/internal/dashboard` 同樣多一截 `.html`。
- **根因**：`astro.config.mjs` 的 `build.format` 是 `'file'`，
  所以 `Astro.url.pathname` 會帶副檔名。`BaseHead.astro` 直接拿它組 canonical。
  `/ep/[n]` 沒事，因為那一頁自己傳了 canonical，
  也正因為它沒事，看起來更像「canonical 這件事已經處理好了」。
  兩邊各自看都是對的：canonical 是絕對網址、指向本站、頁面也真的存在；
  sitemap 也沒錯。錯的是它們指到兩個不同的網址，
  而搜尋引擎收到的是「同一份內容有兩個正本」。
- **正解**：正規化收在 `BaseHead.astro`（`/index.html` → `/`、去掉 `.html`），
  不是叫每一頁自己傳 canonical。漏傳沒有任何徵兆，
  而預設值錯的時候，所有沒傳的頁面一起錯。
- **機器檢查**：`scripts/check-meta.mjs` 從 dist 的檔案路徑推出「這一頁對外的網址」，
  canonical 必須完全等於它（規則跟 `sitemap.xml.ts` 同一套），
  順便擋 og:url 與 canonical 不一致。
  已反向驗證：修之前跑會紅 5 頁（比肉眼多抓到內部儀表板），修完綠。
- **推論**：檢查「這個值長得對不對」不夠，要檢查「這個值跟另一份文件講的是不是同一件事」。
  單點驗證抓不到互相矛盾。

## P. Pages 的 `_redirects` 會靜默吃掉不支援的規則

- **日期**：2026-07-26
- **病徵**：`public/_redirects` 裡的
  `https://www.medici.ngo/* https://medici.ngo/:splat 301` 一行都沒生效，
  線上 `https://www.medici.ngo/` 回 200 而不是 301，
  兩個網域各自服務同一份內容。
- **根因**：Cloudflare Pages 的 `_redirects` 來源欄只吃路徑，
  官方文件把 domain-level redirect 明列為不支援。
  遇到不支援的規則它不報錯、不警告，build 照樣綠，就只是忽略。
  檔案本身讀起來完全合理，連註解都寫得振振有詞（那條註解是我寫的，而且是錯的）。
- **正解**：跨網域轉址搬到 Cloudflare zone 的 Redirect Rules（proxy 層，Pages 之前執行）：
  `https://www.medici.ngo/*` → `https://medici.ngo/${1}`，301，勾保留查詢字串。
  這條規則不在 repo 裡，所以它是否還活著只有打線上才知道。
- **機器檢查**：兩道。
  - `scripts/check-redirects.mjs`：`_redirects` 的來源欄出現完整網址就擋，
    直接在錯誤訊息裡說「要去 zone 的 Redirect Rules 設」。已反向驗證。
  - CI 的「線上回讀」加驗 `https://www.medici.ngo/ep/1` 必須回 301
    且 `Location` 正好是 `https://medici.ngo/ep/1`。
    設定在 dashboard、不在版控裡的東西，只能用線上回讀當防線。
- **推論**：「寫了但被忽略」比「寫錯被擋下」危險得多，
  因為前者會留下一份看起來已經處理好的證據。
  平台的支援範圍要查文件，不能靠讀起來合不合理。
