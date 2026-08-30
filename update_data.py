import json, time
from pathlib import Path
from datetime import datetime, timezone, timedelta

import numpy as np
import pandas as pd
import yfinance as yf

R = Path(__file__).parent
JST = timezone(timedelta(hours=9))

JP = {
    "6857.T":"アドバンテスト","8035.T":"東京エレクトロン","6920.T":"レーザーテック",
    "7974.T":"任天堂","6701.T":"NEC","7011.T":"三菱重工業","5803.T":"フジクラ",
    "9984.T":"ソフトバンクグループ","7203.T":"トヨタ自動車","6758.T":"ソニーグループ",
    "6501.T":"日立製作所","7013.T":"IHI","6146.T":"ディスコ","4063.T":"信越化学工業",
    "8306.T":"三菱UFJ FG","8316.T":"三井住友FG","8411.T":"みずほFG","9432.T":"NTT",
    "9433.T":"KDDI","9434.T":"ソフトバンク","8058.T":"三菱商事","8001.T":"伊藤忠商事",
    "8031.T":"三井物産","7267.T":"ホンダ","6902.T":"デンソー","6954.T":"ファナック",
    "6367.T":"ダイキン工業","6981.T":"村田製作所","6594.T":"ニデック","6762.T":"TDK",
    "7741.T":"HOYA","7733.T":"オリンパス","4568.T":"第一三共","4519.T":"中外製薬",
    "4502.T":"武田薬品工業","6098.T":"リクルートHD","4661.T":"オリエンタルランド",
    "2914.T":"JT","3382.T":"セブン＆アイHD","9983.T":"ファーストリテイリング",
    "8766.T":"東京海上HD","8725.T":"MS&AD","8630.T":"SOMPO HD","1605.T":"INPEX",
    "5401.T":"日本製鉄","9101.T":"日本郵船","9104.T":"商船三井","9107.T":"川崎汽船",
    "6503.T":"三菱電機","6504.T":"富士電機"
}

US = {
    "NVDA":"NVIDIA","AMD":"AMD","AVGO":"Broadcom","MSFT":"Microsoft","GOOGL":"Alphabet",
    "AMZN":"Amazon","META":"Meta Platforms","AAPL":"Apple","TSLA":"Tesla","PLTR":"Palantir",
    "MU":"Micron","ARM":"Arm Holdings","CRWD":"CrowdStrike","NFLX":"Netflix","LLY":"Eli Lilly",
    "ORCL":"Oracle","CRM":"Salesforce","ADBE":"Adobe","INTC":"Intel","QCOM":"Qualcomm",
    "TXN":"Texas Instruments","AMAT":"Applied Materials","LRCX":"Lam Research","KLAC":"KLA",
    "ASML":"ASML","TSM":"TSMC","SMCI":"Super Micro Computer","PANW":"Palo Alto Networks",
    "NOW":"ServiceNow","UBER":"Uber","SHOP":"Shopify","COIN":"Coinbase","JPM":"JPMorgan",
    "BAC":"Bank of America","GS":"Goldman Sachs","V":"Visa","MA":"Mastercard","COST":"Costco",
    "WMT":"Walmart","HD":"Home Depot","UNH":"UnitedHealth","ABBV":"AbbVie","MRK":"Merck",
    "XOM":"Exxon Mobil","CVX":"Chevron","CAT":"Caterpillar","GE":"GE Aerospace","BA":"Boeing",
    "DIS":"Disney","BKNG":"Booking Holdings"
}

def clamp(v, lo=0, hi=100):
    try:
        return float(np.clip(float(v), lo, hi))
    except Exception:
        return 50.0

def soft_score(raw):
    try:
        raw = float(raw)
        return float(np.clip(
            50.0 + 42.0 * np.tanh((raw - 50.0) / 32.0),
            8.0, 92.0
        ))
    except Exception:
        return 50.0

def shrink_to_neutral(value, available, expected):
    if expected <= 0:
        return 50.0
    confidence = clamp(available / expected, 0, 1)
    return 50.0 + (float(value) - 50.0) * confidence

