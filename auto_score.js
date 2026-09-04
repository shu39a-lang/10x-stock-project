(function(){
"use strict";

const $ = s => document.querySelector(s);

function clamp(n,min=0,max=100){
  if(!Number.isFinite(n)) return 50;
  return Math.max(min,Math.min(max,n));
}

/*
  極端な0点・100点への張り付きを抑える。
  通常の値動きではおおむね8〜92点に収まり、
  本当に強い/弱い場合だけ端へ近づく。
*/
function squashScore(raw){
  if(!Number.isFinite(raw)) return 50;
  const score = 50 + 42 * Math.tanh((raw - 50) / 32);
  return Math.round(clamp(score,5,95));
}

function avg(a){
  const v=a.filter(Number.isFinite);
  return v.length ? v.reduce((x,y)=>x+y,0)/v.length : null;
}

function median(a){
  const v=a.filter(Number.isFinite).sort((x,y)=>x-y);
  if(!v.length) return null;
  const m=Math.floor(v.length/2);
  return v.length%2 ? v[m] : (v[m-1]+v[m])/2;
}

function pct(a,b){
  if(!Number.isFinite(a)||!Number.isFinite(b)||b===0) return null;
  return (a/b-1)*100;
}

function capped(v,min,max,neutral=0){
  if(!Number.isFinite(v)) return neutral;
  return clamp(v,min,max);
}

async function fetchHistory(){
  const market=$("#marketInput")?.value||"japan";
  let code=($("#codeInput")?.value||"")
    .trim()
    .toUpperCase()
    .replace(/\.T$/i,"");

  if(!code)return;

  const symbol=market==="japan" ? code+".T" : code;

  try{
    let data=null;

    // iPhoneアプリ内ではCapacitorHttpを優先
    const cap=window.Capacitor;
    const http=cap?.Plugins?.CapacitorHttp;

    if(http?.get){
      const url=
        "https://query1.finance.yahoo.com/v8/finance/chart/"
        +encodeURIComponent(symbol)
        +"?interval=1d&range=1y&events=history&_="
        +Date.now();

      const r=await http.get({
        url,
        headers:{"Accept":"application/json"}
      });

      data=typeof r.data==="string"
        ?JSON.parse(r.data)
        :r.data;
    }else{
      // Web版・PWA版
      const url=
        "https://query1.finance.yahoo.com/v8/finance/chart/"
        +encodeURIComponent(symbol)
        +"?interval=1d&range=1y&events=history&_="
        +Date.now();

      const r=await fetch(url,{cache:"no-store"});
      if(!r.ok)throw new Error("HTTP "+r.status);

      data=await r.json();
    }

    const result=data?.chart?.result?.[0];
    const q=result?.indicators?.quote?.[0];

    if(!q)throw new Error("no data");

    const closes=(q.close||[])
      .map(Number)
      .filter(Number.isFinite);

    const volumes=(q.volume||[])
      .map(Number)
      .filter(Number.isFinite);

    if(closes.length<20)
      throw new Error("insufficient data");

    applyScore(closes,volumes);

  }catch(e){
    console.log("auto score fetch failed",e);
  }
}
function applyScore(prices,volumes){
  const current=prices[prices.length-1];

  const high52=Math.max(...prices);
  const low52=Math.min(...prices);

  const position=
    high52===low52 ? 50 :
    ((current-low52)/(high52-low52))*100;

  const p5=prices.length>=6
    ?pct(current,prices[prices.length-6]):null;

  const p20=prices.length>=21
    ?pct(current,prices[prices.length-21]):null;

  const p60=prices.length>=61
    ?pct(current,prices[prices.length-61]):null;

  const ma20=avg(prices.slice(-20));
  const ma60=prices.length>=60 ? avg(prices.slice(-60)) : null;

  const vsMa20=pct(current,ma20);
  const maTrend=pct(ma20,ma60);

  const returns=[];
  for(let i=Math.max(1,prices.length-30);i<prices.length;i++){
    const r=Math.abs(pct(prices[i],prices[i-1]));
    if(Number.isFinite(r)) returns.push(r);
  }

  /*
    単日の異常値に引っ張られにくいよう、
    平均ではなく中央値ベースで変動性を評価。
  */
  const volatility=median(returns);

  /*
    valuation:
    52週レンジだけで0/100を決めず、
    安値圏・高値圏の位置を緩やかに評価。
  */
  const rawValue=
    72 - capped(position,0,100,50)*0.44;

  /*
    quality:
    20日・60日の上昇率を使う。
    異常な急騰・急落は上限を設けて影響を抑える。
  */
  const rawGrowth=
    50
    + capped(p20,-25,25)*0.90
    + capped(p60,-40,40)*0.45;

  /*
    financial:
    この画面では財務諸表を直接取得していないため、
    値動きの安定性を代理指標として使う。
    データ不足時は50点付近の中立評価。
  */
  const rawStability=
    Number.isFinite(volatility)
      ? 78 - capped(volatility,0,10)*5.5
      : 50;

  /*
    technical:
    短期モメンタムだけでなく、
    20日移動平均・中期トレンドも組み合わせる。
  */
  const rawTechnical=
    50
    + capped(p5,-12,12)*1.35
    + capped(p20,-25,25)*0.60
    + capped(vsMa20,-15,15)*1.10
    + capped(maTrend,-12,12)*0.55;

  /*
    catalyst:
    出来高急増を評価するが、
    1日の異常出来高だけで100点にならないよう制限。
  */
  let rawVolume=50;

  if(volumes.length>=21){
    const recent=avg(volumes.slice(-5));
    const base=avg(volumes.slice(-20));

    if(Number.isFinite(recent)&&Number.isFinite(base)&&base>0){
      const ratio=recent/base;

      rawVolume=
        50
        + capped((ratio-1)*25,-22,22)
        + capped(p5,-12,12)*0.70;
    }
  }

  const scores={
    valuation:squashScore(rawValue),
    quality:squashScore(rawGrowth),
    financial:squashScore(rawStability),
    technical:squashScore(rawTechnical),
    catalyst:squashScore(rawVolume)
  };

  Object.entries(scores).forEach(([id,val])=>{
    const el=$("#"+id);
    if(el){
      el.value=val;
      el.dispatchEvent(new Event("input",{bubbles:true}));
    }
  });
}

const code=$("#codeInput");
const market=$("#marketInput");

if(code){
  code.addEventListener("change",fetchHistory);
  code.addEventListener("blur",fetchHistory);
  code.addEventListener("keyup",e=>{
    if(e.key==="Enter")fetchHistory();
  });
}

if(market){
  market.addEventListener("change",()=>{
    if(code?.value.trim())fetchHistory();
  });
}

})();

