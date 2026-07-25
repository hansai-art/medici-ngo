/**
 * 從提示詞文字判讀鏡頭尺寸。
 *
 * 這裡刻意只做「文字裡真的寫了什麼」的比對，不做語意猜測。
 * 提示詞裡本來就會明寫 extreme close-up / macro / wide shot，
 * 所以這是讀取既有事實，不是替創作者發明分類。
 * 判讀不出來的一律歸到「未標註」，不硬塞。
 */

export type ShotSize = 'macro' | 'close' | 'medium' | 'wide' | 'unlabelled';

export const SHOT_SIZE_LABEL: Record<ShotSize, string> = {
  macro: '微距特寫',
  close: '特寫',
  medium: '中景',
  wide: '遠景與全景',
  unlabelled: '未標註',
};

/** 判讀順序有意義：先比對最specific的詞，避免 close-up 蓋掉 extreme close-up */
const RULES: Array<{ size: ShotSize; patterns: RegExp[] }> = [
  { size: 'macro', patterns: [/\bmacro\b/i, /extreme close-?up/i] },
  { size: 'close', patterns: [/\bclose-?up\b/i, /\bpush-?in\b/i] },
  {
    size: 'wide',
    patterns: [/\bwide shot\b/i, /\bcamera pulls back\b/i, /\bestablishing\b/i],
  },
  {
    size: 'medium',
    patterns: [/\bsteps forward\b/i, /\bbows\b/i, /\bhe raises\b/i, /\bcrowd\b/i],
  },
];

export function detectShotSize(prompt: string): ShotSize {
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(prompt))) return rule.size;
  }
  return 'unlabelled';
}

/** 顯示順序：由近到遠，未標註放最後 */
export const SHOT_SIZE_ORDER: ShotSize[] = [
  'macro',
  'close',
  'medium',
  'wide',
  'unlabelled',
];
