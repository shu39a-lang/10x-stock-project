import json, math, time
from pathlib import Path
from datetime import datetime, timezone, timedelta

import numpy as np
import pandas as pd
import yfinance as yf

R = Path(__file__).parent
JST = timezone(timedelta(hours=9))

# 比較対象を以前より拡大。
# まずは流動性が高く、継続的にデータを取りやすい銘柄群から精度を上げる。
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
    except:
        return 0.0

def rsi(series, period=14):
    d = series.diff()
    up = d.clip(lower=0).rolling(period).mean()
    dn = (-d.clip(upper=0)).rolling(period).mean()
    rs = up / dn.replace(0, np.nan)
    out = 100 - (100 / (1 + rs))
    return float(out.iloc[-1]) if len(out) and pd.notna(out.iloc[-1]) else 50.0

def atr_pct(df, period=14):
    h, l, c = df["High"], df["Low"], df["Close"]
    pc = c.shift(1)
    tr = pd.concat([(h-l).abs(), (h-pc).abs(), (l-pc).abs()], axis=1).max(axis=1)
    atr = tr.rolling(period).mean().iloc[-1]
    last = c.iloc[-1]
    return float(atr / last * 100) if last and pd.notna(atr) else 99.0

def max_drawdown(c):
    peak = c.cummax()
    dd = c / peak - 1
    return float(dd.min() * 100)

def safe_ret(c, n):
    if len(c) <= n:
        return 0.0
    return float((c.iloc[-1] / c.iloc[-n-1] - 1) * 100)

def fundamental_score(symbol):
    # 取得失敗や欠損があってもランキング全体を止めない
    try:
        info = yf.Ticker(symbol).info or {}
    except Exception:
        return {"score":50.0,"available":False}

    vals = []
    rg = info.get("revenueGrowth")
    eg = info.get("earningsGrowth")
    roe = info.get("returnOnEquity")
    de = info.get("debtToEquity")
    fcf = info.get("freeCashflow")
    mc = info.get("marketCap")

    if rg is not None:
        vals.append(clamp(50 + float(rg)*120))
    if eg is not None:
        vals.append(clamp(50 + float(eg)*100))
    if roe is not None:
        vals.append(clamp(float(roe)*250))
    if de is not None:
        vals.append(clamp(100 - float(de)*0.45))
    if fcf is not None and mc:
        vals.append(clamp(50 + (float(fcf)/float(mc))*700))

    return {
        "score": round(float(np.mean(vals)),1) if vals else 50.0,
        "available": bool(vals)
    }