def rsi(series, period=14):
    d = series.diff()
    up = d.clip(lower=0).rolling(period).mean()
    dn = (-d.clip(upper=0)).rolling(period).mean()
    rs = up / dn.replace(0, np.nan)
    out = 100 - 100 / (1 + rs)
    return float(out.iloc[-1]) if len(out) and pd.notna(out.iloc[-1]) else 50.0

def grade(v):
    return "A" if v >= 80 else "B" if v >= 65 else "C" if v >= 50 else "D"

def mean_with_confidence(values, expected):
    vals = [float(v) for v in values if v is not None and np.isfinite(v)]
    if not vals:
        return 50.0
    return shrink_to_neutral(float(np.mean(vals)), len(vals), expected)

def info_scores(symbol):
    try:
        info = yf.Ticker(symbol).info or {}
    except Exception:
        return {
            "valuation":50.0,
            "quality":50.0,
            "financial":50.0,
            "catalyst":50.0
        }

    mc = info.get("marketCap")
    cash = info.get("totalCash")
    debt = info.get("totalDebt")
    ps = info.get("priceToSalesTrailing12Months")
    pe = info.get("trailingPE")
    pb = info.get("priceToBook")
    rg = info.get("revenueGrowth")
    eg = info.get("earningsGrowth")
    roe = info.get("returnOnEquity")
    pm = info.get("profitMargins")
    fcf = info.get("freeCashflow")
    ocf = info.get("operatingCashflow")
    de = info.get("debtToEquity")

    vals = []
    if ps is not None and float(ps) >= 0:
        vals.append(soft_score(72 - float(ps) * 4.0))
    if pe is not None and float(pe) > 0:
        vals.append(soft_score(75 - float(pe) * 0.8))
    if pb is not None and float(pb) > 0:
        vals.append(soft_score(75 - float(pb) * 4.0))
    if mc and float(mc) > 0 and cash is not None and debt is not None:
        vals.append(soft_score(
            50 + ((float(cash) - float(debt)) / float(mc)) * 40
        ))
    valuation = mean_with_confidence(vals, 4)

    q = []
    if rg is not None:
        q.append(soft_score(50 + float(rg) * 100))
    if eg is not None:
        q.append(soft_score(50 + float(eg) * 90))
    if roe is not None:
        q.append(soft_score(50 + (float(roe) - 0.10) * 120))
    if pm is not None:
        q.append(soft_score(50 + (float(pm) - 0.08) * 100))
    if fcf is not None and mc and float(mc) > 0:
        q.append(soft_score(
            50 + (float(fcf) / float(mc)) * 300
        ))
    quality = mean_with_confidence(q, 5)

    f = []
    if ocf is not None:
        f.append(65.0 if float(ocf) > 0 else 35.0)
    if de is not None:
        f.append(soft_score(70 - float(de) * 0.20))
    if mc and float(mc) > 0 and cash is not None and debt is not None:
        f.append(soft_score(
            50 + ((float(cash) - float(debt)) / float(mc)) * 45
        ))
    financial = mean_with_confidence(f, 3)

    cat = []
    if eg is not None:
        cat.append(soft_score(50 + float(eg) * 70))
    if rg is not None:
        cat.append(soft_score(50 + float(rg) * 60))
    catalyst = mean_with_confidence(cat, 2)

    return {
        "valuation": round(clamp(valuation, 8, 92), 1),
        "quality": round(clamp(quality, 8, 92), 1),
        "financial": round(clamp(financial, 8, 92), 1),
        "catalyst": round(clamp(catalyst, 8, 92), 1),
    }

