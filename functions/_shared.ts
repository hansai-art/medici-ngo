/**
 * Pages Functions 共用工具。
 *
 * 主站是純靜態的，只有這幾個端點會動。它們全部面向公開網路，
 * 所以每一個輸入都當成敵意輸入處理：型別、範圍、字元集三道都要過，
 * 過不了就安靜丟掉，NEVER 讓沒驗過的值進 SQL。
 */

export interface Env {
  DB: D1Database;
}

/** 追蹤端點失敗絕不能影響觀看，一律回無內容 */
export const NO_CONTENT = new Response(null, { status: 204 });

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // 統計數字即時性不重要，但也不該被 CDN 長期快取住
      'cache-control': 'no-store',
    },
  });
}

/** 請求體上限。正常請求不到 300 bytes，超過就是有人在玩 */
const MAX_BODY = 2048;

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  const len = Number(request.headers.get('content-length') ?? 0);
  if (len > MAX_BODY) return null;

  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** 整數且落在範圍內，否則 null。字串數字也接受（sendBeacon 送的是 JSON，但不賭） */
export function int(value: unknown, min: number, max: number): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return i >= min && i <= max ? i : null;
}

/**
 * 識別字串（session id、投票代號）。
 * 限定字元集是為了讓它永遠不可能長成 SQL 或 HTML 的一部分，
 * 即使下游忘了跳脫也不會出事。
 */
export function slug(value: unknown, maxLen: number): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  if (!s || s.length > maxLen) return null;
  return /^[A-Za-z0-9_-]+$/.test(s) ? s : null;
}

/** 一個 session 對同一集在短時間內能寫幾列的上限，見 beat.ts 說明 */
export const MAX_SEC = 3600;
export const MAX_EPISODE = 999;
