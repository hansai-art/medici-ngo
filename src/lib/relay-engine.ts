/**
 * 世界觀聖經 v1.0 與短劇引擎，可公開版。
 *
 * 內容正本 = Obsidian B3「第一季聖經與第1集初稿-達文西」第一、二節。
 * 該檔第三節以下是劇本迭代歷程，NEVER 對外發布，也 NEVER 搬進這個檔案。
 *
 * 上線前需要 Hans 對這份公開版終審一次（列在開站檢查清單）。
 */

export const WORLD_BIBLE = {
  anchor: {
    title: '時空錨',
    body: '文藝復興的義大利，起源篇從 1470 年代的佛羅倫斯出發。第一季聚焦達文西、米開朗基羅、拉斐爾、波提切利的佛羅倫斯世代；1503 年前後的同城高峰（達文西畫蒙娜麗莎、米開朗基羅雕大衛、拉斐爾隔年抵達）是本季中段的天然舞台。',
  },
  rule: {
    title: '唯一奇幻規則',
    body: '把想像描述得夠精確，它就會短暫成真。手稿、畫、雕刻都算「描述」。這是 prompting 的文藝復興寓言，也是整個計畫的自我隱喻。',
  },
  musts: [
    '奇幻規則只有創作者本人能觸發，成真之物天亮即消失。這條是防止世界觀通膨。',
    '每集主角必須是真實存在過的文藝復興創作者。史實可以奇幻化，但不能張冠李戴。',
    '每集至少一個贊助、委託或網絡元素。美第奇網絡是背景線，把群像串成一張網。',
  ],
  curation:
    '風格完全自由，參差就是特色。一季 8 到 12 集強制收束，季末由發起人或客座導演收尾。',
} as const;

/** 三件套交付 */
export const DELIVERABLES = [
  { name: '影片', detail: '60 秒內，直式 9:16' },
  { name: '劇本與提示詞', detail: '全部公開，一鏡一條，不藏配方' },
  { name: '接點卡', detail: '3 個必守設定 + 1 個懸念，交給下一棒' },
] as const;

/** 鉤子鐵律：每集結尾，違反就退回 */
export const HOOK_RULES = {
  core: '結尾最後 5 秒必須丟出新鉤子，斷在猜不到的地方。不要用「未完待續」式的軟結尾。',
  validEndings: [
    '身份反轉只揭一半',
    '危機升級到看似無解',
    '新規則亮出但不解釋',
    '關鍵人物現身但意圖不明',
  ],
  velocity:
    '下一棒開場 10 秒內必須先解上一集的鉤，才能進自己的故事。上集尾放鉤、下集頭解鉤、本集尾再放新鉤，鏈條不能斷。',
  selfCheck: '觀眾能不能用一句話猜中下一集開頭？能猜中就重寫結尾。',
} as const;

/** 60 秒節奏模板 */
export const BEAT_TEMPLATE = [
  { range: '0 到 3 秒', task: '黃金三秒：衝突、奇觀、懸念、反差四選一。不要慢熱鋪陳' },
  { range: '3 到 10 秒', task: '解上一棒的鉤（第 1 集免）加上建立本集目標' },
  { range: '10 到 45 秒', task: '推進，並且至少 1 個反轉（身份、關係、態度三選一）' },
  { range: '45 到 55 秒', task: '本集爽點兌現：打臉、揭露或成真時刻' },
  { range: '55 到 60 秒', task: '新鉤子，硬斷' },
] as const;

export const SHOT_DISCIPLINE =
  '每個鏡頭晚進早出：進場即衝突，出場即決定、羞辱、威脅或揭露，鏡頭之間不留過場。';

/** 必勝公式庫。想不到就直接套，公開標注是產品的一部分，不是丟臉的事 */
export const FORMULAS = [
  {
    n: 1,
    name: '打臉',
    definition: '被輕視者當場證明實力',
    example: '眾人笑波提切利過氣，他一筆讓維納斯睜眼',
  },
  {
    n: 2,
    name: '扮豬吃老虎 / 馬甲',
    definition: '隱藏身份，時機到才揭',
    example: '掃地學徒其實是米開朗基羅；神祕買家掀兜帽是教宗',
  },
  {
    n: 3,
    name: '霸道贊助人',
    definition: '霸總公式的美第奇版',
    example: '「這幅畫我全要了。連畫家一起。」',
  },
  {
    n: 4,
    name: '預視',
    definition: '主角看見別人看不見的未來',
    example: '達文西夢見手稿裡的飛行器飛在 500 年後的天空，醒來瘋狂作畫',
  },
  {
    n: 5,
    name: '金手指 / 規則漏洞',
    definition: '發現規則的隱藏用法',
    example: '有人發現「描述別人的作品」也能讓它成真',
  },
  {
    n: 6,
    name: '復仇逆襲',
    definition: '被踩到底的人帶著逆天作品回歸',
    example: '被逐出工坊的學徒，帶著讓全城下跪的壁畫回來',
  },
  {
    n: 7,
    name: '倒計時',
    definition: '死線壓頂，本世界觀自帶：天亮即消失',
    example: '教宗明晨驗收，但作品只能活到天亮',
  },
  {
    n: 8,
    name: '身份差',
    definition: '觀眾知道的比角色多，或反過來',
    example: '觀眾知道獅子叼走的那頁是什麼，主角不知道',
  },
] as const;

/** 品質守門：公式不變狗血的三道鎖 */
export const QUALITY_LOCKS = [
  {
    name: '史實血肉條款',
    body: '公式可以套，但必須換上真實人物的真作品、真事件，奇幻化允許。台詞不要直接搬現代短劇腔，要用文藝復興語感講同一個爽點。',
  },
  {
    name: '發起人終審五題',
    body: '任一不過退回一次修。',
  },
  {
    name: '公式透明化',
    body: '每集網頁標注使用公式與完整提示詞。觀眾看得到配方就是教學資產，也逼創作者不能只靠公式偷懶：配方公開，執行見真章。',
  },
] as const;

/** 終審五題 */
export const FINAL_REVIEW = [
  '前 3 秒有鉤嗎？',
  '開場 10 秒解上鉤了嗎？',
  '中段有反轉嗎？',
  '結尾鉤子猜得中嗎？猜得中就退回。',
  '爽嗎？好笑嗎？60 秒內至少 1 個打臉爽點加 1 個笑點。',
] as const;

/** 方法論來源。引用別人的方法就把出處列出來 */
export const METHOD_SOURCES = [
  {
    label: '微短劇分場與反轉設計',
    url: 'https://wordflower.cn/blog/how-to-write-short-drama-script/',
  },
  {
    label: 'vertical drama 鉤子節奏',
    url: 'https://vitrina.ai/blog/micro-dramas-and-vertical-first-storytelling/',
  },
  {
    label: '套路庫與 compressed conflict',
    url: 'https://filmustage.com/blog/how-to-write-a-vertical-drama-script/',
  },
] as const;
