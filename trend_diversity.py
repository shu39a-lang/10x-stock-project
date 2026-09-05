import json, re, io
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import Request, urlopen

import numpy as np
import pandas as pd
import yfinance as yf

DATA = Path(__file__).parent / "tenx_data.json"
JPX_LIST_PAGE = "https://www.jpx.co.jp/markets/statistics-equities/misc/01.html"

SEMICONDUCTOR_CODES = {
    "6857","8035","6920","6146","6525","6871","7735","7729","6315","6254",
    "6723","6963","4063","3436","4369","4186","4004","6762","6981","6965"
}
AI_DATACENTER_CODES = {
    "6701","6501","6702","9432","9433","3778","4684","4716","4307","9984",
    "5801","5802","5803","2327","3655","3994","4485","9697"
}
POWER_INFRA_CODES = {
    "5801","5802","5803","6501","6503","6504","6645","6644","1942","1944",
    "1969","7011","7012","7013"
}

def clamp(v, lo=0, hi=100):
    try:
        return float(np.clip(float(v), lo, hi))
    except Exception:
        return 50.0

def soft_score(raw):
    try:
        raw = float(raw)
        return float(np.clip(50.0 + 42.0*np.tanh((raw-50.0)/32.0), 8.0, 92.0))
    except Exception:
        return 50.0

def grade(v):
    return "A" if v >= 71 else "B" if v >= 68 else "C" if v >= 65 else "D"

def percentile_scores(values):
    clean = [(k, float(v)) for k, v in values.items() if np.isfinite(v)]
    if not clean:
        return {}

    clean.sort(key=lambda x:x[1], reverse=True)
    n = max(len(clean)-1, 1)

    return {
        key:100.0*(1-i/n)
        for i,(key,_) in enumerate(clean)
    }

def load_jpx_sector_map():
    try:
        headers = {"User-Agent":"Mozilla/5.0"}
        req = Request(JPX_LIST_PAGE, headers=headers)

        with urlopen(req, timeout=30) as r:
            page = r.read().decode("utf-8", errors="ignore")

        m = re.search(
            r'href=["\']([^"\']+\.(?:xls|xlsx)(?:\?[^"\']*)?)',
            page,
            re.I
        )

        if not m:
            return {}

        xurl = urljoin(JPX_LIST_PAGE, m.group(1))

        with urlopen(Request(xurl, headers=headers), timeout=30) as r:
            blob = r.read()

        df = pd.read_excel(io.BytesIO(blob), dtype=str)

        code_col = next(
            (c for c in df.columns if "コード" in str(c)),
            None
        )

        sector_col = next(
            (
                c for c in df.columns
                if "33業種" in str(c) and "区分" in str(c)
            ),
            None
        )

        if not code_col or not sector_col:
            return {}

        out = {}

        for _,row in df[[code_col,sector_col]].dropna().iterrows():
            code = str(row[code_col]).strip()
            sector = str(row[sector_col]).strip()

            if len(code)==4 and code.isdigit():
                out[code]=sector

        return out

    except Exception as e:
        print("sector map load failed:",e)
        return {}

def theme_for(code,name,sector):
    code = str(code)
    name = str(name or "")
    sector = str(sector or "その他")

    bank_keywords = (
        "銀行",
        "フィナンシャルグループ",
        "フィナンシャル・グループ",
        "フィナンシャルHD",
        "フィナンシャルホールディングス",
        "ＦＧ",
        "FG"
    )

    bank_codes = {
        "7180","7182","7327","7337","7342","7380","7381","7389",
        "8304","8306","8308","8309","8316","8331","8334","8336",
        "8337","8338","8341","8343","8344","8345","8354","8358",
        "8359","8360","8361","8362","8366","8367","8368","8370",
        "8377","8381","8386","8387","8388","8392","8393","8395",
        "8410","8411","8522","8524","8537","8541","8544","8550",
        "8551","8558","8562","8563","8600","8713"
    }

    securities_codes = {
        "8473","8601","8604","8613","8614","8616",
        "8622","8624","8628","8697","8698"
    }

    finance_keywords = (
        "証券",
        "ＳＢＩホールディングス",
        "SBIホールディングス",
        "野村ホールディングス",
        "大和証券グループ",
        "マネックスグループ",
        "松井証券",
        "ＳＯＭＰＯ",
        "SOMPO",
        "ＭＳ＆ＡＤ",
        "MS&AD",
        "Ｔ＆Ｄホールディングス",
        "T&Dホールディングス"
    )

    if (
        sector=="銀行業"
        or code in bank_codes
        or any(k in name for k in bank_keywords)
    ):
        return "銀行"

    if (
        sector in (
            "証券、商品先物取引業",
            "その他金融業",
            "保険業"
        )
        or code in securities_codes
        or any(k in name for k in finance_keywords)
    ):
        return "金融・証券"

    if code in SEMICONDUCTOR_CODES or any(
        k in name for k in (
            "レーザーテック",
            "アドバンテスト",
            "ディスコ",
            "東京エレクトロン",
            "ＫＯＫＵＳＡＩ",
            "KOKUSAI",
            "マイクロニクス",
            "SCREEN",
            "スクリーン"
        )
    ):
        return "半導体"

    if code in AI_DATACENTER_CODES or any(
        k in name for k in (
            "データセクション",
            "さくらインターネット",
            "オービック",
            "NEC",
            "日本電気",
            "富士通"
        )
    ):
        return "AI・データセンター"

    if code in POWER_INFRA_CODES or any(
        k in name for k in (
            "フジクラ",
            "住友電気",
            "古河電気",
            "古河電工",
            "富士電機"
        )
    ):
        return "電線・電力インフラ"

    if sector in (
        "電気機器",
        "機械",
        "精密機器",
        "輸送用機器",
        "情報・通信業"
    ):
        return "製造・IT"

    return sector if sector and sector!="nan" else "その他"