def analyze(symbol, name):
    d = yf.download(
        symbol,
        period="2y",
        auto_adjust=False,
        progress=False,
        threads=False
    )

    if isinstance(d.columns, pd.MultiIndex):
        d.columns = d.columns.get_level_values(0)

    if len(d) < 210:
        return None

    d = d.dropna(subset=["Close"])
    c = d["Close"].astype(float)
    v = d["Volume"].astype(float).reindex(c.index).fillna(0)

    last = float(c.iloc[-1])
    prev = float(c.iloc[-2])
    ma20 = float(c.rolling(20).mean().iloc[-1])
    ma50 = float(c.rolling(50).mean().iloc[-1])
    ma200 = float(c.rolling(200).mean().iloc[-1])

    rsi14 = rsi(c)

    e12 = c.ewm(span=12, adjust=False).mean()
    e26 = c.ewm(span=26, adjust=False).mean()
    macd = e12 - e26
    sig = macd.ewm(span=9, adjust=False).mean()

    macd_gap = float(
        (macd.iloc[-1] - sig.iloc[-1]) /
        max(last, 0.01) * 100
    )

    vol20 = float(v.rolling(20).mean().iloc[-1])
    vol_ratio = float(v.iloc[-1] / max(vol20, 1))
    avg_value20 = float((c * v).rolling(20).mean().iloc[-1])

    high60 = float(c.rolling(60).max().iloc[-1])

    drawdown = float(
        (c / c.cummax() - 1).tail(250).min() * 100
    )

    ret20 = float((last / c.iloc[-21] - 1) * 100)
    ret60 = float((last / c.iloc[-61] - 1) * 100)
    ret120 = float((last / c.iloc[-121] - 1) * 100)
    ret200 = float((last / c.iloc[-201] - 1) * 100)

    technical_parts = [
        (0.22, soft_score(
            50 + (last / ma20 - 1) * 250
        )),
        (0.18, soft_score(
            50 + (ma20 / ma50 - 1) * 220
        )),
        (0.15, soft_score(
            50 + (ma50 / ma200 - 1) * 180
        )),
        (0.15, soft_score(
            50 + np.clip(ret20, -25, 25) * 1.2
        )),
        (0.12, soft_score(
            50 + np.clip(macd_gap, -8, 8) * 180
        )),
        (0.10, soft_score(
            50 + np.clip(vol_ratio - 1, -1.5, 2.5) * 18
        )),
        (0.08, soft_score(
            72 - abs(rsi14 - 58) * 1.4
        )),
    ]

    technical = sum(
        weight * score
        for weight, score in technical_parts
    )

    risk = soft_score(
        75 + np.clip(drawdown, -80, 0) * 0.70
    )

    return {
        "symbol":symbol,
        "name":name,
        "code":symbol.replace(".T",""),
        "price":round(last,2),
        "change_pct":round((last/prev-1)*100,2),
        "ma20":ma20,
        "ma50":ma50,
        "ma200":ma200,
        "ret20":ret20,
        "ret60":ret60,
        "ret120":ret120,
        "ret200":ret200,
        "rsi":rsi14,
        "vol_ratio":vol_ratio,
        "avg_value20":avg_value20,
        "drawdown":drawdown,
        "high60":high60,
        "technical":round(clamp(technical,8,92),1),
        "risk":round(clamp(risk,8,92),1),
    }

def make_row(x, s, horizon):

    total = (
        0.20 * s["valuation"] +
        0.25 * s["quality"] +
        0.15 * s["financial"] +
        0.25 * x["technical"] +
        0.15 * s["catalyst"]
    )

    if horizon == "short":
        timing = soft_score(
            50 +
            np.clip(x["ret20"], -25, 25) * 1.3 +
            np.clip(x["vol_ratio"] - 1, -1.5, 2.5) * 12
        )
        total = 0.75 * total + 0.25 * timing

    elif horizon == "medium":
        timing = soft_score(
            50 +
            np.clip(x["ret60"], -35, 35) * 0.7 +
            np.clip(x["ret120"], -50, 50) * 0.35
        )
        total = 0.85 * total + 0.15 * timing

    else:
        timing = soft_score(
            50 +
            np.clip(x["ret200"], -60, 60) * 0.55
        )
        total = 0.90 * total + 0.10 * timing

    total = clamp(total, 8, 92)

    signal = (
        "最有力" if total >= 80
        else "有力" if total >= 65
        else "注目" if total >= 50
        else "見送り"
    )

    proximity = np.clip(
        100 * (x["price"] / x["high60"]) - 90,
        -20,
        10
    )

    catalyst = clamp(
        s["catalyst"] + proximity * 0.8,
        8,
        92
    )

    return {
        "name":x["name"],
        "code":x["code"],
        "price":x["price"],
        "change_pct":x["change_pct"],
        "score":round(total,1),
        "signal":signal,
        "valuation":s["valuation"],
        "quality":s["quality"],
        "financial":s["financial"],
        "technical":x["technical"],
        "catalyst":round(catalyst,1),
        "grades":{
            "valuation":grade(s["valuation"]),
            "quality":grade(s["quality"]),
            "financial":grade(s["financial"]),
            "technical":grade(x["technical"]),
            "catalyst":grade(catalyst),
        }
    }

