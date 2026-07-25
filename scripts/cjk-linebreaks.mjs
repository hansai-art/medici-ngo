/**
 * 中文換行空白清理（Astro build integration）
 *
 * 問題：原始碼裡把一段中文寫成多行時，行尾那個換行在瀏覽器會渲染成一個半形空白。
 * 實測 Chromium 147：`樣子。所以` 寬 128px，`樣子。\n所以` 寬 132px，多出來的 4px
 * 就是那個不該存在的空白。中文排版不該有這種洞。
 *
 * 為什麼在 build 後改 HTML，而不是要求大家把段落寫成一行：
 * 1. 共編者交的是 markdown，不可能要求別人一段一行；
 * 2. 靠自律會隨每次編輯回歸，機器處理才是防線。
 *
 * 只動「兩個中日韓字元中間、只有空白與換行」的位置，
 * 且跳過 pre / code / script / style / textarea，不碰提示詞與程式碼。
 *
 * 已知限制：dev server 不經過這一步，所以 `astro dev` 看得到多餘空白，
 * build 與 PR 預覽站則是乾淨的。要驗排版請看 build 產物。
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 中日韓字元與全形標點。這些字之間的換行才需要清掉 */
const CJK = '\\p{Script=Han}\\u3000-\\u303F\\uFF00-\\uFFEF\\u2018\\u2019\\u201C\\u201D';

/**
 * 用 lookahead 不吃掉後面那個字，連續多行的中文才會每一行都被處理。
 * 若寫成兩個 capture group，`中\n文\n字` 只會被合併一次。
 */
const BREAK = new RegExp(`([${CJK}])[ \\t]*\\r?\\n[ \\t]*(?=[${CJK}])`, 'gu');

/** 這些標籤裡的換行是內容本身，NEVER 動 */
const SKIP = /(<(pre|code|script|style|textarea)\b[\s\S]*?<\/\2>)/gi;

export function collapseCjkBreaks(html) {
  let count = 0;

  /**
   * SKIP 帶兩個 capture group，所以 split 出來每三個一組：
   * i % 3 === 0 是要處理的文字，=== 1 是整段被跳過的區塊（原樣放回），
   * === 2 是標籤名的殘留（必須丟掉，放回去會多印一次 "pre"）。
   */
  const out = html
    .split(SKIP)
    .map((chunk, i) => {
      if (i % 3 === 2) return '';
      if (i % 3 === 1) return chunk;
      return chunk.replace(BREAK, (_m, c) => {
        count += 1;
        return c;
      });
    })
    .join('');

  return { html: out, count };
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (extname(entry.name) === '.html') yield path;
  }
}

/** @returns {import('astro').AstroIntegration} */
export default function cjkLinebreaks() {
  return {
    name: 'cjk-linebreaks',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        let files = 0;
        let joins = 0;
        for await (const path of walk(root)) {
          const src = await readFile(path, 'utf8');
          const { html, count } = collapseCjkBreaks(src);
          if (count > 0) {
            await writeFile(path, html, 'utf8');
            files += 1;
            joins += count;
          }
        }
        logger.info(`清掉 ${joins} 個中文換行空白（${files} 個檔案）`);
      },
    },
  };
}
