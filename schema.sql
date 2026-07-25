-- 動畫接龍 D1 schema
--
-- 建表：
--   npx wrangler d1 create medici-ngo
--   npx wrangler d1 execute medici-ngo --remote --file=./schema.sql
-- 本機（會建在 .wrangler/state 底下，不進 git）：
--   npx wrangler d1 execute medici-ngo --local --file=./schema.sql
--
-- 隱私原則：不存 IP、不存 User-Agent、不存任何可以指認個人的欄位。
-- sid 是隨機值且放在 sessionStorage，關掉分頁就消失，所以不落 cookie，
-- 也就不需要 cookie 同意橫幅。

-- ── 秒級續看 ──────────────────────────────────────────────
-- 一個 session 在某一集的某一秒，只會有一列。
-- 主鍵帶 sec 是刻意的：使用者重看或往回拖不會灌出重複資料，
-- 一次觀看的列數因此被影片長度封頂（60 秒的片最多 60 列，實際約 20 列）。
--
-- kind：play = 播放中的心跳，exit = 離開頁面時補送的最後一發。
-- 「在第幾秒離開」就是靠 exit 這一發，它由 sendBeacon 送出，
-- 因為關分頁的瞬間一般的 fetch 會被瀏覽器取消。
-- kind 也在主鍵裡，否則同一秒的 exit 會被先到的 play 擋掉。
CREATE TABLE IF NOT EXISTS watch_beats (
  ep   INTEGER NOT NULL,
  sid  TEXT    NOT NULL,
  sec  INTEGER NOT NULL,
  kind TEXT    NOT NULL,
  dur  INTEGER NOT NULL DEFAULT 0,
  ts   INTEGER NOT NULL,
  PRIMARY KEY (ep, sid, sec, kind)
);

-- 續看曲線：每一集、每一秒有多少個不同 session 看到
CREATE INDEX IF NOT EXISTS idx_beats_curve ON watch_beats (ep, sec);
-- 離開點分佈
CREATE INDEX IF NOT EXISTS idx_beats_exit ON watch_beats (ep, kind, sec);
-- 清理舊資料用
CREATE INDEX IF NOT EXISTS idx_beats_ts ON watch_beats (ts);

-- ── 站內投票 ──────────────────────────────────────────────
-- 一個 session 對一個投票只算一票，改投就覆蓋（UPSERT）。
-- 這不是防作弊機制，只是防手滑重複點：換個分頁就能再投一次，
-- 我們要的是創作方向的相對強弱，不是選舉。
CREATE TABLE IF NOT EXISTS votes (
  poll   TEXT    NOT NULL,
  sid    TEXT    NOT NULL,
  option TEXT    NOT NULL,
  ts     INTEGER NOT NULL,
  PRIMARY KEY (poll, sid)
);

CREATE INDEX IF NOT EXISTS idx_votes_tally ON votes (poll, option);
