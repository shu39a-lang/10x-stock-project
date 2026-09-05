import io
import json
import time
import urllib.parse
import urllib.request

import pandas as pd

JPX_SEARCH_URL = (
    "https://www2.jpx.co.jp/tseHpFront/StockSearch.do"
    "?method=topsearch&topSearchStr={code}"
)

FALLBACK_NAMES = {
    "8309": "三井住友トラストグループ",
    "8308": "りそなホールディングス",
    "8473": "SBIホールディングス",
    "7182": "ゆうちょ銀行",
    "6178": "日本郵政",
    "4684": "オービック",
    "6326": "クボタ",
    "7269": "スズキ",
    "8306": "三菱UFJフィナンシャル・グループ",
    "8316": "三井住友フィナンシャルグループ",
    "8411": "みずほフィナンシャルグループ",
    "8058": "三菱商事",
    "1605": "INPEX",
}


def normalize_code(row):
    for key in ("code", "symbol", "ticker"):
        value = row.get(key)
        if not value:
            continue

        text = str(value).strip().upper()
        if text.endswith(".T"):
            text = text[:-2]

        digits = "".join(ch for ch in text if ch.isdigit())
        if len(digits) >= 4:
            return digits[:4]

    return ""


def has_japanese(text):
    return any(
        ("\u3040" <= ch <= "\u30ff")
        or ("\u4e00" <= ch <= "\u9fff")
        for ch in str(text or "")
    )


def lookup_jpx_name(code):
    url = JPX_SEARCH_URL.format(
        code=urllib.parse.quote(str(code))
    )

    headers = {
        "User-Agent": "Mozilla/5.0"
    }

    req = urllib.request.Request(url, headers=headers)

    with urllib.request.urlopen(req, timeout=30) as response:
        html = response.read().decode("utf-8", errors="ignore")

    tables = pd.read_html(io.StringIO(html))

    for df in tables:
        df.columns = [str(c).strip() for c in df.columns]

        if "コード" not in df.columns or "銘柄名" not in df.columns:
            continue

        if df.empty:
            continue

        name = str(df.iloc[0]["銘柄名"]).strip()

        if name and name.lower() != "nan":
            return name

    return ""


def collect_codes_needing_names(data):
    codes = set()
    japan = data.get("japan", {})

    for period in ("short", "medium", "long", "all"):
        rows = japan.get(period, [])

        if not isinstance(rows, list):
            continue

        for row in rows:
            if not isinstance(row, dict):
                continue

            code = normalize_code(row)

            if code and not has_japanese(row.get("name")):
                codes.add(code)

    return sorted(codes)


def download_jpx_names(data):
    codes = collect_codes_needing_names(data)
    names = {}

    for code in codes:
        try:
            name = lookup_jpx_name(code)

            if name:
                names[code] = name

        except Exception as exc:
            print(f"JPX lookup failed {code}: {exc}")

        time.sleep(0.08)

    print(f"JPX Japanese names loaded: {len(names)}")
    return names


def main():
    path = "tenx_data.json"

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    jpx_names = download_jpx_names(data)

    changed = 0
    checked = 0
    japan = data.get("japan", {})

    for period in ("short", "medium", "long", "all"):
        rows = japan.get(period, [])

        if not isinstance(rows, list):
            continue

        for row in rows:
            if not isinstance(row, dict):
                continue

            checked += 1
            code = normalize_code(row)

            if not code:
                continue

            japanese_name = (
                jpx_names.get(code)
                or FALLBACK_NAMES.get(code)
            )

            if japanese_name and row.get("name") != japanese_name:
                row["name"] = japanese_name
                changed += 1

    with open(path, "w", encoding="utf-8") as f:
        json.dump(
            data,
            f,
            ensure_ascii=False,
            indent=2
        )

    print(
        "Japanese name normalization complete. "
        f"checked={checked}, changed={changed}"
    )


if __name__ == "__main__":
    main()
