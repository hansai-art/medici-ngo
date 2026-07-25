import { SITE, SISTER_SITES, LICENSE } from './site';
import type { Episode } from './episodes';

/**
 * JSON-LD 產生器。頁面不自己拼結構化資料，一律呼叫這裡，
 * 這樣改 schema 只要改一個地方。
 */

type Json = Record<string, unknown>;

const ORG_ID = `${SITE.url}/#organization`;
const SITE_ID = `${SITE.url}/#website`;

/** 出品方。每個頁面的 publisher 都指向這個 @id，不重複展開 */
export function buildOrganization(): Json {
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: SITE.publisher,
    url: SISTER_SITES.academy,
    sameAs: [SISTER_SITES.academy, SISTER_SITES.aiterms, SISTER_SITES.techhanlin],
  };
}

export function buildWebSite(): Json {
  return {
    '@type': 'WebSite',
    '@id': SITE_ID,
    url: SITE.url,
    name: SITE.name,
    alternateName: SITE.nameEn,
    description: SITE.description,
    inLanguage: 'zh-Hant-TW',
    publisher: { '@id': ORG_ID },
  };
}

/**
 * 影片。這是本站 SEO 最關鍵的一塊：
 * 有 VideoObject 才進得了 Google 影片搜尋並在結果頁帶縮圖。
 * 影片還沒好（videoId 為 null）時回傳 null，不輸出半殘的結構化資料。
 */
export function buildVideoObject(ep: Episode, canonical: string): Json | null {
  const { videoId, durationSec, publishedAt } = ep.data.youtube;
  if (!videoId) return null;

  const node: Json = {
    '@type': 'VideoObject',
    name: `${SITE.name} 第 ${ep.data.episode} 集：${ep.data.title}`,
    description: ep.data.hook,
    thumbnailUrl: [`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`],
    embedUrl: `https://www.youtube.com/embed/${videoId}`,
    contentUrl: `https://www.youtube.com/watch?v=${videoId}`,
    url: canonical,
    inLanguage: 'zh-Hant-TW',
    publisher: { '@id': ORG_ID },
    creator: { '@type': 'Person', name: ep.data.creator.name },
    isFamilyFriendly: true,
  };

  if (durationSec) node.duration = `PT${durationSec}S`;
  if (publishedAt) node.uploadDate = publishedAt.toISOString();

  return node;
}

/**
 * 每集本身是一件創作，且劇本與提示詞採 CC BY 授權。
 * license 欄位讓 AI 引擎知道這份內容可以合法引用與再利用，
 * 這正是「開源晶種」定位在結構化資料上的表述。
 */
export function buildCreativeWork(ep: Episode, canonical: string): Json {
  return {
    '@type': 'CreativeWork',
    '@id': `${canonical}#work`,
    name: `第 ${ep.data.episode} 集：${ep.data.title}`,
    headline: ep.data.title,
    description: ep.data.hook,
    url: canonical,
    inLanguage: 'zh-Hant-TW',
    license: LICENSE.content.url,
    creditText: `${ep.data.creator.name} / ${SITE.publisher}`,
    author: { '@type': 'Person', name: ep.data.creator.name },
    publisher: { '@id': ORG_ID },
    isPartOf: { '@id': SITE_ID },
    keywords: ep.data.formulas.join(', '),
    ...(ep.data.publishedAt ? { datePublished: ep.data.publishedAt.toISOString() } : {}),
  };
}

export function buildBreadcrumb(
  trail: Array<{ name: string; url: string }>,
): Json {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function buildFaqPage(qa: Array<{ q: string; a: string }>): Json {
  return {
    '@type': 'FAQPage',
    mainEntity: qa.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
}

/** 把多個節點包成一份 @graph，一頁只輸出一個 script 標籤 */
export function buildGraph(nodes: Array<Json | null>): string {
  return JSON.stringify(
    { '@context': 'https://schema.org', '@graph': nodes.filter(Boolean) },
    null,
    0,
  );
}