/* BUILD 28 - public release final fixes:
   1) Holding "現在値を反映" fetches latest quote automatically when possible.
   2) Backup labels are clearer.
   3) US screener is replaced with a Japanese-language Japan stocks link.
*/
(function(){
"use strict";

const q = s => document.querySelector(s);

function patchLabels(){
  const exportBtn=q("#exportBtn");
  const importBtn=q("#importBtn");
  if(exportBtn) exportBtn.textContent="バックアップを保存";
  if(importBtn) importBtn.textContent="バックアップから復元";

  const screener=q("#screenerBtn");
  if(screener){
    screener.innerHTML="<b>🇯🇵</b>日本株スクリーナー<br>日本語で銘柄を絞り込み";
    screener.onclick=()=>{
      location.href="https://jp.tradingview.com/markets/stocks-japan/market-movers-all-stocks/";
    };
  }

  document.querySelectorAll(".guideStep").forEach(el=>{
    if(el.textContent.includes("米国株スクリーナー")){
      el.innerHTML=el.innerHTML.replace("米国株スクリーナー","日本株スクリーナー");
    }
  });

  document.querySelectorAll(".disclaimer").forEach(el=>{
    if(el.textContent.includes("市場データの自動取得は行いません")){
      el.textContent="保有株の現在値は取得可能な市場データから更新します。取得できない場合は手入力できます。特定銘柄の売買を推奨するものではありません。";
    }
  });
}

async function quoteFromSameOrigin(market,code){
  try{
    const r=await fetch(
      "/api/stock?market="+encodeURIComponent(market)+
      "&code="+encodeURIComponent(code)+"&t="+Date.now(),
      {cache:"no-store",headers:{"accept":"application/json"}}
    );
    if(!r.ok) return null;
    const x=await r.json();
    const p=Number(x?.price);
    return x?.ok && Number.isFinite(p) && p>0 ? p : null;
  }catch(e){ return null; }
}

async function quoteFromBundledFile(market,code){
  try{
    const r=await fetch("live_quotes.json?t="+Date.now(),{cache:"no-store"});
    if(!r.ok) return null;
    const x=await r.json();
    const row=x?.[market]?.[code] || x?.quotes?.[market]?.[code];
    const p=Number(row?.price);
    return Number.isFinite(p) && p>0 ? p : null;
  }catch(e){ return null; }
}

async function quoteFromCapacitor(market,code){
  try{
    const cap=window.Capacitor;
    const http=cap?.Plugins?.CapacitorHttp;
    if(!http?.get) return null;

    const symbol=market==="japan" ? code+".T" : code;

    const url=
      "https://query1.finance.yahoo.com/v8/finance/chart/"
      +encodeURIComponent(symbol)
      +"?interval=1d&range=5d&_="+Date.now();

    const r=await http.get({
      url,
      headers:{"Accept":"application/json"}
    });

    const data=typeof r.data==="string"
      ?JSON.parse(r.data)
      :r.data;

    const p=Number(
      data?.chart?.result?.[0]?.meta?.regularMarketPrice
    );

    return Number.isFinite(p)&&p>0 ? p : null;

  }catch(e){ return null; }
}

async function fetchHoldingPrice(market,code){
  const clean=String(code||"")
    .trim()
    .toUpperCase()
    .replace(/\.T$/i,"");

  const p1=await quoteFromCapacitor(market,clean);
  if(Number.isFinite(p1)&&p1>0) return p1;

  const p2=await quoteFromSameOrigin(market,clean);
  if(Number.isFinite(p2)&&p2>0) return p2;

  const p3=await quoteFromBundledFile(market,clean);
  if(Number.isFinite(p3)&&p3>0) return p3;

  return null;
}

window.updateHoldingNow=async function(i){
  const h=(typeof holdings==="function") ? holdings() : [];
  const item=h[i];

  if(!item) return;

  const btn=document.querySelector(
    `button[onclick="updateHoldingNow(${i})"]`
  );

  const oldText=btn?.textContent || "現在値を反映";

  if(btn){
    btn.disabled=true;
    btn.textContent="現在値を取得中…";
  }

  try{
    const p=await fetchHoldingPrice(item.market,item.code);

    if(Number.isFinite(p)&&p>0){
      item.now=p;

      if(typeof setJSON==="function")
        setJSON("tenx_zero_holdings",h);

      if(typeof renderPortfolio==="function")
        renderPortfolio();

      return;
    }

    const el=document.getElementById("holdNow"+i);
    const manual=Number(el?.value);

    if(
      Number.isFinite(manual)&&
      manual>0&&
      manual!==Number(item.now)
    ){
      item.now=manual;

      if(typeof setJSON==="function")
        setJSON("tenx_zero_holdings",h);

      if(typeof renderPortfolio==="function")
        renderPortfolio();

      return;
    }

    alert(
      "最新株価を取得できませんでした。通信状態を確認してもう一度押すか、現在値を手入力してください。"
    );

  }finally{
    if(btn&&document.body.contains(btn)){
      btn.disabled=false;
      btn.textContent=oldText;
    }
  }
};

if(document.readyState==="loading"){
  document.addEventListener(
    "DOMContentLoaded",
    patchLabels,
    {once:true}
  );
}else{
  patchLabels();
}

})();

