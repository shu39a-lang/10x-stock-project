(function(){
"use strict";

function clamp(n){
  return Math.max(0,Math.min(100,Math.round(n)));
}

function avg(a){
  if(!a.length)return null;
  return a.reduce((x,y)=>x+y,0)/a.length;
}

function pct(a,b){
  if(!Number.isFinite(a)||!Number.isFinite(b)||b===0)return null;
  return (a/b-1)*100;
}

function autoScore(data){
  data=data||{};

  const prices=Array.isArray(data.prices)
    ? data.prices.map(Number).filter(Number.isFinite)
    : [];

  let price=Number(data.price);

  if(!Number.isFinite(price)&&prices.length){
    price=prices[prices.length-1];
  }

  let valuation=50;
  let quality=50;
  let financial=50;
  let technical=50;
  let catalyst=50;

  if(Number.isFinite(Number(data.pe))){
    valuation+=(20-Number(data.pe))*1.4;
  }

  if(Number.isFinite(Number(data.pb))){
    valuation+=(2-Number(data.pb))*7;
  }

  if(Number.isFinite(Number(data.revenueGrowth))){
    quality+=Number(data.revenueGrowth)*0.7;
    catalyst+=Number(data.revenueGrowth)*0.25;
  }

  if(Number.isFinite(Number(data.earningsGrowth))){
    quality+=Number(data.earningsGrowth)*0.8;
    catalyst+=Number(data.earningsGrowth)*0.45;
  }

  if(Number.isFinite(Number(data.roe))){
    quality+=(Number(data.roe)-10)*1.1;
  }

  if(Number.isFinite(Number(data.equityRatio))){
    financial+=(Number(data.equityRatio)-40)*0.7;
  }

  if(Number.isFinite(Number(data.debtToEquity))){
    financial+=(1-Number(data.debtToEquity))*15;
  }

  const moves=[];

  if(prices.length>=2){
    const p=pct(price,prices[prices.length-2]);
    if(p!==null)moves.push(50+p*5);
  }

  if(prices.length>=6){
    const p=pct(price,prices[prices.length-6]);
    if(p!==null){
      moves.push(50+p*2.5);
      catalyst+=p*1.2;
    }
  }

  if(prices.length>=21){
    const p=pct(price,prices[prices.length-21]);
    if(p!==null)moves.push(50+p*1.3);

    const ma20=avg(prices.slice(-20));
    const m=pct(price,ma20);
    if(m!==null)moves.push(50+m*2);
  }

  if(moves.length){
    technical=avg(moves);
  }

  valuation=clamp(valuation);
  quality=clamp(quality);
  financial=clamp(financial);
  technical=clamp(technical);
  catalyst=clamp(catalyst);

  const total=clamp(
    valuation*0.20+
    quality*0.25+
    financial*0.15+
    technical*0.25+
    catalyst*0.15
  );

  return {
    valuation,
    quality,
    financial,
    technical,
    catalyst,
    total
  };
}

window.TenXAutoScore={
  calculate:autoScore
};

})();