def analyze(symbol, name):
    d = yf.download(symbol, period="2y", auto_adjust=True, progress=False, threads=False)
    if isinstance(d.columns, pd.MultiIndex):
        d.columns = d.columns.get_level_values(0)
    need = {"Open","High","Low","Close","Volume"}
    if len(d) < 220 or not need.issubset(d.columns):
        return None

    d = d.dropna(subset=["Close"])
    c = d["Close"].astype(float)
    v = d["Volume"].astype(float).reindex(c.index).fillna(0)

    last = float(c.iloc[-1])
    prev = float(c.iloc[-2])

    ma20 = float(c.rolling(20).mean().iloc[-1])
    ma50 = float(c.rolling(50).mean().iloc[-1])
    ma200 = float(c.rolling(200).mean().iloc[-1])

    ret20 = safe_ret(c,20)
    ret60 = safe_ret(c,60)
    ret120 = safe_ret(c,120)
    ret250 = safe_ret(c,250) if len(c) > 250 else safe_ret(c,200)

    rsi14 = rsi(c,14)
    atr14 = atr_pct(d,14)

    e12 = c.ewm(span=12, adjust=False).mean()
    e26 = c.ewm(span=26, adjust=False).mean()
    macd = e12-e26
    sig = macd.ewm(span=9, adjust=False).mean()
    macd_gap = float((macd.iloc[-1]-sig.iloc[-1]) / max(last,0.01) * 100)

    vol20 = float(v.rolling(20).mean().iloc[-1])
    vol_ratio = float(v.iloc[-1] / max(vol20,1))
    avg_value20 = float((c*v).rolling(20).mean().iloc[-1])

    high20 = float(c.rolling(20).max().iloc[-1])
    high60 = float(c.rolling(60).max().iloc[-1])
    dist_ma20 = (last/ma20-1)*100
    dist_high60 = (last/high60-1)*100
    dd = max_drawdown(c.tail(min(len(c),250)))

    trend_short = clamp(50 + (last/ma20-1)*450 + (ma20/ma50-1)*350)
    trend_mid = clamp(50 + (last/ma50-1)*280 + (ma50/ma200-1)*350)
    trend_long = clamp(50 + (last/ma200-1)*220 + ret250*0.7)

    momentum_short = clamp(50 + ret20*2.2 + ret60*0.5)
    momentum_mid = clamp(50 + ret60*1.0 + ret120*0.6)
    momentum_long = clamp(50 + ret120*0.45 + ret250*0.45)

    volume_score = clamp(45 + (vol_ratio-1)*35)
    macd_score = clamp(50 + macd_gap*350)
    risk_score = clamp(100 - atr14*8 + dd*0.5)
    rsi_short_score = clamp(100 - abs(rsi14-60)*4)
    breakout_score = clamp(100 + dist_high60*8)

    return {
        "symbol":symbol,"name":name,"code":symbol.replace(".T",""),
        "price":round(last,2),"change_pct":round((last/prev-1)*100,2),
        "ma20":ma20,"ma50":ma50,"ma200":ma200,
        "ret20":ret20,"ret60":ret60,"ret120":ret120,"ret250":ret250,
        "rsi":rsi14,"atr":atr14,"vol_ratio":vol_ratio,"avg_value20":avg_value20,
        "dist_ma20":dist_ma20,"dist_high60":dist_high60,"drawdown":dd,
        "trend_short":trend_short,"trend_mid":trend_mid,"trend_long":trend_long,
        "momentum_short":momentum_short,"momentum_mid":momentum_mid,"momentum_long":momentum_long,
        "volume_score":volume_score,"macd_score":macd_score,"risk_score":risk_score,
        "rsi_short_score":rsi_short_score,"breakout_score":breakout_score
    }

def pass_liquidity(x, market):
    # 極端に流動性の低い銘柄は足切り
    if market == "japan":
        return x["avg_value20"] >= 300_000_000  # 平均売買代金3億円/日
    return x["avg_value20"] >= 20_000_000      # 平均売買代金2000万ドル/日

def score_short(x):
    # 短期: 上昇開始・出来高・過熱しすぎないことを重視
    hard = (
        x["price"] > x["ma20"] and
        x["ma20"] >= x["ma50"]*0.985 and
        x["ret20"] > -3 and
        42 <= x["rsi"] <= 78 and
        x["atr"] <= 8.0 and
        x["dist_ma20"] <= 16
    )
    score = (
        0.25*x["trend_short"] +
        0.22*x["momentum_short"] +
        0.18*x["macd_score"] +
        0.15*x["volume_score"] +
        0.12*x["rsi_short_score"] +
        0.08*x["breakout_score"]
    )
    return hard, clamp(score)

def score_medium(x, fscore):
    # 中期: 50/200日トレンド、3〜6か月の上昇継続、業績を重視
    hard = (
        x["price"] > x["ma50"] and
        x["ma50"] >= x["ma200"]*0.97 and
        x["ret60"] > 0 and
        x["ret120"] > -5 and
        x["atr"] <= 7.0
    )
    score = (
        0.28*x["trend_mid"] +
        0.24*x["momentum_mid"] +
        0.14*x["macd_score"] +
        0.10*x["volume_score"] +
        0.10*x["risk_score"] +
        0.14*fscore
    )
    return hard, clamp(score)

