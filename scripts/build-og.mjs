/**
 * 產生 OG 分享圖（1200 × 630 JPG）。
 *
 * 跑法：npm run og:build（要先 build，並設好 NOTO_SRC）
 *
 * 為什麼是 JPG 不是 WebP：LINE 抓不到 WebP 的 OG 圖，分享出去會沒有縮圖。
 * 這條是 Hans 所有網站共用的鐵律，NEVER 為了檔案小就換格式。
 *
 * 資料來源 = build 產物自己的 <meta>。每一頁的 og:image 與 og:title 都已經
 * 寫在 HTML 裡，這支程式照著產圖，所以之後新增集數不用改這支程式：
 * 新頁面自帶 meta，跑一次就有圖。
 *
 * 換圖內容 MUST 同時把頁面的 og:image 版本號往上加（?v=2），
 * 不然 LINE 會一直拿舊快取，你會以為沒生效。
 */

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';

const ROOT = new URL('..', import.meta.url).pathname;
const DIST = join(ROOT, 'dist');
const OUT = join(ROOT, 'public', 'og');

/** 背景畫作。用已經進版控的那張，不依賴 _prototypes（那裡不進 git） */
const BACKDROP = join(ROOT, 'src', 'assets', 'stills', 'ep-01-angel.jpg');

/** 完整字型（不是子集）。子集只含頁面 body 用到的字，分享圖的標題會缺字 */
const NOTO_SRC = process.env.NOTO_SRC || join(ROOT, '_fonts');
const FONT_REGULAR = join(NOTO_SRC, 'NotoSerifTC-Regular.otf');
const FONT_BOLD = join(NOTO_SRC, 'NotoSerifTC-Bold.otf');

if (!existsSync(FONT_REGULAR) || !existsSync(FONT_BOLD)) {
  console.error(
    `找不到完整字型。把 NotoSerifTC-Regular.otf 與 NotoSerifTC-Bold.otf 放進 ${NOTO_SRC}，\n` +
      '或設 NOTO_SRC 指到它們所在的資料夾。取得方式見 docs/OPERATIONS.md。',
  );
  process.exit(1);
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (extname(entry.name) === '.html') yield path;
  }
}

const meta = (html, prop) =>
  html.match(new RegExp(`<meta property="${prop}" content="([^"]*)"`))?.[1] ?? null;

/** 收集每一張要產的圖：og:image 檔名 → 標題與副標 */
const jobs = new Map();

