// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import cjkLinebreaks from './scripts/cjk-linebreaks.mjs';

// 部署目標 = Cloudflare Pages（Git 整合），不是 Workers。
// 選 Pages 的唯一理由：只有 Pages 的 Git 整合會為「同 repo 分支的 PR」自動產生預覽網址，
// 而共編流程要求 Hans 在按 Merge 之前看得到畫面。
//
// 純 static output、不裝 adapter。兩個動態端點（/api/beat、/api/vote）
// 走 Pages Functions（根目錄 functions/），不經過 Astro。
//
// 刻意不用 @astrojs/sitemap：它會爬全站、把不該公開的路徑掃進 sitemap，
// 且它產生的 index 會蓋掉自製版。sitemap 用自製 endpoint（allowlist 式）。
export default defineConfig({
  site: 'https://medici.ngo',
  output: 'static',
  trailingSlash: 'never',
  build: {
    format: 'file',
  },
  // 中文段落寫成多行時，行尾換行會被瀏覽器渲染成一個多餘空白（實測 Chromium 147 差 4px）。
  // 這個 integration 在 build 完成後把那些空白清掉，見 scripts/cjk-linebreaks.mjs。
  integrations: [cjkLinebreaks()],
  vite: {
    plugins: [tailwindcss()],
  },
});