def download_prices(codes):
    symbols = [f"{c}.T" for c in codes]
    out = {}

    for start in range(0,len(symbols),50):
        chunk = symbols[start:start+50]

        try:
            data = yf.download(
                chunk,
                period="2y",
                auto_adjust=False,
                progress=False,
                threads=True,
                group_by="ticker"
            )
        except Exception as e:
            print("price download failed:",e)
            continue

        for sym in chunk:
            try:
                d = (
                    data.copy()
                    if len(chunk)==1
                    else data[sym].copy()
                )

                if isinstance(d.columns,pd.MultiIndex):
                    d.columns = d.columns.get_level_values(0)

                d = d.dropna(subset=["Close"])

                if len(d)<210:
                    continue

                c = d["Close"].astype(float)
                v = d["Volume"].astype(float).reindex(c.index).fillna(0)

                last = float(c.iloc[-1])
                prev = float(c.iloc[-2])

                ma20 = float(c.rolling(20).mean().iloc[-1])
                ma50 = float(c.rolling(50).mean().iloc[-1])
                ma200 = float(c.rolling(200).mean().iloc[-1])

                ret1 = float((last/prev-1)*100)
                ret20 = float((last/c.iloc[-21]-1)*100)
                ret60 = float((last/c.iloc[-61]-1)*100)
                ret120 = float((last/c.iloc[-121]-1)*100)
                ret200 = float((last/c.iloc[-201]-1)*100)

                volume = float(v.iloc[-1])
                vol20 = float(v.rolling(20).mean().iloc[-1])
                vol5 = float(v.rolling(5).mean().iloc[-1])

                vol_ratio = float(volume/max(vol20,1))
                vol5_ratio = float(vol5/max(vol20,1))
                traded_value = float(last*volume)

                diff = c.diff()
                up = diff.clip(lower=0).rolling(14).mean()
                dn = (-diff.clip(upper=0)).rolling(14).mean()

                rs = up/dn.replace(0,np.nan)
                rsi = float(
                    (100-100/(1+rs)).iloc[-1]
                )

                drawdown = float(
                    (c/c.cummax()-1).tail(250).min()*100
                )

                out[sym[:-2]] = {
                    "price":last,
                    "change_pct":ret1,
                    "ma20":ma20,
                    "ma50":ma50,
                    "ma200":ma200,
                    "ret20":ret20,
                    "ret60":ret60,
                    "ret120":ret120,
                    "ret200":ret200,
                    "volume":volume,
                    "traded_value":traded_value,
                    "vol_ratio":vol_ratio,
                    "vol5_ratio":vol5_ratio,
                    "rsi":rsi,
                    "drawdown":drawdown
                }

            except Exception:
                continue

    return out

def build_market_heat(prices):
    volume_rank = percentile_scores(
        {c:p["volume"] for c,p in prices.items()}
    )

    value_rank = percentile_scores(
        {c:p["traded_value"] for c,p in prices.items()}
    )

    spike_rank = percentile_scores(
        {c:p["vol_ratio"] for c,p in prices.items()}
    )

    move_rank = percentile_scores(
        {c:p["change_pct"] for c,p in prices.items()}
    )

    out = {}

    for code,p in prices.items():
        heat = (
            0.30*volume_rank.get(code,50)
            +0.35*value_rank.get(code,50)
            +0.20*spike_rank.get(code,50)
            +0.15*move_rank.get(code,50)
        )

        out[code] = round(
            clamp(heat,0,100),
            1
        )

    return out

