/**
 * 檢查 build 產物用到的字，字型子集裡都有。
 *
 * 跑法：npm run check:font（在 build 之後）
 *
 * 為什麼需要這個：字型是子集的，只含當時站上有的字。
 * 有人加了一集、寫了新的字，那些字會靜靜地掉回系統字型，
 * 在 Mac 上看起來只是「有點不一樣」，在沒有中文襯線的裝置上就是豆腐字。
 * 這種問題肉眼很難發現，所以必須讓 build 擋下來。
 *
 * 修法：npm run font:build（重新蒐集字集並重切字型）。
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';

const DIST = new URL('../dist/', import.meta.url).pathname;
const COVERAGE = new URL('../public/fonts/coverage.json', import.meta.url).pathname;

/**
 * head 整段拿掉：title 與 meta 的字是給瀏覽器分頁與搜尋結果用的，
 * 那裡用的是系統介面字型，不是我們的網頁字型。把它們算進子集
 * 只會讓字型變大，而且永遠不會被用到。
 */
const STRIP =
  /<head\b[\s\S]*?<\/head>|<(script|style)\b[\s\S]*?<\/\2>|<!--[\s\S]*?-->|<[^>]+>/gi;

/** 只管中日韓字：西文與數字有系統字型可用，缺了也不會變豆腐 */
const CJK = /[　-〿㐀-䶿一-鿿豈-﫿＀-￯]/;

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (extname(entry.name) === '.html') yield path;
  }
}

const { codepoints } = JSON.parse(await readFile(COVERAGE, 'utf8'));
const covered = new Set(codepoints.regular);

const missing = new Map();

for await (const path of walk(DIST)) {
  const html = await readFile(path, 'utf8');
  const text = html
    .replace(STRIP, ' ')
    // 常見 HTML entity 還原，不然 &quot; 這種會被拆成字母
    .replace(/&[a-z]+;|&#\d+;/gi, ' ');

  for (const ch of text) {
    if (!CJK.test(ch)) continue;
    if (covered.has(ch.codePointAt(0))) continue;
    const where = missing.get(ch) ?? new Set();
    where.add(path.replace(DIST, ''));
    missing.set(ch, where);
  }
}

if (missing.size) {
  console.error(`字型子集缺 ${missing.size} 個字，這些字會掉回系統字型：\n`);
  [...missing].slice(0, 40).forEach(([ch, files]) => {
    console.error(`  ✗ ${ch}  U+${ch.codePointAt(0).toString(16).toUpperCase()}  ${[...files].join(', ')}`);
  });
  if (missing.size > 40) console.error(`  ... 另外 ${missing.size - 40} 個`);
  console.error('\n修法：npm run font:build');
  process.exit(1);
}

console.log(`字型覆蓋檢查通過：子集含 ${covered.size} 字，build 產物沒有缺字。`);
