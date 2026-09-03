import io
import json
import time
import urllib.request

import pandas as pd

JPX_LIST_URL = (
    "https://www.jpx.co.jp/markets/statistics-equities/misc/"
    "tvdivq0000001vg2-att/data_j.xls"
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


def download_jpx_names():
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 Chrome/139.0 Safari/537.36"
        ),
        "Accept": "application/vnd.ms-excel,application/octet-stream,*/*",
    }

    last_error = None

    for attempt in range(3):
        try:
            req = urllib.request.Request(JPX_LIST_URL, headers=headers)

            with urllib.request.urlopen(req, timeout=30) as response:
                data = response.read()

            df = pd.read_excel(
                io.BytesIO(data),
                dtype={"コード": str}
            )

            if "コード" not in df.columns or "銘柄名" not in df.columns:
                raise ValueError("JPX columns not found")

            names = {}

            for _, row in df[["コード", "銘柄名"]].dropna().iterrows():
                code = str(row["コード"]).strip()
                name = str(row["銘柄名"]).strip()

                if len(code) == 4 and code.isdigit() and name:
                    names[code] = name

            if len(names) < 1000:
                raise ValueError(
                    f"Too few JPX names loaded: {len(names)}"
                )

            print(
                f"JPX Japanese names loaded: {len(names)}"
            )

            return names

        except Exception as exc:
            last_error = exc
            print(
                f"JPX name download attempt "
                f"{attempt + 1} failed: {exc}"
            )
            time.sleep(2)

    print(
        "JPX name download failed; "
        f"using fallback names only: {last_error}"
    )

    return {}


def normalize_code(row):
    for key in ("code", "symbol", "ticker"):

        value = row.get(key)

        if not value:
            continue

        text = str(value).strip().upper()

        if text.endswith(".T"):
            text = text[:-2]

        digits = "".join(
            ch for ch in text if ch.isdigit()
        )

        if len(digits) >= 4:
            return digits[:4]

    return ""


def main():

    path = "tenx_data.json"

    with open(
        path,
        "r",
        encoding="utf-8"
    ) as f:
        data = json.load(f)

    jpx_names = download_jpx_names()

    changed = 0
    checked = 0

    japan = data.get("japan", {})

    for period in (
        "short",
        "medium",
        "long"
    ):

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

            if not japanese_name:
                continue

            if row.get("name") != japanese_name:
                row["name"] = japanese_name
                changed += 1

    with open(
        path,
        "w",
        encoding="utf-8"
    ) as f:

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
