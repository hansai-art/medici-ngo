/**
 * 秒級續看追蹤。
 *
 * 為什麼要自己做：GA4 內建的影片追蹤只在 10/25/50/75% 觸發，
 * 60 秒的短片等於只有第 6、15、30、45 秒四個資料點，
 * 看不出「大家到底在第幾秒關掉」。這個站的每一集都在 60 秒內，
 * 粒度不夠就等於沒有資料。
 *
 * 做法：播放中每 3 秒回報一次目前秒數，離開頁面時用 sendBeacon 補送最後位置。
 * 補送那一發才是重點：使用者關分頁的瞬間，一般的 fetch 會被瀏覽器取消，
 * 只有 sendBeacon 保證送得出去。
 *
 * 隱私：不存 IP、不存精確 UA。session id 是隨機值且放在 sessionStorage，
 * 關掉分頁就消失，不落 cookie，因此不需要 cookie 同意橫幅。
 */

/**
 * YouTube IFrame Player API 的最小型別。
 * 刻意不裝 @types/youtube：我們只用到四個成員，
 * 為了四個成員拉一整包型別定義不划算，也多一個要跟著升版的相依。
 */
export interface YtPlayer {
  getCurrentTime?: () => number;
  getDuration?: () => number;
  addEventListener: (event: string, listener: (e: YtStateEvent) => void) => void;
}

/** data: -1 未開始 / 0 結束 / 1 播放中 / 2 暫停 / 3 緩衝 / 5 已插入 */
export interface YtStateEvent {
  data: number;
}

import { sessionId } from './session-id';

const BEAT_INTERVAL_MS = 3000;
const ENDPOINT = '/api/beat';
const PROGRESS_KEY = 'medici:progress';

export interface WatchContext {
  episode: number;
  title: string;
  videoId: string;
}

type Beat = {
  ep: number;
  sid: string;
  sec: number;
  dur: number;
  /** play = 定期心跳，exit = 離開頁面時的最後一發 */
  kind: 'play' | 'exit';
};

function send(beat: Beat, useBeacon: boolean): void {
  const body = JSON.stringify(beat);
  if (useBeacon && navigator.sendBeacon) {
    navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
    return;
  }
  // keepalive 讓請求在頁面卸載後仍可完成
  void fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {
    /* 追蹤失敗不能影響觀看，安靜吞掉 */
  });
}

/** 記錄本機觀看進度，首頁的「繼續觀看」讀這個。不會送出去 */
function saveProgress(ctx: WatchContext, sec: number, duration: number): void {
  try {
    localStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({ ep: ctx.episode, title: ctx.title, sec, duration }),
    );
  } catch {
    /* 無痕模式可能寫不進去，不影響觀看 */
  }
}

/**
 * 綁定一個 YouTube IFrame Player。
 * 回傳解綁函式，方便未來做單頁切換時清理。
 */
export function trackPlayer(player: YtPlayer, ctx: WatchContext): () => void {
  const sid = sessionId();
  let timer: number | undefined;
  let lastSec = 0;
  let duration = 0;

  const readSec = (): number => {
    try {
      return Math.floor(player.getCurrentTime?.() ?? 0);
    } catch {
      return lastSec;
    }
  };

  const beat = (kind: Beat['kind']): void => {
    const sec = readSec();
    if (kind === 'play' && sec === lastSec) return; // 暫停中不重複送
    lastSec = sec;
    saveProgress(ctx, sec, duration);
    send({ ep: ctx.episode, sid, sec, dur: duration, kind }, kind === 'exit');
  };

  const start = (): void => {
    if (timer !== undefined) return;
    timer = window.setInterval(() => beat('play'), BEAT_INTERVAL_MS);
  };

  const stop = (): void => {
    if (timer === undefined) return;
    window.clearInterval(timer);
    timer = undefined;
  };

  const onStateChange = (event: YtStateEvent): void => {
    try {
      duration = Math.floor(player.getDuration?.() ?? 0);
    } catch {
      /* 還沒 ready */
    }
    if (event.data === 1) {
      // PLAYING
      beat('play');
      start();
    } else {
      stop();
      if (event.data === 0 || event.data === 2) beat('play'); // ENDED / PAUSED
    }
  };

  player.addEventListener('onStateChange', onStateChange);

  // 離開頁面：這一發決定我們看不看得到「在第幾秒離開」
  const onExit = (): void => {
    stop();
    beat('exit');
  };

  const onVisibility = (): void => {
    if (document.visibilityState === 'hidden') onExit();
  };

  window.addEventListener('pagehide', onExit);
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    stop();
    window.removeEventListener('pagehide', onExit);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
