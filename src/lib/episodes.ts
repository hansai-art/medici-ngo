import { getCollection, type CollectionEntry } from 'astro:content';

export type Episode = CollectionEntry<'episodes'>;

/**
 * 取得所有集數，依集號排序。
 *
 * 頁面顯示的集數一律用這裡回傳陣列的 .length，
 * NEVER 在頁面寫死「已完成 3 集」這種數字。
 */
export async function getEpisodes(): Promise<Episode[]> {
  const all = await getCollection('episodes');
  return all
    .filter((e) => e.data.status !== 'draft')
    .sort((a, b) => a.data.episode - b.data.episode);
}

/** 最新一集（首頁 hero 用） */
export async function getLatestEpisode(): Promise<Episode | undefined> {
  const eps = await getEpisodes();
  return eps.at(-1);
}

/** 上一集 / 下一集導航 */
export async function getNeighbours(episode: number) {
  const eps = await getEpisodes();
  const i = eps.findIndex((e) => e.data.episode === episode);
  return {
    prev: i > 0 ? eps[i - 1] : undefined,
    next: i >= 0 && i < eps.length - 1 ? eps[i + 1] : undefined,
  };
}

/** 下一個開放接棒的集號 */
export async function getOpenSlotNumber(): Promise<number> {
  const eps = await getEpisodes();
  return (eps.at(-1)?.data.episode ?? 0) + 1;
}

/** 全站提示詞總數。/prompts 頁與首頁數字用，永遠對齊資料源 */
export async function countPrompts(): Promise<number> {
  const eps = await getEpisodes();
  return eps.reduce((sum, e) => sum + e.data.shots.length, 0);
}

/** 影片是否已就位。未就位時集數頁顯示製作中卡片 */
export function hasVideo(ep: Episode): boolean {
  return Boolean(ep.data.youtube.videoId);
}

/** 集號轉成兩位數字串，給檔名與顯示用 */
export function pad(n: number): string {
  return String(n).padStart(2, '0');
}
