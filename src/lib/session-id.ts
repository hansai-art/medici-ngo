/**
 * 匿名 session id。續看追蹤與投票共用同一個值。
 *
 * 放 sessionStorage 不是 localStorage：關掉分頁就消失，
 * 所以它不是「使用者識別碼」，只是「這一次瀏覽」的識別碼。
 * 不落 cookie、不做裝置指紋，因此不需要 cookie 同意橫幅。
 *
 * 字元集限定在 [A-Za-z0-9_-]，跟 functions/_shared.ts 的 slug() 驗證對齊：
 * 兩邊不一致的話伺服器會把合法的 id 當垃圾丟掉，而且不會有人發現。
 */

const KEY = 'medici:sid';

export function sessionId(): string {
  try {
    const existing = sessionStorage.getItem(KEY);
    if (existing) return existing;

    const fresh =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID().replace(/-/g, '')
        : Date.now().toString(36) + Math.random().toString(36).slice(2);

    sessionStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    // 無痕模式或封鎖儲存時，退回一次性 id：資料仍可用，只是無法跨頁串接
    return 'anon' + Math.random().toString(36).slice(2);
  }
}
