/**
 * 給檢查腳本用的 dist 靜態伺服器。
 *
 * 為什麼不用 `astro preview`：
 *
 * 原本兩支腳本都是 `spawn('npx', ['astro', 'preview'])`，跑完再 `proc.kill()`。
 * 在 macOS 上剛好能收工，在 GitHub Actions 上會**永遠掛住**：
 * `kill` 殺的是 npx，真正在跑的 `astro preview` 是它的孫程序，殺不到；
 * 孫程序繼承了同一組 stdio pipe，pipe 沒關 node 的 event loop 就不會結束，
 * 於是檢查全部印完之後 process 停在那裡不退，CI 只能等到 job timeout。
 * 這種掛法最難查：畫面上看起來是「檢查沒跑完」，實際上是「跑完了但不肯死」。
 *
 * 改成行程內的 http server 之後沒有子程序、沒有 npx、沒有 pipe，
 * `close()` 就真的關掉了。順便快很多。
 *
 * 路徑對應要跟 astro.config.mjs 對齊：`build.format: 'file'` +
 * `trailingSlash: 'never'`，所以 /ep/1 對到 dist/ep/1.html。
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/**
 * @param {string} root dist 的絕對路徑
 * @param {number} port
 * @returns {Promise<{ url: string, close: () => Promise<void> }>}
 */
export async function serveDist(root, port) {
  const server = createServer((req, res) => {
    void (async () => {
      // `..` 會跳出 dist。檢查腳本不會這樣打，但別人抄這支去別的地方用會。
      const raw = normalize(decodeURIComponent((req.url ?? '/').split('?')[0]));
      let path = join(root, raw);

      try {
        if ((await stat(path)).isDirectory()) path = join(path, 'index.html');
      } catch {
        // 不存在就往下走，交給下面補副檔名的邏輯
      }

      // build.format: 'file' 的產物是 ep/1.html，網址卻是 /ep/1
      if (!extname(path)) path += '.html';

      try {
        const body = await readFile(path);
        res.writeHead(200, {
          'content-type': MIME[extname(path)] ?? 'application/octet-stream',
        });
        res.end(body);
      } catch {
        // 404 是有意義的訊號：check-layout 會把它記成「資源不存在」
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('not found');
      }
    })();
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });

  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
