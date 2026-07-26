/**
 * 全站常數的唯一來源。品牌字串一律從這裡取，NEVER 在頁面裡手寫。
 *
 * 品牌字串經 Hans 於 2026-07-25 裁決確認：
 * 站名主體 = 動畫接龍，出品方 = 美第奇 AI 學院。
 * 「美第奇劇組」是內部說法，NEVER 對外使用。
 */

export const SITE = {
  url: 'https://medici.ngo',
  name: '動畫接龍',
  nameEn: 'Animation Relay',
  publisher: '美第奇 AI 學院',
  tagline: '每集 60 秒，劇本與提示詞全部公開，下一集誰接沒人知道',
  description:
    '動畫接龍是一場 AI 短劇接力：每位創作者做 60 秒的一集，交出完整劇本與提示詞，讓下一個人接下去。觀眾與作者都猜不到下一集。美第奇 AI 學院出品。',
  /**
   * 手機網址列與 PWA 標題列的底色。
   * MUST 等於 src/styles/tokens/primitive.css 的 --c-ink-900：
   * `<meta>` 吃不到 CSS 變數，只能在這裡把值再寫一次。
   * 兩邊漂掉的話手機上網址列會跟頁面差一階，肉眼很難注意到，
   * 所以 scripts/lint-design-tokens.sh 第 6 項會比對這兩個值。
   */
  themeColor: '#0B0A0D',
} as const;

/** 姊妹站。內鏈用，也寫進 JSON-LD 的 sameAs */
export const SISTER_SITES = {
  academy: 'https://medici.work',
  aiterms: 'https://aiterms.tw',
  techhanlin: 'https://www.techhanlin.tw',
  funCity: 'https://fun-city.tw',
} as const;

/**
 * 對外連結。留言與討論一律導到 YouTube：
 * 站內不做留言區是 2026-07-25 的裁決，互動集中在 YouTube 才餵得到演算法。
 */
export const EXTERNAL = {
  /** TODO(Hans): 共用 YouTube 頻道建好後填入。空字串時介面自動隱藏相關 CTA */
  youtubeChannel: '',
  /** TODO(Hans): 接棒申請 Google Form 建好後填入 */
  joinForm: '',
  /**
   * 網站與內容的正本。2026-07-26 先開在個人帳號底下，
   * 之後轉進 Organization 時 GitHub 會自動保留舊網址轉址，這裡再改成新網址即可。
   */
  repo: 'https://github.com/hansai-art/medici-ngo',
} as const;

/** 授權 */
export const LICENSE = {
  content: {
    name: 'CC BY 4.0',
    url: 'https://creativecommons.org/licenses/by/4.0/deed.zh-hant',
    summary: '署名即可自由使用、改作、商用',
  },
  code: {
    name: 'MIT',
    url: 'https://opensource.org/licenses/MIT',
  },
  video: '影片著作權屬創作者本人',
} as const;

/** 每集硬規則，顯示在接棒頁，也是內容 lint 的依據 */
export const RELAY_RULES = {
  maxDurationSec: 60,
  handoffMusts: 3,
  handoffCliffhangers: 1,
} as const;
