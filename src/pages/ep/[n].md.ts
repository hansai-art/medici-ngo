import type { APIRoute, GetStaticPaths } from 'astro';
import { getEpisodes } from '../../lib/episodes';
import { SITE, LICENSE } from '../../lib/site';

/**
 * 每一集的純 markdown 版本。
 *
 * 為什麼要有這個：AI 引擎抓 HTML 要先剝掉版面才拿得到內容，
 * 直接給一份乾淨的 markdown，被正確引用的機率高很多。
 * 這也讓創作者可以一鍵把整集配方帶走。
 *
 * Content-Type 必須是 text/markdown; charset=utf-8。
 * 如果回成 text/html，多半是路由沒生出來、被 404 頁面接走了。
 */

export const prerender = true;

export const getStaticPaths = (async () => {
  const episodes = await getEpisodes();
  return episodes.map((ep) => ({
    params: { n: String(ep.data.episode) },
    props: { ep },
  }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => {
  const ep = props.ep as Awaited<ReturnType<typeof getEpisodes>>[number];
  const d = ep.data;
  const url = new URL(`/ep/${d.episode}`, SITE.url).href;

  const lines: string[] = [];

  lines.push(`# ${SITE.name} 第 ${d.episode} 集：${d.title}`);
  lines.push('');
  lines.push(`> ${d.hook}`);
  lines.push('');
  lines.push(`- 網址：${url}`);
  lines.push(`- 出品：${SITE.publisher}`);
  lines.push(`- 創作者：${d.creator.name}`);
  lines.push(`- 鏡數：${d.shots.length} 鏡，每集 60 秒內`);
  lines.push(`- 使用公式：${d.formulas.join('、')}`);
  if (d.tools.length) {
    lines.push(
      `- 使用工具：${d.tools.map((t) => `${t.name} ${t.version}`).join('、')}`,
    );
  }
  if (d.youtube.videoId) {
    lines.push(`- 影片：https://www.youtube.com/watch?v=${d.youtube.videoId}`);
  } else {
    lines.push('- 影片：製作中。劇本與提示詞已先行公開。');
  }
  lines.push('');
  lines.push(
    `授權：劇本與提示詞採 ${LICENSE.content.name}（${LICENSE.content.summary}）。${LICENSE.video}。`,
  );
  lines.push('');

  lines.push('## 角色錨句');
  lines.push('');
  lines.push('每一鏡的提示詞前面都要加上這一段，人物長相才會一致。');
  lines.push('');
  lines.push('```text');
  lines.push(d.anchorPrompt);
  lines.push('```');
  lines.push('');

  lines.push('## 分鏡劇本與提示詞');
  lines.push('');
  for (const shot of d.shots) {
    const n = String(shot.n).padStart(2, '0');
    lines.push(`### 鏡 ${n}${shot.beat ? `（${shot.beat}）` : ''}`);
    lines.push('');
    for (const line of shot.script.split('\n')) {
      lines.push(line);
      lines.push('');
    }
    lines.push('提示詞：');
    lines.push('');
    lines.push('```text');
    lines.push(shot.prompt);
    lines.push('```');
    lines.push('');
  }

  lines.push('## 接點卡');
  lines.push('');
  d.handoffCard.musts.forEach((m, i) => {
    lines.push(`- 必守 ${i + 1}：${m}`);
  });
  lines.push(`- 懸念：${d.handoffCard.cliffhanger}`);
  lines.push('');

  if (d.historyNotes.length) {
    lines.push('## 史實註');
    lines.push('');
    for (const h of d.historyNotes) {
      lines.push(`### ${h.claim}`);
      lines.push('');
      lines.push(`可信度：${h.level}`);
      lines.push('');
      lines.push(h.note);
      lines.push('');
      if (h.url) {
        lines.push(`來源：${h.url}`);
        lines.push('');
      }
    }
  }

  lines.push('## 主視覺');
  lines.push('');
  lines.push(d.posterCredit);
  lines.push('');

  return new Response(lines.join('\n'), {
    headers: {
      'content-type': 'text/markdown; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
};
