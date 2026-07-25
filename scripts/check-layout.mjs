/**
 * 版面守門：對 build 產物跑真實瀏覽器，擋掉三類看不見的破版。
 *
 * 跑法：npm run check:layout（會自己起 preview server，跑完關掉）
 *
 * 檢查項目與各自的來由：
 * 1. 橫向溢出 —— 手機上一旦出現就整頁能左右晃，是最常見也最難靠肉眼發現的破版。
 * 2. 左緣留白 —— 頁面自己的 CSS 寫 `padding-left: 0` 會蓋掉共用的 .pad，
 *    數字與文字會貼到螢幕邊。2026-07-25 在 /join 與 /fork 真的踩過。
 * 3. JS 錯誤與 404 —— 資源掉了或腳本炸了，畫面看起來還是「有東西」，只有 console 知道。
 *
 * 這是機器防線，NEVER 改成只印警告了事。要放行單一例外請加進 ALLOW，寫明原因。
 */

import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const PAGES = ['/', '/ep/1', '/join', '/prompts', '/fork'];

/** 手機優先。破版幾乎都先在窄螢幕出現 */
const VIEWPORT = { width: 390, height: 844 };

/** 與 --gutter 一致。頁面內容的左緣不得小於這個值 */
const GUTTER = 20;

/**
 * 允許貼齊或超出邊界的元素。每一條都要有原因。
 * - skip-link：無障礙跳過連結，設計上就藏在畫面外，聚焦時才進來
 * - full-bleed：刻意做滿版的 hero 與橫向捲動列
 */
const ALLOW = ['skip-link', 'bleed', 'rail', 'hero-media', 'poster-full'];

/** 已知還沒補的資源，補上之後要從這裡刪掉 */
const KNOWN_MISSING = [
  '/fonts/noto-serif-tc-subset.woff2', // TODO: Phase 4 自架字體子集
];

function startPreview() {
  const proc = spawn('npx', ['astro', 'preview', '--port', '4399'], {
    cwd: new URL('..', import.meta.url).pathname,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('preview server 起不來')), 30_000);
    proc.stdout.on('data', (buf) => {
      if (String(buf).includes('4399')) {
        clearTimeout(timer);
        resolve(proc);
      }
    });
    proc.on('error', reject);
  });
}

const server = await startPreview();
const browser = await chromium.launch();
const failures = [];

try {
  for (const path of PAGES) {
    const ctx = await browser.newContext({ viewport: VIEWPORT, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    const errors = [];
    const missing = [];

    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('response', (r) => {
      if (r.status() >= 400) missing.push(new URL(r.url()).pathname);
    });

    const res = await page.goto(`http://localhost:4399${path}`, { waitUntil: 'networkidle' });
    if (res?.status() !== 200) failures.push(`${path} HTTP ${res?.status()}`);

    const report = await page.evaluate(
      ({ gutter, allow }) => {
        const skip = (el) =>
          allow.some((cls) => el.closest(`.${cls}`) || el.classList.contains(cls));
        const overflow = [];
        const flush = [];

        document.querySelectorAll('body *').forEach((el) => {
          if (skip(el)) return;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return;
          if (r.right > window.innerWidth + 1) {
            overflow.push(`${el.tagName.toLowerCase()}.${el.className || '(no class)'}`);
          }
          // 偽元素（序號、標記）Range 量不到，但它畫在元素的框裡，
          // 所以框本身貼齊邊界就等於序號貼齊邊界。序號被 padding-left: 0 推到螢幕邊
          // 正是 2026-07-25 那個坑，只量文字節點會漏掉。
          for (const which of ['::before', '::after']) {
            const cs = getComputedStyle(el, which);
            const c = cs.content;
            const hasInk = c && !['none', 'normal', '""', "''"].includes(c);
            if (hasInk && r.left < gutter - 0.5) {
              flush.push(
                `${el.tagName.toLowerCase()}.${el.className || '(no class)'}${which} boxLeft=${Math.round(r.left)} content=${c}`,
              );
            }
          }

          // 量文字本身的位置，不是元素的邊框位置：
          // .pad 這種元素邊框就在 x=0，但內距把文字推到 20px，量錯地方會全是假警報。
          // 用 Range 框住第一個文字節點，拿到的才是墨水真正的左緣。
          const textNode = [...el.childNodes].find(
            (n) => n.nodeType === 3 && n.textContent.trim(),
          );
          if (textNode) {
            const range = document.createRange();
            range.selectNodeContents(textNode);
            const tr = range.getBoundingClientRect();
            if (tr.width > 0 && tr.left < gutter - 0.5) {
              flush.push(
                `${el.tagName.toLowerCase()}.${el.className || '(no class)'} textLeft=${Math.round(tr.left)} "${el.textContent.trim().slice(0, 12)}"`,
              );
            }
          }
        });

        // pre 的內容原樣呈現，所以模板裡把表達式換行縮排寫，
        // 前面那串空白會變成畫面上的首行縮排。提示詞區塊踩過。
        const padded = [...document.querySelectorAll('pre')]
          .filter((el) => /^\s/.test(el.textContent ?? ''))
          .map((el) => el.id || el.className || 'pre');

        return {
          scrollW: document.documentElement.scrollWidth,
          clientW: document.documentElement.clientWidth,
          overflow: [...new Set(overflow)],
          flush: [...new Set(flush)],
          padded,
        };
      },
      { gutter: GUTTER, allow: ALLOW },
    );

    if (report.scrollW > report.clientW) {
      failures.push(`${path} 橫向溢出 ${report.scrollW} > ${report.clientW}`);
    }
    report.overflow.forEach((o) => failures.push(`${path} 元素超出右邊界：${o}`));
    report.flush.forEach((f) => failures.push(`${path} 文字貼齊左邊界（.pad 被蓋掉？）：${f}`));
    report.padded.forEach((p) =>
      failures.push(`${path} pre 內容以空白開頭（表達式要跟標籤寫同一行）：${p}`),
    );
    errors.forEach((e) => failures.push(`${path} JS 錯誤：${e}`));
    [...new Set(missing)]
      .filter((m) => !KNOWN_MISSING.includes(m))
      .forEach((m) => failures.push(`${path} 資源 404：${m}`));

    await ctx.close();
    console.log(`  ${failures.length ? '·' : '✓'} ${path}`);
  }
} finally {
  await browser.close();
  server.kill();
}

if (failures.length) {
  console.error(`\n版面檢查失敗 ${failures.length} 項：`);
  failures.forEach((f) => console.error(`  ✗ ${f}`));
  process.exit(1);
}

console.log(`\n版面檢查通過：${PAGES.length} 頁，0 溢出、0 貼邊、0 錯誤。`);
