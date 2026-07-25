#!/usr/bin/env bash
# lint-design-tokens.sh — 守住三層 token 架構
#
# 規則來自 aiterms.tw 的同名腳本（那邊是踩了一整年版面走鐘之後長出來的），
# 依這個站的情況調整：只有深色一種主題、色票在 src/styles/tokens/。
#
# 為什麼要擋：色碼一旦散落在各頁面，改視覺就變成全站搜尋取代，
# 而且一定會漏。所有顏色只能從 semantic token 拿。
#
# 例外請在該行加 lint-ok 並寫原因。
# Exit 0 = 乾淨；Exit 1 = 有違規

set -uo pipefail

cd "$(dirname "$0")/.."

SCAN=(src/pages src/components src/layouts src/lib src/data)
VIOLATIONS=0

# 只掃存在的目錄，缺目錄不該讓 lint 整支爆掉
EXISTING=()
for d in "${SCAN[@]}"; do [ -d "$d" ] && EXISTING+=("$d"); done

check() {
  local label="$1" pattern="$2"
  shift 2
  local hits
  hits=$(grep -rnE "$pattern" "${EXISTING[@]}" \
    --include="*.astro" --include="*.ts" --include="*.tsx" --include="*.css" \
    2>/dev/null | grep -v 'lint-ok' || true)
  if [ -n "$hits" ]; then
    echo "  ✗ [$label]"
    echo "$hits" | while IFS= read -r l; do echo "      ${l:0:160}"; done
    VIOLATIONS=$((VIOLATIONS + $(echo "$hits" | wc -l | tr -d ' ')))
  fi
}

echo "=== 1/6 頁面與元件不得直接用 primitive token ==="
# primitive（--c-ink-900 這種）只能給 semantic 層用。
# 頁面直接引用等於跳過語意層，改配色時會改不到。
check "primitive-token-direct-use" 'var\(--c-[a-z]+-[0-9]+\)'
[ "$VIOLATIONS" -eq 0 ] && echo "  ✓ 無違規"

BEFORE=$VIOLATIONS
echo "=== 2/6 style 屬性內不得寫死 hex ==="
check "hex-in-style-attr" 'style="[^"]*#([[:xdigit:]]{3}|[[:xdigit:]]{6}|[[:xdigit:]]{8})'
[ "$VIOLATIONS" -eq "$BEFORE" ] && echo "  ✓ 無違規"

BEFORE=$VIOLATIONS
echo "=== 3/6 CSS 區塊內不得寫死顏色 ==="
# 任何會吃顏色的屬性後面直接接色碼、rgba() 或 hsla()。
# tokens 目錄本來就是定義色票的地方，不在掃描範圍內。
#
# 2026-07-25：第一版只列 color / background / border-color / fill / stroke，
# 結果漏掉 `border: 1px dashed rgba(...)`、`text-shadow: 0 2px 18px rgba(...)`、
# `background-image: linear-gradient(rgba(...))` 這三種寫法，
# 同一份檔案裡有 5 處違規安然通過。清單改成正面表列所有吃顏色的屬性。
COLOR_PROPS='color|background|background-color|background-image|border|border-[a-z]+|outline|outline-color|box-shadow|text-shadow|fill|stroke|caret-color|accent-color|text-decoration-color|--[a-z0-9-]+'
check "hardcoded-color" "($COLOR_PROPS):[^;]*(#[[:xdigit:]]{3,8}|rgba?\(|hsla?\()"
[ "$VIOLATIONS" -eq "$BEFORE" ] && echo "  ✓ 無違規"

BEFORE=$VIOLATIONS
echo "=== 4/6 不得使用 Tailwind 預設色名 ==="
# text-slate-400 這種跟設計系統無關，用了就等於開了第二套色票。
PALETTE='slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose'
check "tailwind-default-palette" "(text|bg|border|ring|fill|stroke|from|via|to|divide|outline|decoration)-($PALETTE)-[0-9]{2,3}"
[ "$VIOLATIONS" -eq "$BEFORE" ] && echo "  ✓ 無違規"

BEFORE=$VIOLATIONS
echo "=== 5/6 不得使用全形破折號 ==="
# 全形破折號在中文排版裡會變成一條長線，一律用冒號代替。
check "em-dash" '—'
[ "$VIOLATIONS" -eq "$BEFORE" ] && echo "  ✓ 無違規"

echo "=== 6/6 theme-color 必須跟 --c-ink-900 同步 ==="
# `<meta name="theme-color">` 吃不到 CSS 變數，值只能在 site.ts 再寫一次。
# 這是全站唯一一個合法的重複色碼，所以用機器比對確保它不會漂掉。
INK=$(grep -oE '^\s*--c-ink-900:\s*#[0-9A-Fa-f]{6}' src/styles/tokens/primitive.css | grep -oE '#[0-9A-Fa-f]{6}')
THEME=$(grep -oE "themeColor:\s*'#[0-9A-Fa-f]{6}'" src/lib/site.ts | grep -oE '#[0-9A-Fa-f]{6}')
if [ -z "$INK" ] || [ -z "$THEME" ]; then
  echo "  ✗ [theme-color-sync] 抓不到值（--c-ink-900='$INK' / SITE.themeColor='$THEME'）"
  VIOLATIONS=$((VIOLATIONS + 1))
elif [ "$(echo "$INK" | tr 'a-f' 'A-F')" != "$(echo "$THEME" | tr 'a-f' 'A-F')" ]; then
  echo "  ✗ [theme-color-sync] SITE.themeColor=$THEME 不等於 --c-ink-900=$INK"
  VIOLATIONS=$((VIOLATIONS + 1))
else
  # 大括號不能省：後面接的是全形括號，bash 會把多位元組字元併進變數名
  echo "  ✓ 同步（${INK}）"
fi

echo
if [ "$VIOLATIONS" -gt 0 ]; then
  echo "✗ design token 違規 $VIOLATIONS 處"
  echo "  修法：顏色用 src/styles/tokens/semantic.css 的 var(--text-*) / var(--bg-*) / var(--chart-*)"
  echo "  真的需要例外：該行加 lint-ok 並寫原因"
  exit 1
fi
echo "✓ design token 檢查通過"
