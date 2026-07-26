# 怎麼接棒

這個 repo 是「動畫接龍」的網站，也是每一集劇本與提示詞的正本。
接棒 = 在這裡新增一個檔案，然後開一個 PR。

創作規則（世界觀、鉤子鐵律、60 秒節奏、必勝公式）在網站上：<https://medici.ngo/join>。
**這份檔案只講技術流程**，兩邊不重複寫，避免哪天改了一邊忘了另一邊。

---

## 流程

```
填表申請 → 通過後收到 repo 邀請 → 新增 ep-NN.md → 開 PR
       → 機器檢查 + 預覽網址 → 審過 merge → 自動上線
```

1. **填表申請**：<https://medici.ngo/join> 底部的表單。是美第奇 AI 學院的學員請勾選，會優先審。
2. **收到邀請**：審過之後你會收到 GitHub 的 collaborator 邀請信，接受就有寫入權限。
3. **投稿**：見下面兩條路。
4. **等檢查跑完**：PR 會自動跑內容與版面檢查。**全部通過**才會產出預覽網址，
   機器人會把網址留言在 PR 上。看到網址 = 這份稿子過了所有規則。
5. **審稿**：預覽站看得到實際畫面之後才會 merge。merge 完自動部署到正式站。

---

## 投稿：不會 Git 的路（推薦，手機也能做）

全程在 GitHub 網頁上，三次點擊：

1. 打開 [`src/content/episodes/_template.md`](src/content/episodes/_template.md)，
   按右上角的複製鈕把整份範本複製走
2. 回到 [`src/content/episodes/`](src/content/episodes)，按 **Add file → Create new file**，
   檔名填 `ep-02.md`（數字補零到兩位），把範本貼進去，逐格填掉
3. 頁面最下面選 **Create a new branch for this commit**，按 **Propose changes**

送出之後你會在 PR 頁面看到檢查結果。有紅燈就照訊息改，直接在網頁上編輯同一個檔即可，
PR 會自己更新。

## 投稿：會 Git 的路

```bash
git clone <repo>
cd medici-ngo
npm install
cp src/content/episodes/_template.md src/content/episodes/ep-02.md
# 填完之後，送出去之前先自己跑一次
npm run lint
npm run build
git switch -c ep-02
git add src/content/episodes/ep-02.md public/posters/ep-02.jpg
git commit -m "feat(content): add episode 2"
git push -u origin ep-02
```

**NEVER 直推 main**。main 有保護，直推會被拒絕。

---

## 你會遇到的機器檢查

檢查不是刁難。這些規則全部是踩過坑之後長出來的，紅燈的訊息會直接告訴你哪一行、
為什麼、怎麼改。

| 指令 | 擋什麼 |
|---|---|
| `npm run lint:content` | 集數撞號、檔名跟集數對不起來、提示詞夾中文、中文對白用半形引號、全形破折號、絕對宣稱沒附出處 |
| `npm run build` | 欄位缺漏、鏡號跳號、接點卡不是 3 必守 1 懸念、影片超過 60 秒、工具版本寫「最新」、史實註沒附來源 |
| `npm run lint:design` | 顏色寫死不用 token（只有動到頁面樣式才會遇到） |
| `npm run check:layout` | 手機版破版、內容貼到螢幕邊 |
| `npm run check:font` | 你的稿子出現了字型子集裡沒有的字（維護者處理，你不用管） |

一次跑完全部：`npm run verify`。

### 三個最常被擋下來的

1. **提示詞夾中文**：提示詞一律英文。中文在多數影片模型上表現不穩，而且英文才通用，
   別人換工具也能直接用。中文的部分寫在 `script` 裡。
2. **絕對宣稱沒附出處**：史實註寫「唯一」「第一名」「保證」這類話，必須附 `url`。
   查不到出處就改成中性表述。講史的內容只要一句查不到，整篇的可信度都會被質疑。
3. **接點卡**：必須剛好 3 條必守 + 1 個懸念。這是接龍能不能接得下去的關鍵，
   少一條下一棒就會走歪。

---

## 海報

每集要一張直式 2:3 的海報，放 `public/posters/ep-NN.jpg`。

- **JPG，NEVER WebP**：LINE 抓不到 WebP，分享出去完全沒有縮圖
- 短邊至少 800px
- `posterCredit` 欄位必須寫來源與授權。用公共領域畫作要寫出作品名、年代、館藏
- 用 AI 生成的就誠實寫是 AI 生成，以及用什麼工具

---

## 提交訊息

`feat: / fix: / docs: / chore:` 開頭，一行講清楚。新增一集用
`feat(content): add episode N`。

## 有問題

開 issue，或在 PR 裡直接問。不確定的地方**先問再寫**，寫完再改比較痛。
