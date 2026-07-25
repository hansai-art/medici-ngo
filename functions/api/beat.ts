/**
 * POST /api/beat — 秒級續看回報。
 *
 * 前端每 3 秒送一次目前秒數，離開頁面時用 sendBeacon 再補一發。
 * 這個端點是整個「看到第幾秒離開」的資料來源，GA4 內建的
 * 10/25/50/75% 對 60 秒的片來說只有四個點，粒度不夠。
 *
 * 設計上的三個硬要求：
 * 1. 永遠回 204，且永遠不拋錯。追蹤壞掉不能影響觀看。
 * 2. sendBeacon 不看回應，所以回應體沒有意義，也不要浪費 CPU 產生。
 * 3. 主鍵 (ep, sid, sec, kind) 讓重看與往回拖不會灌資料，
 *    一次觀看的列數被影片長度封頂。
 *
 * 容量：60 秒的片一次完整觀看約 20 次寫入。D1 免費額度每天 10 萬次寫入，
 * 約等於每天 5000 次完整觀看。超過再升方案，或改成只寫 exit 那一發。
 *
 * 濫用防護：這裡只做輸入驗證與體積上限。真正的洪水攻擊要靠
 * Cloudflare 的 Rate Limiting rule（見 docs/OPERATIONS.md），程式碼擋不住。
 */

import { NO_CONTENT, readJson, int, slug, MAX_SEC, MAX_EPISODE } from '../_shared';
import type { Env } from '../_shared';

/**
 * 只匯出 onRequest 一個 handler，自己判斷方法。
 * 同時匯出 onRequest 與 onRequestPost 時哪一個優先，文件講得不清楚，
 * 賭錯的下場是 POST 被吃掉、追蹤靜靜地不寫入。這種 bug 沒人會發現。
 */
export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method !== 'POST') {
    return new Response(null, { status: 405, headers: { allow: 'POST' } });
  }

  const body = await readJson(request);
  if (!body) return NO_CONTENT;

  const ep = int(body.ep, 1, MAX_EPISODE);
  const sec = int(body.sec, 0, MAX_SEC);
  const dur = int(body.dur, 0, MAX_SEC) ?? 0;
  const sid = slug(body.sid, 64);
  const kind = body.kind === 'exit' ? 'exit' : 'play';

  // 少一個必要欄位就整筆丟掉。寧可少一筆資料，不要髒資料
  if (ep === null || sec === null || sid === null) return NO_CONTENT;

  try {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO watch_beats (ep, sid, sec, kind, dur, ts)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    )
      .bind(ep, sid, sec, kind, dur, Date.now())
      .run();
  } catch {
    // 資料庫壞掉也不能讓播放頁看到錯誤
  }

  return NO_CONTENT;
};
