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
  code.addEventListener("input",schedule);
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
