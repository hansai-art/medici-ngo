/**
 * 版面守門：對 build 產物跑真實瀏覽器，擋掉四類看不見的破版。
 *
 * 跑法：npm run check:layout（會自己起靜態伺服器跑 dist，跑完關掉）
 *
 * 檢查項目與各自的來由：
 * 1. 橫向溢出 —— 手機上一旦出現就整頁能左右晃，是最常見也最難靠肉眼發現的破版。
 * 2. 左緣留白 —— 頁面自己的 CSS 寫 `padding-left: 0` 會蓋掉共用的 .pad，
 *    數字與文字會貼到螢幕邊。2026-07-25 在 /join 與 /fork 真的踩過。
 * 3. JS 錯誤與 404 —— 資源掉了或腳本炸了，畫面看起來還是「有東西」，只有 console 知道。
 * 4. 桌機空曠 —— 溢出的反面。2026-07-26 踩到：整站只有一條 max-width: 720px 的
 *    外殼，在 1440 以上的螢幕變成中間一條手機、兩側全黑。這個 bug 手機測不出來，
 *    也不會有任何錯誤訊息，只能量「內容到底佔了螢幕的幾成」。
 *
 * 這是機器防線，NEVER 改成只印警告了事。要放行單一例外請加進 ALLOW，寫明原因。
 */

import { chromium } from 'playwright';
import { serveDist } from './lib/static-server.mjs';

/**
 * desktopSpan = 這一頁的內容在桌機上至少要橫跨螢幕的幾成。
 * 門檻按頁面的意圖給，不是全站同一個數字：
 * 首頁是滿版 billboard，收窄就是壞掉；/join 這種規則文件刻意收成一欄置中，
 * 給它 90% 反而會逼出「把定義列拉長到 1320px」這種更糟的版面。
 * 意圖寫在這裡，改版面時就得回來改這個數字，那正是我們要的摩擦。
 */
const PAGES = [
  { path: '/', desktopSpan: 0.9 },        // Netflix billboard，海報吃滿整個視窗
  { path: '/ep/1', desktopSpan: 0.8 },    // 影片 + 著錄欄兩欄
  { path: '/join', desktopSpan: 0.5 },    // 文件頁，收成一欄置中
  { path: '/prompts', desktopSpan: 0.5 }, // 同上
  { path: '/fork', desktopSpan: 0.5 },    // 同上
];

/**
 * 兩個視窗都要跑。
 * 手機：破版幾乎都先在窄螢幕出現。
 * 桌機：1440 是設計時的桌機錨點（--fs-* 的 clamp 上界也在這裡）。
 */
const VIEWPORTS = [
  { name: '手機 390', viewport: { width: 390, height: 844 }, isMobile: true, desktop: false },
  { name: '桌機 1440', viewport: { width: 1440, height: 900 }, isMobile: false, desktop: true },
];

/** 與 --gutter 的下限一致。頁面內容的左緣不得小於這個值 */
const GUTTER = 20;

/**
 * 允許貼齊或超出邊界的元素。每一條都要有原因。
 * - skip-link：無障礙跳過連結，設計上就藏在畫面外，聚焦時才進來
 * - full-bleed：刻意做滿版的 hero 與橫向捲動列
 */
const ALLOW = ['skip-link', 'bleed', 'rail', 'hero-media', 'poster-full'];

/**
 * 已知還沒補的資源，補上之後要從這裡刪掉。
 * 空陣列是正確狀態：這裡每多一條，就等於少擋一個 404。
 */
const KNOWN_MISSING = [];

const server = await serveDist(new URL('../dist', import.meta.url).pathname, 4399);
const browser = await chromium.launch();
const failures = [];

