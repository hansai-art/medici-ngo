import type { APIRoute } from 'astro';
import { SITE } from '../lib/site';

/**
 * 政策：全面開放 AI 爬蟲。
 *
 * 這個站的整個定位就是「公開配方讓人拿去用」，擋 AI 爬蟲跟定位直接矛盾。
 * 被 AI 引擎引用本來就是我們要的曝光。
 *
 * 只擋兩種路徑：內部儀表板，以及追蹤用的 API（爬它沒有意義，只會製造雜訊資料）。
 *
 * 注意：named user-agent group 不會繼承 * 的規則。
 * 未來若要對個別爬蟲加規則，那個 group 必須自帶完整的 Disallow 清單。
 */

export const prerender = true;

export const GET: APIRoute = () => {
  const body = `# ${SITE.name}（${SITE.publisher} 出品）
# 本站全面開放 AI 爬蟲。劇本與提示詞採 CC BY 4.0，歡迎引用與再利用。

User-agent: *
Allow: /
Disallow: /internal/
Disallow: /api/

Sitemap: ${new URL('/sitemap.xml', SITE.url).href}
`;

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=86400',
    },
  });
};
