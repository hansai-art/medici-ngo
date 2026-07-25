#!/usr/bin/env python3
"""
把 Noto Serif TC 切成只含站上真正用到的字，輸出 woff2。

跑法：npm run font:build（會先跑 collect-glyphs.mjs）

需求：pip3 install fonttools brotli
原始字型：Noto Serif TC（SIL Open Font License 1.1），
從 https://github.com/notofonts/noto-cjk 取得，不進版控（7.6MB × 2）。

為什麼要自架子集而不是打 Google Fonts：
第三方字型請求會多一次 DNS + TLS + 下載，直接壓在 LCP 上，
而 Core Web Vitals 本身就是排名因素。整包 Noto Serif TC 是 7.6MB，
子集之後不到 1%，這是這個站唯一划算的做法。

字集怎麼來的：scripts/collect-glyphs.mjs 用真的瀏覽器跑過每一頁，
逐個文字節點看 computed font-weight 分成兩袋，所以 Bold 只包真的用到粗體的字。
"""

import json
import pathlib
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
GLYPHS = ROOT / "scripts" / "glyphs.json"
OUT_DIR = ROOT / "public" / "fonts"
COVERAGE = OUT_DIR / "coverage.json"

# 原始字型放哪裡：預設抓環境變數，沒有就用 scratch 路徑
SOURCES = {
    "regular": "NotoSerifTC-Regular.otf",
    "bold": "NotoSerifTC-Bold.otf",
}


def subset_font(src: pathlib.Path, chars: str, dest: pathlib.Path) -> int:
    options = subset.Options()
    options.flavor = "woff2"
    # layout_features 用 fontTools 預設值（瀏覽器真的會套用的那些），不要寫 ["*"]。
    # 實測 963 字的 Regular：全部 feature 274 KB，預設 234 KB，差 40 KB，
    # 多出來的是橫排網頁永遠用不到的直排特徵。
    #
    # desubroutinize 對 CFF 字型通常會變大，但這個字型剛好相反
    # （全 feature 274 vs 311、預設 234 vs 268），所以留著。
    # 換字型或換 fontTools 版本時要重新量，NEVER 照抄這個結論。
    options.desubroutinize = True
    options.drop_tables += ["FFTM"]
    # name 表要留授權欄位（OFL 要求），砍掉等於把授權資訊丟了
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
    options.notdef_outline = True
    options.recalc_bounds = True

    font = TTFont(src)
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(text=chars)
    subsetter.subset(font)
    font.flavor = "woff2"
    font.save(dest)
    return dest.stat().st_size


def main() -> int:
    if not GLYPHS.exists():
        print(f"找不到 {GLYPHS}，先跑 node scripts/collect-glyphs.mjs", file=sys.stderr)
        return 1

    src_dir = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else None
    if not src_dir or not src_dir.is_dir():
        print("用法：python3 scripts/subset-font.py <放 NotoSerifTC-*.otf 的資料夾>", file=sys.stderr)
        return 1

    data = json.loads(GLYPHS.read_text(encoding="utf-8"))
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    coverage = {}
    for weight, filename in SOURCES.items():
        src = src_dir / filename
        if not src.exists():
            print(f"缺少原始字型 {src}", file=sys.stderr)
            return 1

        chars = data[weight]
        dest = OUT_DIR / f"noto-serif-tc-{weight}.woff2"
        size = subset_font(src, chars, dest)
        coverage[weight] = sorted({ord(c) for c in chars})
        print(f"  {weight}: {len(chars)} 字 → {dest.name} {size / 1024:.0f} KB")

    COVERAGE.write_text(
        json.dumps(
            {
                "note": "由 scripts/subset-font.py 產生。scripts/check-font-coverage.mjs 會拿它比對 build 產物。",
                "codepoints": coverage,
            },
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"  字集清單 → {COVERAGE.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
