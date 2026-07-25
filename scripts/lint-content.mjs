/**
 * 內容守門：檢查 src/content/ 底下每一集的稿子。
 *
 * 跟 content.config.ts 的 zod schema 分工：
 *
 * - **zod 管一份稿子自己對不對**：欄位齊不齊、鏡號連不連號、接點卡是不是 3 必守
 *   1 懸念、60 秒鐵律、工具版本不准寫「最新」、史實必須附來源。
 *   那些規則已經在 schema 裡，這裡 NEVER 重複實作，重複的規則一定會兩邊漂掉。
 * - **這支管 zod 管不到的**：跨檔案的唯一性、檔名與集數對不對得起來、
 *   中文排版、提示詞語言、以及範本檔有沒有跟著 schema 一起更新。
 *
 * 跑法：npm run lint:content（`npm run lint` 與 `npm run verify` 都會跑）
 *
 * 這支在 CI 擋 merge。共編者交的是 markdown，不會有人記得這些規矩，
 * 靠審稿的人用眼睛看一定會漏。
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

const ROOT = new URL('..', import.meta.url).pathname;
const DIR = join(ROOT, 'src/content/episodes');

/** 檔名鐵律：ep-01.md、ep-02.md。零補到兩位數，排序才不會 ep-10 跑到 ep-2 前面 */
const FILENAME = /^ep-(\d{2})\.md$/;

/**
 * 中日韓字元。用來判斷「這句是中文」，兩個地方會用到：
 * 提示詞不准夾中文、中文句子裡不准用半形引號。
 */
const CJK = /[\p{Script=Han}　-〿＀-￯]/u;

/**
 * 絕對宣稱。出現這些字就必須在同一則註解裡附上可查證的連結，
 * 否則改成中性表述。這條是從 aiterms.tw 搬過來的（那邊是章節 S），
 * 理由一樣：講史的內容一旦有一句查不到出處，整篇的可信度都會被質疑。
 *
 * 用正規式而不是關鍵字比對，是因為「第一」這兩個字大部分時候是無辜的
 * （第一集、第一次、第一步）。只有排名意義的用法才算宣稱。
 */
const ABSOLUTE_CLAIMS = [
  /最強/,
  /唯一/,
  /保證/,
  /完全免費/,
  /業界領先/,
  /史上最/,
  /第一名/,
  /(世界|全球|全台|台灣|業界|史上)第一/,
];

/** 命中的話回傳那段字，沒命中回傳 null。錯誤訊息要指出是哪個詞觸發的 */
const findClaim = (text) => {
  for (const re of ABSOLUTE_CLAIMS) {
    const m = re.exec(text);
    if (m) return m[0];
  }
  return null;
};

/** 範本檔必須帶到的頂層欄位。schema 加了新必填欄位、範本沒跟上就會被擋下來 */
const TEMPLATE_KEYS = [
  'episode',
  'title',
  'hook',
  'status',
  'creator',
  'youtube',
  'tools',
  'formulas',
  'anchorPrompt',
  'shots',
  'handoffCard',
  'historyNotes',
  'poster',
  'posterCredit',
];

const failures = [];
const fail = (file, msg) => failures.push(`${file}：${msg}`);

/** 把 --- 之間的 frontmatter 切出來，順便記住它在檔案裡的行號位移 */
function splitFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return null;
  return { yaml: m[1], body: raw.slice(m[0].length), bodyLine: m[0].split('\n').length };
}

/** 走訪 shots / historyNotes 這種巢狀結構裡的每一個字串 */
function* walkStrings(value, path = []) {
  if (typeof value === 'string') {
    yield { value, path: path.join('.') };
  } else if (Array.isArray(value)) {
    for (const [i, v] of value.entries()) yield* walkStrings(v, [...path, i]);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) yield* walkStrings(v, [...path, k]);
  }
}

const files = (await readdir(DIR)).filter((f) => f.endsWith('.md')).sort();
const episodeFiles = files.filter((f) => !f.startsWith('_'));

if (episodeFiles.length === 0) {
  console.error('src/content/episodes/ 一集都沒有，這不對');
  process.exit(1);
}

const seenEpisode = new Map();
const seenTitle = new Map();

