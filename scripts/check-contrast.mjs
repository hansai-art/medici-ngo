/**
 * 對比守門：把「深色底配灰字」這個病變成 build 會擋的錯。
 *
 * 跑法：npm run check:contrast
 *
 * 為什麼需要這個：2026-07-26 Hans 指出「黑底加灰字看不清楚」。
 * 回頭量才發現 --text-faint 在 --bg-page 上只有 2.7 : 1，
 * 「美第奇 AI 學院 出品」「SEASON 1」這些字在實機上幾乎是隱形的。
 * 這件事肉眼很難判斷 —— 在 Mac 螢幕上調亮就看得到了，所以只能用算的。
 *
 * 門檻是 7 : 1（WCAG AAA 的內文標準），不是 4.5 : 1。
 * 理由：站上大量文字是 --fs-xs / --fs-sm 這種小字，
 * 而且中文筆畫比拉丁字母密，同樣對比度下更難讀。
 *
 * 這是機器防線，NEVER 改成只印警告了事。
 */

import { readFile } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import { join, extname, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;

const TOKEN_FILES = [
  join(ROOT, 'src/styles/tokens/primitive.css'),
  join(ROOT, 'src/styles/tokens/semantic.css'),
];

/** 掃這些目錄找「拿非文字用的 token 當字色」 */
const SRC_DIRS = ['src/pages', 'src/components', 'src/layouts', 'src/styles'];

/** 一般文字的門檻，以及量它的底色 */
const FLOOR = 7;
const DEFAULT_BG = '--bg-page';

/**
 * 例外。每一條都要寫清楚「為什麼量的是別的底色」或「為什麼門檻不同」。
 * 沒寫進這裡的 --text-* / --status-* 一律用 FLOOR 對 DEFAULT_BG 量。
 */
const EXCEPTIONS = {
  // 金色按鈕上的深色字。底色是按鈕不是頁面，門檻用 AA 的 4.5：
  // 這是按鈕標籤，字級大、字重粗，而且色塊本身已經提供了辨識。
  '--text-on-accent': { bg: '--action-bg', floor: 4.5 },
};

/** 這些 token 不是拿來當字色的，出現在 color: 裡就是抓錯 token */
const NOT_FOR_TEXT = /^--(border|scrim|chart-track|paper-rule|surface|action-ghost)/;

// ── 解析 token ─────────────────────────────────────────

const raw = new Map();
for (const file of TOKEN_FILES) {
  const css = await readFile(file, 'utf8');
  for (const m of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    raw.set(m[1], m[2].trim());
  }
}

/** 一路跟著 var() 追到真正的值。有環就報錯，不要無聲無息地爆堆疊 */
function resolve(name, seen = new Set()) {
  if (seen.has(name)) throw new Error(`token 循環參照：${[...seen, name].join(' → ')}`);
  const value = raw.get(name);
  if (value === undefined) return null;
  const ref = value.match(/^var\((--[a-z0-9-]+)\)$/i);
  return ref ? resolve(ref[1], new Set([...seen, name])) : value;
}

/** #RGB / #RRGGBB → [r, g, b]。其他寫法（rgba / 漸層）回 null */
function toRgb(value) {
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!hex) return null;
  const h = hex[1];
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

/** WCAG 相對亮度 */
function luminance([r, g, b]) {
  const lin = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// ── 檢查 1：每個文字 token 的對比 ───────────────────────

const failures = [];
const rows = [];

// --text-shadow-* 是陰影不是字色，排除掉。
// 用「開頭比對 + 明確排除」而不是「值看起來像顏色就檢查」：
// 後者會讓任何寫成 rgba() 的新字色靜靜地跳過檢查，等於這支腳本白寫。
const targets = [...raw.keys()].filter(
  (n) => /^--(text|status)-/.test(n) && !n.startsWith('--text-shadow-'),
);
if (targets.length === 0) failures.push('找不到任何 --text-* / --status-* token，解析壞了');

for (const name of targets.sort()) {
  const ex = EXCEPTIONS[name] ?? {};
  const bgName = ex.bg ?? DEFAULT_BG;
  const floor = ex.floor ?? FLOOR;

  const fg = toRgb(resolve(name) ?? '');
  const bg = toRgb(resolve(bgName) ?? '');

  if (!bg) {
    failures.push(`${bgName} 不是純色，量不出對比`);
    continue;
  }
  if (!fg) {
    // 半透明的字色一定量不準：實際對比取決於它壓在什麼東西上面。
    failures.push(`${name} = ${resolve(name)}　字色 NEVER 用 alpha 或漸層，改用實色 + text-shadow`);
    continue;
  }

  const r = ratio(fg, bg);
  rows.push({ name, value: resolve(name), bgName, r, floor });
  if (r < floor) {
    failures.push(
      `${name}（${resolve(name)}）在 ${bgName} 上只有 ${r.toFixed(1)} : 1，低於 ${floor} : 1`,
    );
  }
}

// ── 檢查 2：color: 有沒有拿線色 / 遮罩當字色 ─────────────

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (['.astro', '.css'].includes(extname(entry.name))) yield path;
  }
}

for (const dir of SRC_DIRS) {
  for await (const path of walk(join(ROOT, dir))) {
    const css = await readFile(path, 'utf8');
    css.split('\n').forEach((line, i) => {
      if (line.includes('lint-ok')) return;
      const m = line.match(/(?:^|[\s;{])color\s*:\s*var\((--[a-z0-9-]+)\)/i);
      if (m && NOT_FOR_TEXT.test(m[1])) {
        failures.push(
          `${relative(ROOT, path)}:${i + 1} 用 ${m[1]} 當字色。` +
            '這是線 / 遮罩用的 token，對比沒有保證，改用 --text-*',
        );
      }
    });
  }
}

// ── 結果 ───────────────────────────────────────────────

rows
  .sort((a, b) => a.r - b.r)
  .forEach(({ name, value, bgName, r, floor }) => {
    const mark = r < floor ? '✗' : '✓';
    const on = bgName === DEFAULT_BG ? '' : `（底 ${bgName}）`;
    console.log(`  ${mark} ${r.toFixed(1).padStart(5)} : 1  ${name} = ${value}${on}`);
  });

if (failures.length) {
  console.error(`\n對比檢查失敗 ${failures.length} 項：`);
  failures.forEach((f) => console.error(`  ✗ ${f}`));
  console.error('\n深色底不是把字調暗的許可證。要更低調就換字級與字重，不是換更暗的顏色。');
  process.exit(1);
}

console.log(`\n對比檢查通過：${rows.length} 個文字 token 全部達標（內文 ${FLOOR} : 1）。`);