try {
  // 攤平成一維，不要巢狀兩層 for：巢狀的 continue / break 很容易寫錯層
  const runs = VIEWPORTS.flatMap((vp) => PAGES.map((spec) => ({ vp, spec })));

  for (const { vp, spec } of runs) {
    const path = spec.path;
    const label = `${path}（${vp.name}）`;
    const ctx = await browser.newContext({
      viewport: vp.viewport,
      isMobile: vp.isMobile,
      hasTouch: vp.isMobile,
    });
    const page = await ctx.newPage();
    const errors = [];
    const missing = [];

    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('response', (r) => {
      if (r.status() >= 400) missing.push(new URL(r.url()).pathname);
    });

    const res = await page.goto(`${server.url}${path}`, { waitUntil: 'networkidle' });
    if (res?.status() !== 200) failures.push(`${label} HTTP ${res?.status()}`);

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

        // 內容橫跨了螢幕的幾成。
        // 量的是「墨水的左右極值」，不是某個容器的寬度：
        // 容器可以是 width: 100%，裡面的東西卻全擠在中間 720px，
        // 那才是 2026-07-26 那個病，量容器量不出來。
        let minLeft = Infinity;
        let maxRight = -Infinity;
        document.querySelectorAll('main *').forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.width < 2 || r.height < 2) return;
          if (getComputedStyle(el).visibility === 'hidden') return;
          minLeft = Math.min(minLeft, Math.max(0, r.left));
          maxRight = Math.max(maxRight, Math.min(window.innerWidth, r.right));
        });

        // main 自己的寬度必須等於視窗寬度。
        // 這是「桌機空曠」的根因檢查：2026-07-26 那個病是一層共用外殼
        // 寫死 max-width，整站每一頁一起被關進同一條窄欄。
        // 頁面內部自己收窄（.doc）是設計，外殼收窄是 bug，兩者要分開擋。
        const main = document.querySelector('main');
        const mainW = main ? main.getBoundingClientRect().width : 0;

        return {
          scrollW: document.documentElement.scrollWidth,
          clientW: document.documentElement.clientWidth,
          overflow: [...new Set(overflow)],
          flush: [...new Set(flush)],
          padded,
          span: maxRight > minLeft ? (maxRight - minLeft) / window.innerWidth : 0,
          mainRatio: mainW / window.innerWidth,
        };
      },
      { gutter: GUTTER, allow: ALLOW },
    );

    if (report.scrollW > report.clientW) {
      failures.push(`${label} 橫向溢出 ${report.scrollW} > ${report.clientW}`);
    }
    if (report.mainRatio < 0.99) {
      failures.push(
        `${label} main 只有視窗的 ${Math.round(report.mainRatio * 100)}%：` +
          '共用外殼被限寬了。要收窄請在頁面內用 .doc / .measure，NEVER 動外殼',
      );
    }
    if (vp.desktop && report.span < spec.desktopSpan) {
      failures.push(
        `${label} 內容只佔螢幕 ${Math.round(report.span * 100)}%（這一頁的下限 ${Math.round(spec.desktopSpan * 100)}%）：` +
          '桌機版被限寬成一條窄欄，兩側空白',
      );
    }
    report.overflow.forEach((o) => failures.push(`${label} 元素超出右邊界：${o}`));
    report.flush.forEach((f) => failures.push(`${label} 文字貼齊左邊界（.pad 被蓋掉？）：${f}`));
    report.padded.forEach((p) =>
      failures.push(`${label} pre 內容以空白開頭（表達式要跟標籤寫同一行）：${p}`),
    );
    errors.forEach((e) => failures.push(`${label} JS 錯誤：${e}`));
    [...new Set(missing)]
      .filter((m) => !KNOWN_MISSING.includes(m))
      .forEach((m) => failures.push(`${label} 資源 404：${m}`));

    await ctx.close();
    console.log(
      `  ${failures.length ? '·' : '✓'} ${label}　內容寬 ${Math.round(report.span * 100)}%`,
    );
  }
} finally {
  await browser.close();
  await server.close();
}

if (failures.length) {
  console.error(`\n版面檢查失敗 ${failures.length} 項：`);
  failures.forEach((f) => console.error(`  ✗ ${f}`));
  process.exit(1);
}

console.log(
  `\n版面檢查通過：${PAGES.length} 頁 × ${VIEWPORTS.length} 視窗，0 溢出、0 貼邊、0 空曠、0 錯誤。`,
);
