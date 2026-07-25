/**
 * /api/vote — 站內投票。
 *
 *   GET  /api/vote?poll=ep-1-next        取得目前票數
 *   POST /api/vote {poll, option, sid}   投票（同一個 sid 改投會覆蓋）
 *
 * 為什麼站內要有投票：留言全部導去 YouTube 之後，站內就沒有互動資料了。
 * 投票補的是「觀眾想看什麼」這種創作決策資料，而且它的結果會直接交給接棒者，
 * 是這個計畫真的用得上的東西，不是為了衝停留時間的裝飾。
 *
 * 這不是選舉：換個分頁就能再投一次。一個 sid 一票只是防手滑重複點，
 * 我們要的是相對強弱，不是精確計數。刻意不做裝置指紋，那跟站的隱私立場衝突。
 *
 * 選項白名單：選項是每一集的內容，寫死在程式碼裡等於每加一集就要改這支檔案。
 * 改成只驗字元集與長度，亂送的選項會進資料庫但永遠不會被顯示，
 * 因為前端只畫頁面上定義的那幾個選項。真的被灌爆再靠 Rate Limiting rule。
 */

import { json, readJson, slug } from '../_shared';
import type { Env } from '../_shared';

interface Tally {
  option: string;
  count: number;
}

async function tally(env: Env, poll: string): Promise<Tally[]> {
  const { results } = await env.DB.prepare(
    `SELECT option, COUNT(*) AS count
       FROM votes
      WHERE poll = ?1
      GROUP BY option
      ORDER BY count DESC`,
  )
    .bind(poll)
    .all<Tally>();
  return results ?? [];
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);

  if (request.method === 'GET') {
    const poll = slug(url.searchParams.get('poll'), 64);
    if (!poll) return json({ error: 'bad poll' }, 400);
    try {
      return json({ poll, tally: await tally(env, poll) });
    } catch {
      // 資料庫掛掉時回空票數，前端會顯示「暫時看不到結果」而不是壞掉
      return json({ poll, tally: [], degraded: true });
    }
  }

  if (request.method !== 'POST') {
    return new Response(null, { status: 405, headers: { allow: 'GET, POST' } });
  }

  const body = await readJson(request);
  if (!body) return json({ error: 'bad body' }, 400);

  const poll = slug(body.poll, 64);
  const option = slug(body.option, 64);
  const sid = slug(body.sid, 64);
  if (!poll || !option || !sid) return json({ error: 'bad fields' }, 400);

  try {
    await env.DB.prepare(
      `INSERT INTO votes (poll, sid, option, ts)
       VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT (poll, sid) DO UPDATE SET option = excluded.option, ts = excluded.ts`,
    )
      .bind(poll, sid, option, Date.now())
      .run();

    return json({ poll, option, tally: await tally(env, poll) });
  } catch {
    return json({ error: 'store failed' }, 503);
  }
};
