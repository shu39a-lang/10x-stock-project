import json
from pathlib import Path
from datetime import datetime,timezone,timedelta
import numpy as np, pandas as pd, yfinance as yf
R=Path(__file__).parent; JST=timezone(timedelta(hours=9))
JP={"6857.T":"アドバンテスト","8035.T":"東京エレクトロン","6920.T":"レーザーテック","7974.T":"任天堂","6701.T":"NEC","7011.T":"三菱重工業","5803.T":"フジクラ","9984.T":"ソフトバンクグループ","7203.T":"トヨタ自動車","6758.T":"ソニーグループ","6501.T":"日立製作所","7013.T":"IHI","6146.T":"ディスコ","4063.T":"信越化学工業","8306.T":"三菱UFJ FG"}
US={"NVDA":"NVIDIA","AMD":"AMD","AVGO":"Broadcom","MSFT":"Microsoft","GOOGL":"Alphabet","AMZN":"Amazon","META":"Meta Platforms","AAPL":"Apple","TSLA":"Tesla","PLTR":"Palantir","MU":"Micron","ARM":"Arm Holdings","CRWD":"CrowdStrike","NFLX":"Netflix","LLY":"Eli Lilly"}
def one(s,n):
 d=yf.download(s,period="1y",auto_adjust=True,progress=False,threads=False)
 if isinstance(d.columns,pd.MultiIndex): d.columns=d.columns.get_level_values(0)
 if len(d)<80:return
 c=d.Close.astype(float).dropna();v=d.Volume.astype(float).reindex(c.index).fillna(0);last=float(c.iloc[-1]);prev=float(c.iloc[-2]);r=c.pct_change()
 m20=float(c.rolling(20).mean().iloc[-1]);m50=float(c.rolling(50).mean().iloc[-1]);ret20=(last/float(c.iloc[-21])-1)*100;ret60=(last/float(c.iloc[-61])-1)*100
 e12=c.ewm(span=12).mean();e26=c.ewm(span=26).mean();mac=e12-e26;sig=mac.ewm(span=9).mean()
 trend=np.clip(50+(last/m20-1)*500+(m20/m50-1)*350,0,100);mom=np.clip(50+ret20*2,0,100);ms=np.clip(50+float((mac.iloc[-1]-sig.iloc[-1])/max(last,.01))*5000,0,100)
 vol=np.clip(35+float(v.iloc[-1]/max(v.rolling(20).mean().iloc[-1],1))*30,0,100);rel=np.clip(50+ret60,0,100);risk=np.clip(100-float(r.tail(20).std()*np.sqrt(252)*100),0,100)
 score=.28*trend+.20*mom+.16*ms+.12*vol+.14*rel+.10*risk
 return {"name":n,"code":s.replace(".T",""),"price":round(last,2),"change_pct":round((last/prev-1)*100,2),"score":round(float(score),1),"signal":"最有力" if score>=80 else "有力" if score>=70 else "注目","trend":round(float(trend)),"momentum":round(float(mom)),"macd":round(float(ms)),"volume_score":round(float(vol)),"relative":round(float(rel)),"risk":round(float(risk)),"r20":ret20,"r60":ret60}
def rank(u):
 a=[]
 for s,n in u.items():
  try:
   x=one(s,n)
   if x:a.append(x)
  except Exception as e:print(s,e)
 def clean(x):
  x=dict(x);x.pop("r20",None);x.pop("r60",None);return x
 return {"short":[clean(x) for x in sorted(a,key=lambda x:x["score"],reverse=True)[:5]],"medium":[clean(x) for x in sorted(a,key=lambda x:x["r60"]*.45+x["score"]*.55,reverse=True)[:5]],"long":[clean(x) for x in sorted(a,key=lambda x:x["relative"]*.35+x["trend"]*.35+x["risk"]*.30,reverse=True)[:5]]}
out={"updated_at":datetime.now(JST).strftime("%Y-%m-%d %H:%M JST"),"japan":rank(JP),"usa":rank(US)}
(R/"tenx_data.json").write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding="utf-8")
try:h=json.loads((R/"tenx_history.json").read_text())
except:h=[]
today=datetime.now(JST).strftime("%Y-%m-%d");seen={(x["date"],x["market"],x["horizon"],x["code"]) for x in h}
for m in ("japan","usa"):
 for q in ("short","medium","long"):
  for x in out[m][q]:
   if (today,m,q,x["code"]) not in seen:h.append({"date":today,"market":m,"horizon":q,"code":x["code"],"name":x["name"],"buy_price":x["price"],"shares":100})
(R/"tenx_history.json").write_text(json.dumps(h[-900:],ensure_ascii=False,indent=2),encoding="utf-8")