/* BUILD 29 - iOS backup save fix */
(function(){
"use strict";

function buildBackupData(){
  const read=(key,fallback)=>{
    try{
      const v=JSON.parse(localStorage.getItem(key));
      return v ?? fallback;
    }catch(e){
      return fallback;
    }
  };

  return {
    version:"1.0",
    exportedAt:new Date().toISOString(),
    holdings:
      typeof holdings==="function"
        ?holdings()
        :read("tenx_zero_holdings",[]),
    favorites:
      typeof favorites==="function"
        ?favorites()
        :read("tenx_zero_favorites",[]),
    history:
      typeof history==="function"
        ?history()
        :read("tenx_zero_history",[])
  };
}

async function saveBackup(){
  try{
    const text=JSON.stringify(
      buildBackupData(),
      null,
      2
    );

    const file=new File(
      [text],
      "10X_STOCK_ZERO_backup.json",
      {type:"application/json"}
    );

    if(
      navigator.share &&
      (!navigator.canShare ||
       navigator.canShare({files:[file]}))
    ){
      await navigator.share({
        files:[file],
        title:"10X STOCK ZERO バックアップ"
      });
      return;
    }

    const blob=new Blob(
      [text],
      {type:"application/json"}
    );

    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");

    a.href=url;
    a.download="10X_STOCK_ZERO_backup.json";

    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(
      ()=>URL.revokeObjectURL(url),
      1500
    );

  }catch(e){
    if(e&&e.name==="AbortError") return;

    console.error(
      "backup save failed",
      e
    );

    alert(
      "バックアップを保存できませんでした。もう一度お試しください。"
    );
  }
}

function installBackupFix(){
  const btn=document.getElementById("exportBtn");
  if(!btn) return;

  btn.textContent="バックアップを保存";

  btn.addEventListener(
    "click",
    function(ev){
      ev.preventDefault();
      ev.stopImmediatePropagation();
      saveBackup();
    },
    true
  );
}

if(document.readyState==="loading"){
  document.addEventListener(
    "DOMContentLoaded",
    installBackupFix,
    {once:true}
  );
}else{
  installBackupFix();
}

})();
/* BUILD 50 - use analyzed scores from tenx_data.json */
(function(){
"use strict";

async function applyTenxScore(){
  const market=document.querySelector("#marketInput")?.value || "japan";
  const code=(document.querySelector("#codeInput")?.value || "")
    .trim().toUpperCase().replace(/\.T$/i,"");

  if(!code) return;

  try{
    const r=await fetch("tenx_data.json?t="+Date.now(),{cache:"no-store"});
    if(!r.ok) return;

    const data=await r.json();
    const group=data?.[market];
    if(!group) return;

    const lists=[
      group.short,
      group.medium,
      group.mid,
      group.long
    ].filter(Array.isArray);

    let stock=null;

    for(const list of lists){
      stock=list.find(x =>
        String(x?.code || "").toUpperCase().replace(/\.T$/i,"")===code
      );
      if(stock) break;
    }

    if(!stock) return;

    const values={
      valuation:Number(stock.valuation),
      quality:Number(stock.quality),
      financial:Number(stock.financial),
      technical:Number(stock.technical),
      catalyst:Number(stock.catalyst)
    };

    Object.entries(values).forEach(([id,val])=>{
      if(!Number.isFinite(val)) return;
      const el=document.querySelector("#"+id);
      if(!el) return;
      el.value=Math.round(val);
      el.dispatchEvent(new Event("input",{bubbles:true}));
    });

  }catch(e){
    console.log("tenx score load failed",e);
  }
}

const code=document.querySelector("#codeInput");
const market=document.querySelector("#marketInput");

if(code){
  code.addEventListener("change",applyTenxScore);
  code.addEventListener("blur",applyTenxScore);
  code.addEventListener("keyup",e=>{
    if(e.key==="Enter") applyTenxScore();
  });
}

if(market){
  market.addEventListener("change",()=>{
    if(code?.value.trim()) applyTenxScore();
  });
}
})();
/* BUILD 51 - force score update while ticker is entered */
(function(){
"use strict";

let timer=null;

async function forceTenxScore(){
  const market=document.querySelector("#marketInput")?.value || "japan";
  const code=(document.querySelector("#codeInput")?.value || "")
    .trim().toUpperCase().replace(/\.T$/i,"");

  if(!code) return;

  try{
    const r=await fetch("tenx_data.json?t="+Date.now(),{cache:"no-store"});
    if(!r.ok) return;

    const data=await r.json();
    const group=data?.[market];
    if(!group) return;

    const lists=[
      group.short,
      group.medium,
      group.mid,
      group.long
    ].filter(Array.isArray);

    let stock=null;

    for(const list of lists){
      stock=list.find(x =>
        String(x?.code || "").trim().toUpperCase().replace(/\.T$/i,"")===code
      );
      if(stock) break;
    }

    if(!stock) return;

    const scores={
      valuation:stock.valuation,
      quality:stock.quality,
      financial:stock.financial,
      technical:stock.technical,
      catalyst:stock.catalyst
    };

    Object.entries(scores).forEach(([id,value])=>{
      const n=Number(value);
      const el=document.querySelector("#"+id);
      if(!el || !Number.isFinite(n)) return;

      el.value=Math.round(n);
      el.dispatchEvent(new Event("input",{bubbles:true}));
    });

  }catch(e){
    console.log("force score failed",e);
  }
}

const code=document.querySelector("#codeInput");

if(code){
  code.addEventListener("input",()=>{
    clearTimeout(timer);
    timer=setTimeout(forceTenxScore,300);
  });

  code.addEventListener("change",forceTenxScore);
  code.addEventListener("blur",forceTenxScore);
}

window.forceTenxScore=forceTenxScore;

})();
