/**
 * 蒐集全站真正用到的字，依「粗體與否」分成兩袋。
 *
 * 跑法：npm run font:collect（要先 build）
 *
 * 為什麼要用真的瀏覽器跑一遍，而不是把 HTML 的字全部撈出來：
 * 中文字型子集的大小跟字數成正比，而粗體只出現在標題與少數強調處。
 * 用 getComputedStyle 逐個文字節點看實際的 font-weight，就能知道
 * 哪些字真的需要 Bold 字重，Bold 的子集因此只有 Regular 的幾分之一。
 * 用猜的一定會多包好幾百個字，那是使用者要下載的流量。
 *
 * 輸出 scripts/glyphs.json，交給 scripts/subset-font.py 產生 woff2。
 */

import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { serveDist } from './lib/static-server.mjs';

const PAGES = ['/', '/ep/1', '/join', '/prompts', '/fork', '/internal/dashboard'];
const PORT = 4398;
const OUT = new URL('./glyphs.json', import.meta.url);

/**
 * 一定要收進 Regular 的字，即使目前頁面上沒有。
 * 這些是「以後一定會用到但現在剛好沒出現」的字，
 * 少了它們每加一集就要重跑一次子集。
 */
const ALWAYS = [
  // 數字、英數、常見標點
  '0123456789',
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  'abcdefghijklmnopqrstuvwxyz',
  '，。、；：？！「」『』（）〈〉《》—…·　',
  '.,;:?!()[]{}"\'`~@#$%^&*-_=+/\\|<>',
  // 集數與時間單位：第 2 集之後一定會用到
  '第集季秒分鐘年月日天',
  '一二三四五六七八九十百千萬零壹貳參',
  // 狀態與介面字
  '待接棒開放製作中已完成上線草稿發布更新載入送出中選項投票結果',
];

const server = await serveDist(new URL('../dist', import.meta.url).pathname, PORT);
const browser = await chromium.launch();
const regular = new Set();
const bold = new Set();

try {
  const page = await (await browser.newContext()).newPage();

  for (const path of PAGES) {
    await page.goto(`${server.url}${path}`, { waitUntil: 'networkidle' });

    const buckets = await page.evaluate(() => {
      const light = new Set();
      const heavy = new Set();
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);

      let node = walker.nextNode();
      while (node) {
        const text = node.textContent ?? '';
        const parent = node.parentElement;
        if (text.trim() && parent) {
          // 600 以上才需要 Bold 字型檔。CSS 的字重匹配演算法會把 600 對到 700 的檔案
          const weight = Number(getComputedStyle(parent).fontWeight);
          const target = weight >= 600 ? heavy : light;
          for (const ch of text) target.add(ch);
        }
        node = walker.nextNode();
      }

      return { light: [...light], heavy: [...heavy] };
    });

    buckets.light.forEach((c) => regular.add(c));
    buckets.heavy.forEach((c) => bold.add(c));
    console.log(`  ${path} → 一般 ${buckets.light.length} 字，粗體 ${buckets.heavy.length} 字`);
  }
} finally {
  await browser.close();
  await server.close();
}

ALWAYS.join('').split('').forEach((c) => regular.add(c));

// 粗體的字必然也可能以一般字重出現（例如標題文字也出現在內文），
// 反過來不成立。所以 Regular 收 bold 的全部，Bold 只收自己那袋。
bold.forEach((c) => regular.add(c));

/**
 * 只丟掉換行與 tab 這種排版空白。
 * NEVER 用 `c.trim()` 當條件：全形空白 U+3000 的 trim() 是空字串，
 * 會連它一起丟掉，然後中文排版裡的全形空白就變成豆腐字。
 */
const clean = (set) =>
  [...set]
    .filter((c) => !/[\n\r\t]/.test(c))
    .sort()
    .join('');

const payload = {
  note: '由 scripts/collect-glyphs.mjs 產生，不要手改。改內容後跑 npm run font:build',
  regular: clean(regular),
  bold: clean(bold),
};

await writeFile(OUT, JSON.stringify(payload, null, 2) + '\n', 'utf8');

console.log(
  `\n共 ${[...regular].length} 字（其中 ${[...bold].length} 字需要粗體）→ scripts/glyphs.json`,
);
