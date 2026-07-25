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

## F. playwright 版本要鎖死，不能浮動

- **日期**：2026-07-25
- **病徵**：`npm i -D playwright` 裝到 1.62，啟動時報
  `Executable doesn't exist at .../chromium_headless_shell-1234`。
- **根因**：每個 playwright minor 版綁一組自己的瀏覽器建置編號，浮動版號會讓
  本機快取的瀏覽器對不上，CI 與本機也會跑在不同版。
- **正解**：`"playwright": "1.59.1"`，不加 `^`。升版時連同
  `npx playwright install chromium` 一起做。
- **機器檢查**：版本鎖死本身就是防線，理由寫在 `package.json` 的
  `comments.playwright-pin`。
