import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * 每一集 = 一個 markdown 檔，這是唯一資料來源。
 *
 * 核心設計：分鏡劇本與提示詞放在同一個 shots 陣列，一鏡一組。
 * 規格本來就要求「每鏡可直接對應一個 AI 影片生成 prompt」，
 * 合成一個陣列之後兩者永遠不可能不同步，
 * 「一鍵複製提示詞」與「劇本逐字比對」也共用同一份資料。
 *
 * 這個 schema 同時是共編者的投稿契約：缺必填欄位、鏡數不對、
 * 接點卡不是 3 必守 1 懸念，build 會直接失敗，PR 就進不來。
 */

const FORBIDDEN_VERSION_WORDS = ['最新', 'latest', '最強'];

const creator = z.object({
  name: z.string().min(1, '創作者名字必填'),
  bio: z.string().min(1, '一句話自介必填，NEVER 由 AI 代編'),
  avatar: z.string().optional(),
  links: z
    .array(z.object({ label: z.string(), url: z.string().url() }))
    .default([]),
});

const shot = z.object({
  n: z.number().int().positive(),
  /** 分鏡敘述與對白。對白用「」，旁白寫「旁白：」開頭 */
  script: z.string().min(1),
  /** 對應這一鏡的 AI 影片生成提示詞。英文，工具通用 */
  prompt: z.string().min(1),
  /** 這一鏡在短劇引擎裡扮演什麼（黃金三秒 / 反轉 / 鉤子）。可省略 */
  beat: z.string().optional(),
});

/**
 * 每集自己的投票。放進內容而不是寫死在頁面樣板裡：
 * 樣板是所有集共用的，寫死等於第 2 集會顯示第 1 集的選項。
 *
 * key 的字元集必須跟 functions/_shared.ts 的 slug() 一致，
 * 不一致的話伺服器會把合法的票當垃圾丟掉，而且前端不會報錯。
 */
const poll = z.object({
  question: z.string().min(1),
  options: z
    .array(
      z.object({
        key: z
          .string()
          .regex(/^[a-z0-9-]{1,40}$/, 'poll 選項的 key 只能用小寫英數與連字號'),
        label: z.string().min(1),
      }),
    )
    .min(2, '投票至少 2 個選項')
    .max(4, '超過 4 個選項在手機上會變成一面牆'),
});

const historyNote = z.object({
  claim: z.string().min(1),
  /** 可信度分級。戲劇虛構必須誠實標出來，不能混在史實裡 */
  level: z.enum(['史實', '軼事等級', '戲劇虛構', '本劇設定']),
  note: z.string().min(1),
  /** 史實與軼事必須附來源。戲劇虛構與本劇設定可免 */
  url: z.string().url().optional(),
});

const episodes = defineCollection({
  /**
   * `[!_]*.md`：底線開頭的檔案不收錄，這樣 _template.md 可以跟真集數放在同一個
   * 資料夾（共編者要新增的就是這個資料夾，範本擺在旁邊最好找），
   * 又不會自己變成一集。實測過 glob loader 不會自動略過底線檔，pattern 一定要寫。
   */
  loader: glob({ pattern: '[!_]*.md', base: './src/content/episodes' }),
  schema: ({ image }) =>
    z
      .object({
        episode: z.number().int().positive(),
        title: z.string().min(1),
        /** 一句話劇情鉤子，用在首頁 hero 與 OG description */
        hook: z.string().min(10).max(120),
        status: z.enum(['draft', 'production', 'published']),

        creator,

        youtube: z.object({
          /** 影片還沒好就留 null，頁面自動顯示製作中卡片 */
          videoId: z.string().nullable().default(null),
          durationSec: z.number().int().positive().nullable().default(null),
          publishedAt: z.coerce.date().nullable().default(null),
        }),

        /** 本集使用的工具與版本，由創作者自填。NEVER 由網站寫死 */
        tools: z
          .array(z.object({ name: z.string(), version: z.string() }))
          .default([]),

        /** 取自 8 條必勝公式庫 */
        formulas: z.array(z.string()).min(1),

        /** 角色錨句，每一鏡的提示詞都要置頂這一段，15 鏡人物長相才會一致 */
        anchorPrompt: z.string().min(1),

        shots: z.array(shot).min(1),

        handoffCard: z.object({
          musts: z.array(z.string()).length(3, '接點卡必須剛好 3 條必守'),
          cliffhanger: z.string().min(1, '接點卡必須有 1 個懸念'),
        }),

        historyNotes: z.array(historyNote).default([]),

        /** 沒填就不顯示投票區塊，不會留一個空框在那裡 */
        poll: poll.optional(),

        /** 直式 2:3 海報 */
        poster: image(),
        posterCredit: z.string().min(1, '海報必須標來源與授權'),

        publishedAt: z.coerce.date().nullable().default(null),
      })
      .superRefine((data, ctx) => {
        // 鏡號必須從 1 連號，不能跳號或重複
        data.shots.forEach((s, i) => {
          if (s.n !== i + 1) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['shots', i, 'n'],
              message: `鏡號必須連號，第 ${i + 1} 個鏡頭寫成了 ${s.n}`,
            });
          }
        });

        // 60 秒鐵律
        const dur = data.youtube.durationSec;
        if (dur !== null && dur > 60) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['youtube', 'durationSec'],
            message: `每集必須 60 秒內，這集是 ${dur} 秒`,
          });
        }

        // 工具版本不准寫「最新」，會隨時間變成錯的
        data.tools.forEach((t, i) => {
          const hit = FORBIDDEN_VERSION_WORDS.find((w) =>
            t.version.toLowerCase().includes(w.toLowerCase()),
          );
          if (hit) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['tools', i, 'version'],
              message: `工具版本不能寫「${hit}」，要寫當下的實際版本號`,
            });
          }
        });

        // 史實與軼事等級必須附來源
        data.historyNotes.forEach((h, i) => {
          if ((h.level === '史實' || h.level === '軼事等級') && !h.url) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['historyNotes', i, 'url'],
              message: `${h.level} 必須附來源連結`,
            });
          }
        });

        // 已發布就必須有影片
        if (data.status === 'published' && !data.youtube.videoId) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['youtube', 'videoId'],
            message: 'status 是 published 就必須有 videoId',
          });
        }
      }),
});

export const collections = { episodes };
