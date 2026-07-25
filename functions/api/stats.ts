/**
 * GET /api/stats — 內部儀表板的資料來源。
 *
 * 主站是純靜態的，儀表板沒辦法在 build 時就知道數字，
 * 所以做成靜態外殼 + 這支端點即時取數。
 *
 * ⚠️ 這支端點目前只靠 robots.txt 擋爬蟲，那不是存取控制。
 * 上線前 MUST 在 Cloudflare 用 Access 保護 /internal/* 與 /api/stats
 * （步驟見 docs/OPERATIONS.md）。在那之前，這裡的數字任何人都拿得到，
 * 雖然不含個資，但是是我們的營運資料。
 *
 * 查詢設計：全部用 GROUP BY 讓 D1 算完再回，不把明細撈到 Worker 裡算。
 * 每天的讀取量遠低於免費額度的 500 萬列。
 */

import { json } from '../_shared';
import type { Env } from '../_shared';

interface CurvePoint {
  ep: number;
  sec: number;
  viewers: number;
}

interface ExitPoint {
  ep: number;
  sec: number;
  exits: number;
}

interface EpisodeSummary {
  ep: number;
  sessions: number;
  /** 看到最後一秒的 session 佔比，0 到 1 */
  completion: number;
  /** 平均看了幾秒 */
  avgSec: number;
  duration: number;
}

interface VoteRow {
  poll: string;
  option: string;
  count: number;
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.method !== 'GET') {
    return new Response(null, { status: 405, headers: { allow: 'GET' } });
  }

  try {
    // 續看曲線：某一集的第 N 秒，有幾個不同 session 到過
    const curve = await env.DB.prepare(
      `SELECT ep, sec, COUNT(DISTINCT sid) AS viewers
         FROM watch_beats
        GROUP BY ep, sec
        ORDER BY ep, sec`,
    ).all<CurvePoint>();

    // 離開點：exit 那一發送的秒數就是「關掉的瞬間在第幾秒」
    const exits = await env.DB.prepare(
      `SELECT ep, sec, COUNT(*) AS exits
         FROM watch_beats
        WHERE kind = 'exit'
        GROUP BY ep, sec
        ORDER BY ep, sec`,
    ).all<ExitPoint>();

    // 每集摘要。以每個 session 看到的最大秒數為準
    const summary = await env.DB.prepare(
      `WITH per_session AS (
         SELECT ep, sid, MAX(sec) AS max_sec, MAX(dur) AS dur
           FROM watch_beats
          GROUP BY ep, sid
       )
       SELECT ep,
              COUNT(*) AS sessions,
              AVG(max_sec) AS avgSec,
              MAX(dur) AS duration,
              AVG(CASE WHEN dur > 0 AND max_sec >= dur - 2 THEN 1.0 ELSE 0.0 END) AS completion
         FROM per_session
        GROUP BY ep
        ORDER BY ep`,
    ).all<EpisodeSummary>();

    const votes = await env.DB.prepare(
      `SELECT poll, option, COUNT(*) AS count
         FROM votes
        GROUP BY poll, option
        ORDER BY poll, count DESC`,
    ).all<VoteRow>();

    return json({
      generatedAt: new Date().toISOString(),
      summary: summary.results ?? [],
      curve: curve.results ?? [],
      exits: exits.results ?? [],
      votes: votes.results ?? [],
    });
  } catch (err) {
    // 儀表板壞掉要看得出來，這裡跟追蹤端點不同，錯誤要講出來
    return json({ error: String(err) }, 500);
  }
};