for (const file of files) {
  const raw = await readFile(join(DIR, file), 'utf8');
  const isTemplate = file.startsWith('_');

  // ---- 1. 全形破折號：全站禁用，一律改冒號 ----
  // 逐行報，共編者才知道要改哪裡。
  raw.split('\n').forEach((line, i) => {
    if (line.includes('—')) fail(file, `第 ${i + 1} 行有全形破折號，改用冒號`);
  });

  const fm = splitFrontmatter(raw);
  if (!fm) {
    fail(file, '沒有 frontmatter（檔案開頭必須是 ---）');
    continue;
  }

  // ---- 2. 範本只驗「有沒有跟上 schema」，不驗內容 ----
  if (isTemplate) {
    for (const key of TEMPLATE_KEYS) {
      // 範本裡欄位可能被註解掉示範，所以連註解行也算數
      if (!new RegExp(`^\\s*#?\\s*${key}\\s*:`, 'm').test(fm.yaml)) {
        fail(file, `範本缺少 ${key} 欄位。schema 改過就要同步改範本，不然共編者照抄會 build 失敗`);
      }
    }
    continue;
  }

  let data;
  try {
    data = parseYaml(fm.yaml);
  } catch (err) {
    fail(file, `frontmatter 不是合法 YAML：${err.message}`);
    continue;
  }

  // ---- 3. 檔名、集數、標題三者的一致性與唯一性 ----
  // zod 是一個檔一個檔驗的，看不到別的檔，這種跨檔問題只能在這裡抓。
  const nameMatch = FILENAME.exec(file);
  if (!nameMatch) {
    fail(file, '檔名必須是 ep-NN.md（兩位數，例如 ep-01.md）');
  } else if (Number(nameMatch[1]) !== data.episode) {
    fail(file, `檔名是第 ${Number(nameMatch[1])} 集，frontmatter 寫 episode: ${data.episode}`);
  }

  if (seenEpisode.has(data.episode)) {
    fail(file, `episode ${data.episode} 跟 ${seenEpisode.get(data.episode)} 撞號`);
  } else {
    seenEpisode.set(data.episode, file);
  }

  if (typeof data.title === 'string') {
    if (seenTitle.has(data.title)) {
      fail(file, `標題「${data.title}」跟 ${seenTitle.get(data.title)} 重複`);
    } else {
      seenTitle.set(data.title, file);
    }
  }

  // ---- 4. 提示詞必須是英文 ----
  // 提示詞是要貼進生成工具的，中文在多數影片模型上表現不穩，
  // 而且共編者換工具時英文才通用。這是 schema 註解裡寫了但驗不了的規則。
  const prompts = [
    ['anchorPrompt', data.anchorPrompt],
    ...(Array.isArray(data.shots)
      ? data.shots.map((s, i) => [`shots[${i}].prompt`, s?.prompt])
      : []),
  ];
  for (const [where, text] of prompts) {
    if (typeof text === 'string' && CJK.test(text)) {
      const hit = text.match(CJK)[0];
      fail(file, `${where} 夾了中文字「${hit}」。提示詞一律英文`);
    }
  }

  // ---- 5. 中文對白用「」，不用半形引號 ----
  for (const [i, shot] of (data.shots ?? []).entries()) {
    const script = shot?.script;
    if (typeof script === 'string' && CJK.test(script) && /["']/.test(script)) {
      fail(file, `shots[${i}].script 的中文對白用了半形引號，改用「」`);
    }
  }

  // ---- 6. 絕對宣稱必須附可查證連結 ----
  // 判斷方式：宣稱出現在哪個物件裡，那個物件就必須有 url 欄位。
  // historyNotes 的每一則本來就有 url 欄位，剛好對得上。
  const claimTargets = [
    ...(Array.isArray(data.historyNotes)
      ? data.historyNotes.map((h, i) => [`historyNotes[${i}]`, h, h?.url])
      : []),
    ['frontmatter', { title: data.title, hook: data.hook }, null],
  ];
  for (const [where, obj, url] of claimTargets) {
    for (const { value, path } of walkStrings(obj)) {
      if (path === 'url') continue;
      const hit = findClaim(value);
      if (hit && !url) {
        fail(
          file,
          `${where}${path ? `.${path}` : ''} 有絕對宣稱「${hit}」但沒有佐證連結。` +
            '補 url，或改成中性表述',
        );
      }
    }
  }

  // 正文（--- 之後）也要看。正文沒有 url 欄位可依附，
  // 所以規則是：同一段落裡必須自己帶連結。
  fm.body.split(/\n\s*\n/).forEach((para) => {
    const hit = findClaim(para);
    if (hit && !/https?:\/\//.test(para)) {
      fail(file, `正文有絕對宣稱「${hit}」但同段沒有連結。補來源，或改成中性表述`);
    }
  });
}

// ---- 7. PR 範本的終審五題必須跟規則正本一字不差 ----
// 正本是 src/lib/relay-engine.ts 的 FINAL_REVIEW，網站 /join 也是讀它。
// PR 範本要重抄一份，是因為那是創作者按下送出的那一刻唯一會看到的清單。
// 抄了就會漂，所以用機器釘住。
{
  const engine = await readFile(join(ROOT, 'src/lib/relay-engine.ts'), 'utf8');
  const block = engine.match(/FINAL_REVIEW = \[([\s\S]*?)\] as const/);
  if (!block) {
    fail('src/lib/relay-engine.ts', '找不到 FINAL_REVIEW，PR 範本的同步檢查失效了');
  } else {
    const items = [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    const template = await readFile(join(ROOT, '.github/pull_request_template.md'), 'utf8');
    for (const item of items) {
      // 範本的清單項省略句尾標點，比對時一起去掉
      const bare = item.replace(/[？。]$/, '');
      if (!template.includes(bare)) {
        fail('.github/pull_request_template.md', `終審五題少了「${item}」（正本在 relay-engine.ts）`);
      }
    }
    if (items.length !== 5) {
      fail('src/lib/relay-engine.ts', `FINAL_REVIEW 有 ${items.length} 題，不是五題。改了就要同步改 PR 範本與 /join`);
    }
  }
}

if (failures.length) {
  console.error(`內容檢查失敗 ${failures.length} 項：`);
  failures.forEach((f) => console.error(`  ✗ ${f}`));
  console.error('\n規則說明見 /join 與 src/content/episodes/_template.md');
  process.exit(1);
}

console.log(
  `內容檢查通過：${episodeFiles.length} 集 + ${files.length - episodeFiles.length} 份範本，` +
    '集數唯一、提示詞是英文、沒有全形破折號、絕對宣稱都有出處。',
);