for await (const path of walk(DIST)) {
  const html = await readFile(path, 'utf8');

  // noindex 的頁面不參與：它們沒填自己的 og:image，會沿用 default.jpg，
  // 結果就是內部儀表板的標題跑到全站預設分享圖上。
  if (/<meta name="robots" content="noindex/.test(html)) continue;

  const image = meta(html, 'og:image');
  if (!image) continue;

  const file = basename(new URL(image).pathname);
  if (jobs.has(file)) continue;

  // og:title 是「頁名｜站名」，分享圖只放頁名，站名另外用小字放
  const title = (meta(html, 'og:title') ?? '').split('｜')[0].trim();
  const description = meta(html, 'og:description') ?? '';

  jobs.set(file, { title, description, source: path.replace(DIST, '') });
}

// default.jpg 是 BaseHead 的後備值，內容寫死不跟著任何一頁跑。
// 用 set 直接覆蓋，不要用 if (!has)：漏填 og:image 的頁面會沿用它，
// 那時候 default 已經被那一頁的標題污染了。
jobs.set('default.jpg', {
  title: '動畫接龍',
  description: '每集 60 秒，劇本與提示詞全部公開，下一集誰接沒人知道',
  source: '(全站預設)',
});

/**
 * 先把畫裁到「兩張臉」的範圍再嵌進去，不要丟整張圖給 CSS 用 cover 硬塞。
 * 原圖 1040 × 784，臉大約在 x 430 到 930、y 60 到 460。
 * 用 CSS 調 background-position 猜位置調了幾輪都會歪：
 * 百分比定位的基準是「容器減圖片」，圖片比容器窄的時候方向是反的。
 * 裁圖是確定的，看得到結果。
 */
const [backdropRaw, regular, bold] = await Promise.all([
  readFile(BACKDROP),
  readFile(FONT_REGULAR),
  readFile(FONT_BOLD),
]);

const ART_W = 620;
const ART_H = 630;

const backdrop = await sharp(backdropRaw)
  .extract({ left: 380, top: 30, width: 620, height: 630 })
  .resize(ART_W, ART_H, { fit: 'cover' })
  .jpeg({ quality: 90 })
  .toBuffer();

const dataUri = (buf, mime) => `data:${mime};base64,${buf.toString('base64')}`;

const template = ({ title, description }) => `<!doctype html>
<meta charset="utf-8">
<style>
  @font-face {
    font-family: 'Noto Serif TC';
    src: url('${dataUri(regular, 'font/otf')}') format('opentype');
    font-weight: 400;
  }
  @font-face {
    font-family: 'Noto Serif TC';
    src: url('${dataUri(bold, 'font/otf')}') format('opentype');
    font-weight: 700;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: 1200px; height: 630px; overflow: hidden;
    background: #0B0A0D;
    font-family: 'Noto Serif TC', serif;
    color: #F2EDE4;
    position: relative;
  }
  /* 畫只佔左邊 ${ART_W}px（已經裁好，直接貼），右邊留給字 */
  .art {
    position: absolute; left: 0; top: 0;
    width: ${ART_W}px; height: ${ART_H}px;
    background-image: url('${dataUri(backdrop, 'image/jpeg')}');
    background-size: cover;
  }
  /* 畫的右緣淡入墨色，不要一刀切的直線邊 */
  .veil {
    position: absolute; inset: 0;
    background:
      linear-gradient(96deg,
        rgba(11,10,13,0.00) 0%,
        rgba(11,10,13,0.06) 24%,
        rgba(11,10,13,0.72) 40%,
        rgba(11,10,13,0.99) 52%,
        #0B0A0D 60%);
  }
  .body {
    position: absolute; inset: 0;
    display: flex; flex-direction: column; justify-content: center;
    padding: 72px 76px 72px 620px;
  }
  .kicker {
    font-size: 22px; letter-spacing: 0.34em; color: #C9A24B;
    margin-bottom: 26px; font-weight: 400;
  }
  h1 {
    font-size: ${title.length > 14 ? 58 : 70}px;
    font-weight: 700; line-height: 1.28; letter-spacing: 0.02em;
    text-wrap: balance;
  }
  p {
    margin-top: 26px; font-size: 25px; line-height: 1.72;
    color: #C6BCA9; max-width: 24em;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .rule { width: 92px; height: 2px; background: #B08E50; margin-top: 36px; }
  .foot {
    position: absolute; left: 620px; bottom: 54px;
    font-size: 21px; letter-spacing: 0.2em; color: #8E8375;
  }
</style>
<div class="art"></div>
<div class="veil"></div>
<div class="body">
  ${title === '動畫接龍' ? '' : '<div class="kicker">動畫接龍</div>'}
  <h1>${title.replace(/[<>&]/g, '')}</h1>
  <p>${description.replace(/[<>&]/g, '')}</p>
  <div class="rule"></div>
</div>
<div class="foot">medici.ngo　美第奇 AI 學院</div>
`;

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 } })).newPage();

for (const [file, job] of jobs) {
  await page.setContent(template(job), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ type: 'png' });

  // JPG 品質 84：1200×630 大約 120 到 180 KB，LINE 與 Facebook 都吃得下
  const jpg = await sharp(png).jpeg({ quality: 84, progressive: true }).toBuffer();
  await writeFile(join(OUT, file), jpg);

  console.log(`  ${file.padEnd(14)} ${(jpg.length / 1024).toFixed(0).padStart(4)} KB  ${job.title}`);
}

await browser.close();
console.log(`\n產出 ${jobs.size} 張 OG 圖 → public/og/`);
