(function(){
"use strict";

const $ = s => document.querySelector(s);

function clamp(n){
  return Math.max(0,Math.min(100,Math.round(n)));
}

function avg(a){
  return a.length ? a.reduce((x,y)=>x+y,0)/a.length : 0;
}

function pct(a,b){
  if(!Number.isFinite(a)||!Number.isFinite(b)||b===0)return 0;
  return (a/b-1)*100;
}

async function fetchHistory(){
  const market=$("#marketInput")?.value||"japan";
  let code=($("#codeInput")?.value||"").trim().toUpperCase().replace(/\.T$/i,"");
  if(!code)return;

  const symbol=market==="japan"?code+".T":code;

  try{
    const url=
      "https://query1.finance.yahoo.com/v8/finance/chart/"
      +encodeURIComponent(symbol)
      +"?interval=1d&range=1y&events=history";

    const r=await fetch(url,{cache:"no-store"});
    if(!r.ok)throw new Error("HTTP "+r.status);

    const j=await r.json();
    const result=j?.chart?.result?.[0];
    const q=result?.indicators?.quote?.[0];

    if(!q)throw new Error("no data");

    const closes=(q.close||[])
      .map(Number)
      .filter(Number.isFinite);

    const volumes=(q.volume||[])
      .map(Number)
      .filter(Number.isFinite);

    if(closes.length<20)throw new Error("insufficient data");

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
    ?pct(current,prices[prices.length-6]):0;

  const p20=prices.length>=21
    ?pct(current,prices[prices.length-21]):0;

  const p60=prices.length>=61
    ?pct(current,prices[prices.length-61]):p20;

  const ma20=avg(prices.slice(-20));
  const vsMa20=pct(current,ma20);

  const returns=[];
  for(let i=Math.max(1,prices.length-20);i<prices.length;i++){
    returns.push(Math.abs(pct(prices[i],prices[i-1])));
  }

  const volatility=avg(returns);

  const valueScore=clamp(100-position);

  const growthScore=clamp(
    50 + p20*1.5 + p60*0.7
  );

  const stabilityScore=clamp(
    85 - volatility*12
  );

  const technicalScore=clamp(
    50 + p5*2.2 + p20*0.9 + vsMa20*1.8
  );

  let volumeScore=50;

  if(volumes.length>=21){
    const recent=avg(volumes.slice(-5));
    const base=avg(volumes.slice(-20));

    if(base>0){
      const ratio=recent/base;
      volumeScore=clamp(
        50 + (ratio-1)*35 + p5*1.5
      );
    }
  }

  const scores={
    valuation:valueScore,
    quality:growthScore,
    financial:stabilityScore,
    technical:technicalScore,
    catalyst:volumeScore
  };

  Object.entries(scores).forEach(([id,val])=>{
    const el=$("#"+id);
    if(el){
      el.value=val;
      el.dispatchEvent(new Event("input",{bubbles:true}));
    }
  });
}

let timer=null;

function schedule(){
  clearTimeout(timer);
  timer=setTimeout(fetchHistory,700);
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
    const url="https://query1.finance.yahoo.com/v8/finance/chart/"+
      encodeURIComponent(symbol)+"?interval=1d&range=5d&_="+Date.now();
    const r=await http.get({url,headers:{"Accept":"application/json"}});
    const data=typeof r.data==="string" ? JSON.parse(r.data) : r.data;
    const p=Number(data?.chart?.result?.[0]?.meta?.regularMarketPrice);
    return Number.isFinite(p) && p>0 ? p : null;
  }catch(e){ return null; }
}

async function fetchHoldingPrice(market,code){
  const clean=String(code||"").trim().toUpperCase().replace(/\.T$/i,"");
  return await quoteFromSameOrigin(market,clean)
      ?? await quoteFromBundledFile(market,clean)
      ?? await quoteFromCapacitor(market,clean);
}

window.updateHoldingNow=async function(i){
  const h=(typeof holdings==="function") ? holdings() : [];
  const item=h[i];
  if(!item) return;

  const btn=document.querySelector(`button[onclick="updateHoldingNow(${i})"]`);
  const oldText=btn?.textContent || "現在値を反映";
  if(btn){
    btn.disabled=true;
    btn.textContent="現在値を取得中…";
  }

  try{
    const p=await fetchHoldingPrice(item.market,item.code);

    if(Number.isFinite(p) && p>0){
      item.now=p;
      if(typeof setJSON==="function") setJSON("tenx_zero_holdings",h);
      if(typeof renderPortfolio==="function") renderPortfolio();
      return;
    }

    const el=document.getElementById("holdNow"+i);
    const manual=Number(el?.value);
    if(Number.isFinite(manual) && manual>0 && manual!==Number(item.now)){
      item.now=manual;
      if(typeof setJSON==="function") setJSON("tenx_zero_holdings",h);
      if(typeof renderPortfolio==="function") renderPortfolio();
      return;
    }

    alert("最新株価を取得できませんでした。通信状態を確認してもう一度押すか、現在値を手入力してください。");
  }finally{
    if(btn && document.body.contains(btn)){
      btn.disabled=false;
      btn.textContent=oldText;
    }
  }
};

if(document.readyState==="loading"){
  document.addEventListener("DOMContentLoaded",patchLabels,{once:true});
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
    }catch(e){ return fallback; }
  };
  return {
    version:"1.0",
    exportedAt:new Date().toISOString(),
    holdings:typeof holdings==="function" ? holdings() : read("tenx_zero_holdings",[]),
    favorites:typeof favorites==="function" ? favorites() : read("tenx_zero_favorites",[]),
    history:typeof history==="function" ? history() : read("tenx_zero_history",[])
  };
}

async function saveBackup(){
  try{
    const text=JSON.stringify(buildBackupData(),null,2);
    const file=new File([text],"10X_STOCK_ZERO_backup.json",{type:"application/json"});

    if(navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))){
      await navigator.share({
        files:[file],
        title:"10X STOCK ZERO バックアップ"
      });
      return;
    }

    const blob=new Blob([text],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download="10X_STOCK_ZERO_backup.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }catch(e){
    if(e && e.name==="AbortError") return;
    console.error("backup save failed",e);
    alert("バックアップを保存できませんでした。もう一度お試しください。");
  }
}

function installBackupFix(){
  const btn=document.getElementById("exportBtn");
  if(!btn) return;
  btn.textContent="バックアップを保存";
  btn.addEventListener("click",function(ev){
    ev.preventDefault();
    ev.stopImmediatePropagation();
    saveBackup();
  },true);
}

if(document.readyState==="loading"){
  document.addEventListener("DOMContentLoaded",installBackupFix,{once:true});
}else{
  installBackupFix();
}
})();
