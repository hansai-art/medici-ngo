/**
 * IndexNow：主動通知搜尋引擎有新內容。
 *
 * 跑法：npm run seo:indexnow（部署完成之後跑，不是 build 完就跑）
 *
 * 為什麼值得做：Bing 系（Bing、Yandex、Seznam、Naver）吃 IndexNow，
 * 通常幾分鐘到幾小時就收錄，比等爬蟲自己來快很多。Google 不吃 IndexNow，
 * 那邊靠 sitemap 加 Search Console。
 *
 * 金鑰不是密碼：IndexNow 的驗證方式就是「你能不能在自己網域放一個同名檔案」，
 * 所以 public/<key>.txt 本來就要被全世界看得到，進版控沒問題。
 *
 * NEVER 每次 build 都送：短時間重複送同一批網址會被降權處理。
 * 只在真的有內容變動（新增或改動集數）之後送。
 */

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const HOST = 'medici.ngo';
const ENDPOINT = 'https://api.indexnow.org/indexnow';

/** 從 public/ 找出金鑰檔，不寫死在程式碼裡，換金鑰只要換檔案 */
const keyFile = (await readdir(join(ROOT, 'public'))).find((f) => /^[a-f0-9]{32}\.txt$/.test(f));

if (!keyFile) {
  console.error('public/ 底下找不到 IndexNow 金鑰檔（32 碼十六進位 .txt）');
  process.exit(1);
}

const key = keyFile.replace('.txt', '');

/** 網址清單直接讀自己的 sitemap，不另外維護一份會走鐘的清單 */
const sitemap = await readFile(join(ROOT, 'dist', 'sitemap.xml'), 'utf8');
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

if (!urlList.length) {
  console.error('sitemap.xml 沒有任何網址，先跑 npm run build');
  process.exit(1);
}

const payload = {
  host: HOST,
  key,
  keyLocation: `https://${HOST}/${keyFile}`,
  urlList,
};

if (process.argv.includes('--dry-run')) {
  console.log(JSON.stringify(payload, null, 2));
  console.log(`\n(--dry-run，沒有實際送出。共 ${urlList.length} 個網址)`);
  process.exit(0);
}

const res = await fetch(ENDPOINT, {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify(payload),
});

// 200 = 收到，202 = 收到但金鑰還在驗證中，兩個都算成功
if (res.status === 200 || res.status === 202) {
  console.log(`IndexNow 已送出 ${urlList.length} 個網址（HTTP ${res.status}）`);
} else {
  console.error(`IndexNow 失敗 HTTP ${res.status}：${await res.text()}`);
  process.exit(1);
}
