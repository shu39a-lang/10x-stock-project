from pathlib import Path
import json,re,time
import yfinance as yf
ROOT=Path(__file__).resolve().parent
DATA=ROOT/"tenx_data.json"

def clean(code): return str(code or "").strip().upper().replace(".T","")
def symbol(market,code):
    c=clean(code)
    return c+".T" if market=="japan" else c
def english(v):
    s=str(v or "").strip()
    return s if s and re.search(r"[A-Za-z]",s) else ""
def fetch_name(sym):
    try:
        info=yf.Ticker(sym).info or {}
        for k in ("longName","shortName","displayName"):
            n=english(info.get(k))
            if n:return n
    except Exception: pass
    return ""

def main():
    data=json.loads(DATA.read_text(encoding="utf-8"))
    for market in ("japan","usa"):
        g=data.get(market) or {}
        codes=[]
        for key in ("all","short","medium","mid","long"):
            for row in g.get(key) or []:
                c=clean(row.get("code"))
                if c and c not in codes: codes.append(c)
        names={}
        for i,c in enumerate(codes,1):
            n=fetch_name(symbol(market,c))
            if n:names[c]=n
            if i%20==0:time.sleep(0.2)
        for key in ("all","short","medium","mid","long"):
            for row in g.get(key) or []:
                n=names.get(clean(row.get("code")),"")
                if n:
                    row["name_en"]=n
                    row["name"]=n
    sm={"最有力":"Top Pick","有力":"Strong","注目":"Watch","見送り":"Pass"}
    for market in ("japan","usa"):
        for key in ("short","medium","mid","long"):
            for row in (data.get(market) or {}).get(key) or []:
                if row.get("signal") in sm: row["signal"]=sm[row["signal"]]
    DATA.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding="utf-8")
    print("English display names applied.")
if __name__=="__main__":main()
