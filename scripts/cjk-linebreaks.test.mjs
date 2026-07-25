/** 跑法：npm run test（node --test） */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collapseCjkBreaks } from './cjk-linebreaks.mjs';

test('清掉兩個中文字之間的換行', () => {
  const { html, count } = collapseCjkBreaks('<p>樣子。\n        所以要先把</p>');
  assert.equal(html, '<p>樣子。所以要先把</p>');
  assert.equal(count, 1);
});

test('連續多行的中文每一行都要處理', () => {
  const { html, count } = collapseCjkBreaks('<p>第一行\n第二行\n第三行</p>');
  assert.equal(html, '<p>第一行第二行第三行</p>');
  assert.equal(count, 2);
});

test('中文與英文之間的換行保留（那裡的空白是對的）', () => {
  const src = '<p>用的是 Astro\n這個框架</p>';
  assert.equal(collapseCjkBreaks(src).html, src);
});

test('英文之間的換行保留', () => {
  const src = '<p>hello\nworld</p>';
  assert.equal(collapseCjkBreaks(src).html, src);
});

test('pre 裡的換行 NEVER 動', () => {
  const src = '<pre>第一行\n第二行</pre>';
  assert.equal(collapseCjkBreaks(src).html, src);
  assert.equal(collapseCjkBreaks(src).count, 0);
});

test('script 裡的換行 NEVER 動', () => {
  const src = "<script>const a = '中文';\n// 註解\n</script>";
  assert.equal(collapseCjkBreaks(src).html, src);
});

test('pre 之後的段落照樣處理', () => {
  const { html } = collapseCjkBreaks('<pre>a\nb</pre><p>前面\n後面</p>');
  assert.equal(html, '<pre>a\nb</pre><p>前面後面</p>');
});

test('全形標點與引號都算中文字元', () => {
  assert.equal(collapseCjkBreaks('<p>他說：\n「不行」</p>').html, '<p>他說：「不行」</p>');
});

test('標籤之間的換行不受影響', () => {
  const src = '<p>中文</p>\n<p>中文</p>';
  assert.equal(collapseCjkBreaks(src).html, src);
});