def horizon_ok(p,technical,h,market_heat=50):
    if h=="short":
        normal = (
            p["price"]>p["ma20"]
            and 42<=p["rsi"]<=72
            and technical>=50
            and p["ret20"]>-5
            and p["vol_ratio"]>=0.70
            and p["drawdown"]>-40
        )

        hot_market = (
            market_heat>=72
            and p["price"]>p["ma50"]*0.97
            and technical>=45
            and p["ret20"]>-10
            and p["drawdown"]>-45
        )

        return normal or hot_market

    if h=="medium":
        return (
            p["price"]>p["ma50"]
            and p["ma20"]>=p["ma50"]*0.97
            and technical>=48
            and p["ret60"]>-8
            and p["drawdown"]>-45
        )

    risk = soft_score(
        75+np.clip(
            p["drawdown"],
            -80,
            0
        )*0.70
    )

    return (
        p["price"]>p["ma200"]
        and p["ma50"]>=p["ma200"]*0.95
        and risk>=35
        and p["ret200"]>-15
        and p["drawdown"]>-50
    )

def base_horizon_score(row,p,h):
    base = (
        0.20*float(row.get("valuation",50))
        +0.25*float(row.get("quality",50))
        +0.15*float(row.get("financial",50))
        +0.25*float(row.get("technical",50))
        +0.15*float(row.get("catalyst",50))
    )

    if h=="short":
        return 0.75*base + 0.25*soft_score(
            50
            +np.clip(p["ret20"],-25,25)*1.3
            +np.clip(p["vol_ratio"]-1,-1.5,2.5)*12
        )

    if h=="medium":
        return 0.85*base + 0.15*soft_score(
            50
            +np.clip(p["ret60"],-35,35)*0.7
            +np.clip(p["ret120"],-50,50)*0.35
        )

    return 0.90*base + 0.10*soft_score(
        50
        +np.clip(p["ret200"],-60,60)*0.55
    )

def raw_trend_value(p,technical,h):
    if h=="short":
        return (
            0.45*np.clip(p["ret20"],-25,25)
            +0.25*np.clip(p["ret60"],-40,40)
            +0.20*(technical-50)
            +0.10*np.clip(
                (p["vol_ratio"]-1)*20,
                -20,
                30
            )
        )

    if h=="medium":
        return (
            0.25*np.clip(p["ret20"],-25,25)
            +0.45*np.clip(p["ret60"],-40,40)
            +0.20*np.clip(p["ret120"],-60,60)
            +0.10*(technical-50)
        )

    return (
        0.20*np.clip(p["ret60"],-40,40)
        +0.30*np.clip(p["ret120"],-60,60)
        +0.40*np.clip(p["ret200"],-80,80)
        +0.10*(technical-50)
    )

def build_group_trends(rows,prices,sectors,h):
    groups = {}

    for row in rows:
        code = str(row.get("code",""))
        p = prices.get(code)

        if not p:
            continue

        theme = theme_for(
            code,
            row.get("name",""),
            sectors.get(code,"その他")
        )

        groups.setdefault(
            theme,
            []
        ).append(
            raw_trend_value(
                p,
                float(row.get("technical",50)),
                h
            )
        )

    med = {
        g:float(np.median(v))
        for g,v in groups.items()
        if len(v)>=2
    }

    if not med:
        return {}

    vals = np.array(
        list(med.values()),
        dtype=float
    )

    lo,hi = np.percentile(
        vals,
        [10,90]
    )

    span = max(
        hi-lo,
        1e-6
    )

    return {
        g:round(
            clamp(
                25+60*(v-lo)/span,
                20,
                88
            ),
            1
        )
        for g,v in med.items()
    }

def diversified_top20(candidates,strongest_group):
    selected = []
    counts = {}
    skipped = []

    for item in candidates:
        group = item["_group"]

        cap = (
            4
            if group==strongest_group
            else 3
        )

        if counts.get(group,0)>=cap:
            skipped.append(item)
            continue

        selected.append(item)
        counts[group] = counts.get(group,0)+1

        if len(selected)==20:
            return selected

    used = {
        x["code"]
        for x in selected
    }

    for item in skipped:
        if len(selected)>=20:
            break

        if item["code"] in used:
            continue

        group = item["_group"]

        if group=="銀行" and counts.get("銀行",0)>=4:
            continue

        selected.append(item)
        counts[group] = counts.get(group,0)+1
        used.add(item["code"])

    return selected[:20]
    