def score_long(x, fscore):
    # 長期: 200日線、半年〜1年の上昇、下落耐性、業績・財務を重視
    hard = (
        x["price"] > x["ma200"]*0.95 and
        x["ret120"] > -8 and
        x["ret250"] > -12 and
        x["drawdown"] > -45
    )
    score = (
        0.25*x["trend_long"] +
        0.20*x["momentum_long"] +
        0.20*x["risk_score"] +
        0.10*x["volume_score"] +
        0.25*fscore
    )
    return hard, clamp(score)

def public_row(x, score):
    signal = "最有力" if score >= 82 else "有力" if score >= 72 else "注目"
    return {
        "name":x["name"],"code":x["code"],"price":x["price"],
        "change_pct":x["change_pct"],"score":round(score,1),"signal":signal
    }

def rank(universe, market):
    rows=[]
    for s,n in universe.items():
        try:
            x=analyze(s,n)
            if x and pass_liquidity(x,market):
                rows.append(x)
        except Exception as e:
            print("price error",s,e)

    # 中長期でのみfundamentalを取る。API負荷を抑えるためテクニカル上位候補に限定。
    prelim = sorted(rows, key=lambda x: x["trend_mid"]+x["momentum_mid"], reverse=True)[:30]
    fundamentals={}
    for x in prelim:
        try:
            fundamentals[x["symbol"]] = fundamental_score(x["symbol"])["score"]
            time.sleep(0.12)
        except Exception:
            fundamentals[x["symbol"]] = 50.0

    short_candidates=[]
    medium_candidates=[]
    long_candidates=[]

    for x in rows:
        fs = fundamentals.get(x["symbol"],50.0)

        ok,s = score_short(x)
        if ok: short_candidates.append((s,x))

        ok,s = score_medium(x,fs)
        if ok: medium_candidates.append((s,x))

        ok,s = score_long(x,fs)
        if ok: long_candidates.append((s,x))

    # 条件が厳しすぎて10銘柄未満の場合のみ、足切り通過銘柄からスコア順で補完
    def fill(cands, scorer):
        used={x["symbol"] for _,x in cands}
        fallback=[]
        for x in rows:
            if x["symbol"] in used: continue
            fs=fundamentals.get(x["symbol"],50.0)
            _,s=scorer(x,fs) if scorer!=score_short else scorer(x)
            fallback.append((s,x))
        final=sorted(cands,key=lambda z:z[0],reverse=True)
        if len(final)<10:
            final += sorted(fallback,key=lambda z:z[0],reverse=True)[:10-len(final)]
        return [public_row(x,s) for s,x in final[:10]]

    return {
        "short": fill(short_candidates, score_short),
        "medium": fill(medium_candidates, score_medium),
        "long": fill(long_candidates, score_long)
    }

out={
    "updated_at":datetime.now(JST).strftime("%Y-%m-%d %H:%M JST"),
    "engine_version":"2.0",
    "japan":rank(JP,"japan"),
    "usa":rank(US,"usa")
}

(R/"tenx_data.json").write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding="utf-8")

try:
    h=json.loads((R/"tenx_history.json").read_text(encoding="utf-8"))
    if not isinstance(h,list): h=[]
except:
    h=[]

today=datetime.now(JST).strftime("%Y-%m-%d")
seen={(x.get("date"),x.get("market"),x.get("horizon"),x.get("code")) for x in h}

for m in ("japan","usa"):
    for q in ("short","medium","long"):
        for x in out[m][q]:
            key=(today,m,q,x["code"])
            if key not in seen:
                h.append({
                    "date":today,"market":m,"horizon":q,"code":x["code"],
                    "name":x["name"],"buy_price":x["price"],"shares":100
                })

(R/"tenx_history.json").write_text(
    json.dumps(h[-2400:],ensure_ascii=False,indent=2),encoding="utf-8"
)
