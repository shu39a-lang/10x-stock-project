(()=>{
"use strict";

const $=s=>document.querySelector(s);
let TENX_CACHE=null;
let LIVE_CACHE=null;

const ROOT="https://shu39a-lang.github.io/10x-stock-project/";

function cleanCode(v){
  return String(v||"").trim().toUpperCase().replace(/\.T$/i,"");
}

async function loadJson(name){
  const r=await fetch(ROOT+name+"?t="+Date.now(),{cache:"no-store"});
  if(!r.ok)throw new Error(name+" HTTP "+r.status);
  return r.json();
}

async function loadTenxData(){
  if(TENX_CACHE)return TENX_CACHE;
  TENX_CACHE=await loadJson("tenx_data.json");
  return TENX_CACHE;
}

async function loadLiveQuotes(){
  if(LIVE_CACHE)return LIVE_CACHE;
  LIVE_CACHE=await loadJson("live_quotes.json");
  return LIVE_CACHE;
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

async function tenxInfo(market,code){
  try{
    const d=await loadTenxData();
    return findStockRecursive(d?.[market],code);
  }catch(e){
    return null;
  }
}

async function liveInfo(market,code){
  try{
    const d=await loadLiveQuotes();
    const q=d?.[market]?.[code];
    if(!q)return null;
    return{
      name:String(q.name||"").trim(),
      price:Number(q.price),
      source:"live_quotes"
    };
  }catch(e){
    return null;
  }
}

async function yahooDirect(market,code){
  const symbol=market==="japan"?code+".T":code;
  const url="https://query1.finance.yahoo.com/v8/finance/chart/"+
    encodeURIComponent(symbol)+
    "?interval=1d&range=5d&events=history&_="+Date.now();

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

function isUsEnglishFallback(name,code){
  const s=String(name||"").trim();
  if(!s)return true;
  if(s===code)return true;
  // ASCIIだけの名前は、日本語名が他に取れた場合は採用しない
  return /^[\x00-\x7F\s.,&'()\-]+$/.test(s);
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
    nameEl.value="";
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

  const [tenx,live]=await Promise.all([
    tenxInfo(market,code),
    liveInfo(market,code)
  ]);

  let direct=null;

  const livePrice=Number(live?.price);
  const basePrice=Number(base?.price);

  // 価格は live_quotes を最優先。
  // live_quotes に無い時だけ既存処理 → Yahoo の順で補う。
  let price=
    Number.isFinite(livePrice)&&livePrice>0
      ?livePrice
      :Number.isFinite(basePrice)&&basePrice>0
        ?basePrice
        :null;

  if(!(Number.isFinite(price)&&price>0)){
    direct=await yahooDirect(market,code);
    const p=Number(direct?.price);
    if(Number.isFinite(p)&&p>0)price=p;
  }

  const tenxName=String(tenx?.name||"").trim();
  const liveName=String(live?.name||"").trim();
  const baseName=String(base?.name||"").trim();
  const directName=String(direct?.name||"").trim();

  let name="";

  if(market==="japan"){
    // 日本株は日本語データを最優先。
    name=tenxName||liveName||baseName||directName||code;
  }else{
    // 米国株も日本語名を優先。
    // tenx_data / live_quotes / 既存処理の順で日本語名を採用。
    const candidates=[tenxName,liveName,baseName];
    name=candidates.find(n=>n&&!isUsEnglishFallback(n,code))||"";

    // 日本語名が見つからない場合のみ、既存表示を維持。
    if(!name){
      name=tenxName||liveName||baseName||directName||code;
    }
  }

  const source=
    (Number.isFinite(livePrice)&&livePrice>0)
      ?"live_quotes"
      :(base?.source||direct?.source||"");

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