def main():
    data = json.loads(
        DATA.read_text(
            encoding="utf-8"
        )
    )

    japan = data.get(
        "japan",
        {}
    )

    all_rows = japan.get(
        "all",
        []
    )

    if not all_rows:
        raise RuntimeError(
            "japan.all is empty"
        )

    sectors = load_jpx_sector_map()

    codes = [
        str(x.get("code",""))
        for x in all_rows
        if x.get("code")
    ]

    prices = download_prices(
        codes
    )

    market_heat = build_market_heat(
        prices
    )

    trend_summary = {}
    out = {}

    for h in (
        "short",
        "medium",
        "long"
    ):
        trends = build_group_trends(
            all_rows,
            prices,
            sectors,
            h
        )

        strongest = (
            max(
                trends,
                key=trends.get
            )
            if trends
            else None
        )

        trend_summary[h] = sorted(
            [
                {
                    "theme":k,
                    "score":v
                }
                for k,v in trends.items()
            ],
            key=lambda x:x["score"],
            reverse=True
        )[:8]

        theme_w = {
            "short":0.10,
            "medium":0.08,
            "long":0.05
        }[h]

        heat_w = {
            "short":0.32,
            "medium":0.12,
            "long":0.05
        }[h]

        candidates = []

        for row in all_rows:
            code = str(
                row.get(
                    "code",
                    ""
                )
            )

            p = prices.get(code)

            if not p:
                continue

            technical = float(
                row.get(
                    "technical",
                    50
                )
            )

            heat = market_heat.get(
                code,
                50
            )

            if not horizon_ok(
                p,
                technical,
                h,
                heat
            ):
                continue

            group = theme_for(
                code,
                row.get("name",""),
                sectors.get(
                    code,
                    "その他"
                )
            )

            base = base_horizon_score(
                row,
                p,
                h
            )

            trend_score = trends.get(
                group,
                50
            )

            total = clamp(
                (
                    1
                    -theme_w
                    -heat_w
                )*base
                +theme_w*trend_score
                +heat_w*heat,
                8,
                92
            )

            signal = (
                "最有力"
                if total>=80
                else "有力"
                if total>=65
                else "注目"
                if total>=50
                else "見送り"
            )

            catalyst = float(
                row.get(
                    "catalyst",
                    50
                )
            )

            item = {
                "name":row.get(
                    "name",
                    ""
                ),
                "code":code,
                "price":round(
                    p["price"],
                    2
                ),
                "change_pct":round(
                    p["change_pct"],
                    2
                ),
                "score":round(
                    total,
                    1
                ),
                "signal":signal,
                "valuation":float(
                    row.get(
                        "valuation",
                        50
                    )
                ),
                "quality":float(
                    row.get(
                        "quality",
                        50
                    )
                ),
                "financial":float(
                    row.get(
                        "financial",
                        50
                    )
                ),
                "technical":technical,
                "catalyst":catalyst,
                "trend_theme":group,
                "trend_score":round(
                    trend_score,
                    1
                ),
                "market_heat":round(
                    heat,
                    1
                ),
                "grades":{
                    "valuation":grade(
                        float(
                            row.get(
                                "valuation",
                                50
                            )
                        )
                    ),
                    "quality":grade(
                        float(
                            row.get(
                                "quality",
                                50
                            )
                        )
                    ),
                    "financial":grade(
                        float(
                            row.get(
                                "financial",
                                50
                            )
                        )
                    ),
                    "technical":grade(
                        technical
                    ),
                    "catalyst":grade(
                        catalyst
                    )
                },
                "_group":group
            }

            candidates.append(
                item
            )

        candidates.sort(
            key=lambda x:x["score"],
            reverse=True
        )

        chosen = diversified_top20(
            candidates,
            strongest
        )

        for x in chosen:
            x.pop(
                "_group",
                None
            )

        out[h] = chosen

    out["all"] = all_rows

    data["japan"] = out

    data["trend_engine"] = {
        "version":"2.0-market-heat",
        "description":"JPX業種分散 + 動的テーマ + 市場熱量",
        "theme_weights":{
            "short":10,
            "medium":8,
            "long":5
        },
        "market_heat_weights":{
            "short":28,
            "medium":10,
            "long":4
        },
        "market_heat_components":{
            "出来高順位":30,
            "売買代金順位":35,
            "出来高急増率":20,
            "当日騰落率":15
        },
        "sector_cap":"通常3銘柄、最強トレンドのみ4銘柄",
        "top_trends":trend_summary
    }

    DATA.write_text(
        json.dumps(
            data,
            ensure_ascii=False,
            indent=2
        ),
        encoding="utf-8"
    )

    print(
        "market heat adjustment completed"
    )

if __name__=="__main__":
    main()
