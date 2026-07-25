import type { APIRoute } from 'astro';
import { getEpisodes } from '../lib/episodes';
import { SITE } from '../lib/site';

/**
 * 自製 sitemap，allowlist 式。
 *
 * 刻意不用 @astrojs/sitemap：它會自動爬全站，把 /internal/ 這種
 * 不該公開的路徑也掃進去，而且它產生的 index 會蓋掉自製版。
 * 這裡只列我們明確要 Google 收錄的頁，多一個都不會有。
 */

export const prerender = true;

interface Entry {
  path: string;
  changefreq: 'daily' | 'weekly' | 'monthly';
  priority: string;
  lastmod?: string;
}

export const GET: APIRoute = async () => {
  const episodes = await getEpisodes();

  const entries: Entry[] = [
    { path: '/', changefreq: 'weekly', priority: '1.0' },
    { path: '/prompts', changefreq: 'weekly', priority: '0.9' },
    { path: '/join', changefreq: 'monthly', priority: '0.8' },
    { path: '/fork', changefreq: 'monthly', priority: '0.6' },
  ];

  for (const ep of episodes) {
    entries.push({
      path: `/ep/${ep.data.episode}`,
      changefreq: 'monthly',
      priority: '0.9',
      lastmod: (ep.data.publishedAt ?? undefined)?.toISOString().slice(0, 10),
    });
    // markdown 版一併列入：它是給 AI 引擎引用的正式資源，不是附屬檔
    entries.push({
      path: `/ep/${ep.data.episode}.md`,
      changefreq: 'monthly',
      priority: '0.5',
    });
  }

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map((e) =>
      [
        '  <url>',
        `    <loc>${new URL(e.path, SITE.url).href}</loc>`,
        e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : '',
        `    <changefreq>${e.changefreq}</changefreq>`,
        `    <priority>${e.priority}</priority>`,
        '  </url>',
      ]
        .filter(Boolean)
        .join('\n'),
    ),
    '</urlset>',
    '',
  ].join('\n');

  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
};
