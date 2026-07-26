/**
 * _redirects 守門。
 *
 * 跑法：npm run check:redirects（build 之後，因為要看 dist 裡的產物）
 *
 * 只擋一種錯，但這種錯值得一支專門的檢查：
 * 來源欄寫完整網址（https://... 或 host/path），Cloudflare Pages 會整條忽略，
 * 而且不報錯、不警告、build 照樣綠。2026-07-26 就是這樣：
 * www 到主網域的 301 寫在這裡，看起來很合理，實際上一行都沒生效，
 * 線上 https://www.medici.ngo/ 回 200，兩個網域各自服務同一份內容。
 *
 * 這種「寫了等於沒寫」的規則靠 review 抓不到，因為檔案本身讀起來完全正常。
 * domain-level 的轉址要在 Cloudflare zone 的 Redirect Rules 做，不在這個檔案。
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const FILE = join(ROOT, 'dist', '_redirects');

let text;
try {
  text = await readFile(FILE, 'utf8');
} catch {
  console.log('_redirects 檢查跳過：dist/_redirects 不存在（沒有轉址規則）。');
  process.exit(0);
}

const failures = [];
let rules = 0;

text.split('\n').forEach((line, i) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return;

  rules += 1;
  const [from] = trimmed.split(/\s+/);

  if (/^https?:\/\//i.test(from)) {
    failures.push(
      `第 ${i + 1} 行：來源是完整網址（${from}）。` +
        `Pages 不支援 domain-level redirect，這條會被整個忽略而且不報錯。` +
        `跨網域的轉址要在 Cloudflare zone 的 Redirect Rules 設。`,
    );
    return;
  }

  if (!from.startsWith('/')) {
    failures.push(
      `第 ${i + 1} 行：來源沒有以 / 開頭（${from}）。` +
        `來源只能是路徑，帶主機名的寫法一樣會被忽略。`,
    );
  }
});

if (failures.length) {
  console.error(`_redirects 檢查失敗 ${failures.length} 項：`);
  failures.forEach((f) => console.error(`  ✗ ${f}`));
  process.exit(1);
}

console.log(`_redirects 檢查通過：${rules} 條規則，來源都是路徑。`);