def rank(universe, market):

    rows = []

    for symbol, name in universe.items():
        try:
            x = analyze(symbol, name)

            min_value = (
                300_000_000
                if market == "japan"
                else 20_000_000
            )

            if x and x["avg_value20"] >= min_value:
                rows.append(x)

        except Exception as e:
            print("price error", symbol, e)

    fundamentals = {}

    for x in rows:
        try:
            fundamentals[x["symbol"]] = info_scores(
                x["symbol"]
            )
            time.sleep(0.08)

        except Exception:
            fundamentals[x["symbol"]] = {
                "valuation":50.0,
                "quality":50.0,
                "financial":50.0,
                "catalyst":50.0
            }

    out = {}

    for horizon in ["short","medium","long"]:

        candidates = []

        for x in rows:

            if horizon == "short":
                ok = (
                    x["price"] > x["ma20"] * 0.97
                    and 38 <= x["rsi"] <= 82
                )

            elif horizon == "medium":
                ok = (
                    x["price"] > x["ma50"] * 0.95
                    and x["ret60"] > -12
                )

            else:
                ok = (
                    x["price"] > x["ma200"] * 0.90
                    and x["drawdown"] > -55
                )

            if ok:
                candidates.append(
                    make_row(
                        x,
                        fundamentals[x["symbol"]],
                        horizon
                    )
                )

        out[horizon] = sorted(
            candidates,
            key=lambda z:z["score"],
            reverse=True
        )[:10]

    return out

now = datetime.now(JST)

data = {
    "updated_at":
        now.strftime("%Y-%m-%d %H:%M JST"),

    "engine_version":
        "3.1-precision-balanced",

    "scoring":{
        "valuation":20,
        "quality_growth":25,
        "financial_safety":15,
        "technical":25,
        "catalyst":15
    },

    "japan":rank(JP,"japan"),
    "usa":rank(US,"usa"),
}

(R / "tenx_data.json").write_text(
    json.dumps(
        data,
        ensure_ascii=False,
        indent=2
    ),
    encoding="utf-8"
)

try:
    history = json.loads(
        (R / "tenx_history.json")
        .read_text(encoding="utf-8")
    )

    if not isinstance(history,list):
        history=[]

except Exception:
    history=[]

baseline={}

for item in sorted(
    history,
    key=lambda z:str(
        z.get("date","9999-99-99")
    )
):
    key=(
        item.get("market"),
        item.get("horizon"),
        str(item.get("code"))
    )

    if (
        key not in baseline
        and item.get("buy_price") is not None
    ):
        baseline[key]=item

for m in ("japan","usa"):

    for q in ("short","medium","long"):

        for x in data[m][q]:

            key=(
                m,
                q,
                str(x["code"])
            )

            if key not in baseline:

                baseline[key]={
                    "date":
                        now.strftime("%Y-%m-%d"),
                    "market":m,
                    "horizon":q,
                    "code":x["code"],
                    "name":x["name"],
                    "buy_price":x["price"],
                    "shares":100
                }

history=sorted(
    baseline.values(),
    key=lambda z:(
        str(z.get("date","")),
        str(z.get("market","")),
        str(z.get("horizon","")),
        str(z.get("code",""))
    )
)

(R / "tenx_history.json").write_text(
    json.dumps(
        history,
        ensure_ascii=False,
        indent=2
    ),
    encoding="utf-8"
)
