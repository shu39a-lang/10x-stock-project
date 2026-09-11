(()=>{
"use strict";

const $=s=>document.querySelector(s);
let DATA_CACHE=null;

async function loadTenxData(){
  if(DATA_CACHE)return DATA_CACHE;
  const url="https://shu39a-lang.github.io/10x-stock-project/tenx_data.json?t="+Date.now();
  const r=await fetch(url,{cache:"no-store"});
  if(!r.ok)throw new Error("tenx_data "+r.status);
  DATA_CACHE=await r.json();
  return DATA_CACHE;
}

function cleanCode(v){
  return String(v||"").trim().toUpperCase().replace(/\.T$/i,"");
}

function findStockRecursive(node,code,seen=new Set()){
  if(!node||typeof node!=="object"||seen.has(node))return null;
  seen.add(node);
  if(Array.isArray(node)){
    for(const x of node){
      if(x&&typeof x==="object"&&cleanCode(x.code)===code)return x;
      const hit=findStockRecursive(x,code,seen);
      if(hit)return hit;
    }
    return null;
  }
  for(const v of Object.values(node)){
    const hit=findStockRecursive(v,code,seen);
    if(hit)return hit;
  }
  return null;
}

async function dataName(market,code){
  try{
    const d=await loadTenxData();
    const hit=findStockRecursive(d?.[market],code);
    return hit&&String(hit.name||"").trim()?String(hit.name).trim():"";
  }catch(e){
    return "";
  }
}

async function yahooDirect(market,code){
  const symbol=market==="japan"?code+".T":code;
  const url="https://query1.finance.yahoo.com/v8/finance/chart/"+
    encodeURIComponent(symbol)+"?interval=1d&range=5d&events=history&_="+Date.now();

  try{
    let data=null;
    const cap=window.Capacitor;
    const http=cap?.Plugins?.CapacitorHttp;

    if(http?.get){
      const r=await http.get({
        url,
        headers:{"Accept":"application/json"}
      });
      data=typeof r.data==="string"?JSON.parse(r.data):r.data;
    }else{
      const r=await fetch(url,{cache:"no-store"});
      if(!r.ok)throw new Error("HTTP "+r.status);
      data=await r.json();
    }

    const meta=data?.chart?.result?.[0]?.meta;
    if(!meta)return null;

    const price=Number(meta.regularMarketPrice);

    return{
      price:Number.isFinite(price)&&price>0?price:null,
      name:String(meta.longName||meta.shortName||"").trim(),
      source:"Yahoo"
    };
  }catch(e){
    return null;
  }
}

function renderLookup(market,name,price,source){
  const nameEl=$("#nameInput");
  const nowEl=$("#nowInput");
  const st=$("#lookupStatus");
  if(!nameEl||!nowEl||!st)return;

  if(name){
    nameEl.value=name;
    nameEl.readOnly=true;
  }else{
    nameEl.readOnly=false;
  }

  if(Number.isFinite(price)&&price>0){
    nowEl.value=price;
    nowEl.readOnly=true;
  }else{
    nowEl.value="";
    nowEl.readOnly=false;
  }

  if(name&&Number.isFinite(price)&&price>0){
    st.style.color="#55dc7f";
    st.textContent="✓ "+name+" ｜ 現在値 "+
      (market==="japan"?"¥":"$")+
      Number(price).toLocaleString(undefined,{
        minimumFractionDigits:market==="usa"?2:0,
        maximumFractionDigits:2
      })+
      (source?" ｜ "+source:"");
  }else if(name){
    st.style.color="#ffc928";
    st.textContent="✓ "+name+" を確認しました。現在値は取得できませんでした。";
  }else{
    st.style.color="#ffc928";
    st.textContent="自動取得できませんでした。会社名と現在値を手入力できます。";
  }
}

const oldLookup=
  typeof window.zeroLookupStock==="function"
    ?window.zeroLookupStock
    :null;

window.zeroLookupStock=async function(){
  const market=$("#marketInput")?.value||"japan";
  const codeEl=$("#codeInput");
  const code=cleanCode(codeEl?.value);

  if(codeEl)codeEl.value=code;

  if(!code){
    const st=$("#lookupStatus");
    if(st){
      st.style.color="#93a2b5";
      st.textContent="コードを入力すると会社名と現在値を確認します。";
    }
    return null;
  }

  const st=$("#lookupStatus");
  if(st){
    st.style.color="#93a2b5";
    st.textContent="会社名・現在値を検索中…";
  }

  let base=null;

  if(oldLookup){
    try{
      base=await oldLookup();
    }catch(e){}
  }

  const preferredName=await dataName(market,code);
  const basePrice=Number(base?.price);
  let direct=null;

  if(!(Number.isFinite(basePrice)&&basePrice>0)||market==="usa"){
    direct=await yahooDirect(market,code);
  }

  const price=
    Number.isFinite(basePrice)&&basePrice>0
      ?basePrice
      :Number(direct?.price);

  let name="";

  if(market==="japan"){
    name=
      preferredName ||
      String(base?.name||"").trim() ||
      String(direct?.name||"").trim();
  }else{
    name=
      String(base?.name||"").trim() ||
      String(direct?.name||"").trim() ||
      preferredName;
  }

  const source=base?.source||direct?.source||"";

  renderLookup(
    market,
    name,
    Number.isFinite(price)?price:null,
    source
  );

  return{
    market,
    code,
    name,
    price:Number.isFinite(price)?price:null,
    source
  };
};

const codeEl=$("#codeInput");
const marketEl=$("#marketInput");

if(codeEl){
  codeEl.addEventListener("change",()=>window.zeroLookupStock());
  codeEl.addEventListener("blur",()=>window.zeroLookupStock());
  codeEl.addEventListener("keyup",e=>{
    if(e.key==="Enter")window.zeroLookupStock();
  });
}

if(marketEl){
  marketEl.addEventListener("change",()=>{
    if(codeEl?.value.trim())window.zeroLookupStock();
  });
}

})();
