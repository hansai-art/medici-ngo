/**
 * SEO metadata 守門：對 build 產物檢查每一頁的 head。
 *
 * 跑法：npm run check:meta（build 之後）
 *
 * 每一條都對應一個真的會發生、而且不會有人發現的錯：
 *
 * 1. og:image 檔案不存在 —— 分享出去是一張破圖，只有貼到 LINE 才會發現。
 *    2026-07-25 就踩過一次：內部儀表板沒填自己的 og:image，
 *    產圖程式照著它產出 default.jpg，全站預設分享圖變成「內部儀表板」。
 * 2. og:image 是 WebP —— LINE 抓不到，分享完全沒有縮圖。Hans 全站鐵律。
 * 3. og:image 沒有版本號 —— 換了圖 LINE 會一直拿舊快取，你會以為沒生效。
 * 4. canonical 不是絕對網址或指到別的網域 —— 直接影響收錄。
 * 5. title 或 description 空的 —— 搜尋結果會由引擎自己編。
 */

import { readdir, readFile, access } from 'node:fs/promises';
import { join, extname } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const DIST = join(ROOT, 'dist');
const ORIGIN = 'https://medici.ngo';

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (extname(entry.name) === '.html') yield path;
  }
}

const pick = (html, re) => html.match(re)?.[1] ?? null;

const failures = [];
let pages = 0;

for await (const path of walk(DIST)) {
  const page = path.replace(DIST, '') || '/';
  const html = await readFile(path, 'utf8');
  pages += 1;

  const title = pick(html, /<title>([^<]*)<\/title>/);
  const description = pick(html, /<meta name="description" content="([^"]*)"/);
  const canonical = pick(html, /<link rel="canonical" href="([^"]*)"/);
  const ogImage = pick(html, /<meta property="og:image" content="([^"]*)"/);
  const ogTitle = pick(html, /<meta property="og:title" content="([^"]*)"/);

  if (!title?.trim()) failures.push(`${page} 沒有 title`);
  if (!description?.trim()) failures.push(`${page} 沒有 description`);
  if (!ogTitle?.trim()) failures.push(`${page} 沒有 og:title`);

  if (!canonical) {
    failures.push(`${page} 沒有 canonical`);
  } else if (!canonical.startsWith(ORIGIN)) {
    failures.push(`${page} canonical 不是本站絕對網址：${canonical}`);
  }

  if (!ogImage) {
    failures.push(`${page} 沒有 og:image`);
    continue;
  }

  const url = new URL(ogImage);

  if (/\.webp$/i.test(url.pathname)) {
    failures.push(`${page} og:image 是 WebP，LINE 抓不到：${ogImage}`);
  }

  if (!url.search) {
    failures.push(`${page} og:image 少了版本號（?v=N），換圖之後 LINE 會一直用舊快取`);
  }

  try {
    await access(join(DIST, url.pathname));
  } catch {
    failures.push(`${page} og:image 檔案不存在：${url.pathname}（跑 npm run og:build）`);
  }
}

if (failures.length) {
  console.error(`metadata 檢查失敗 ${failures.length} 項：`);
  failures.forEach((f) => console.error(`  ✗ ${f}`));
  process.exit(1);
}

console.log(`metadata 檢查通過：${pages} 頁，OG 圖都在、格式對、有版本號。`);
