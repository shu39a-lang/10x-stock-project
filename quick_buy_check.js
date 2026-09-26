(()=>{
"use strict";

/* 10X STOCK ZERO
   Quick buy check + cross-platform stable SVG icon patch
   Android/iPhone display consistency fix
*/

const SVG = {
  chart: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="11" width="4" height="9" rx="1" fill="#40c77a"/><rect x="10" y="6" width="4" height="14" rx="1" fill="#2f8cff"/><rect x="17" y="3" width="4" height="17" rx="1" fill="#ff4a5f"/></svg>`,
  rise: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17L10 11L14 14L20 6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 6H20V11" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  fall: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7L10 13L14 10L20 18" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 18H20V13" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  bars: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="4" height="8" rx="1" fill="#fff"/><rect x="10" y="7" width="4" height="13" rx="1" fill="#fff"/><rect x="17" y="3" width="4" height="17" rx="1" fill="#fff"/></svg>`,
  flame: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 2.5c.8 4-2.3 5.2-1 8.1 1-1.1 1.9-2 2.3-3.8 3.3 2.3 5.2 5 4.5 8.4-.7 3.5-3.6 6-7.3 6-4.2 0-7.5-2.8-7.5-7 0-3.7 2.4-6.4 5.5-8.9-.1 2.7.8 4.2 2 5.1.4-3 3.5-4.2 1.5-7.9z" fill="#ff5a36"/><path d="M12.1 12c1.8 1.2 2.7 2.5 2.4 4.1-.2 1.4-1.3 2.6-2.8 2.6-1.7 0-3-1.2-3-2.8 0-1.5.9-2.5 2.1-3.6 0 1 .3 1.7.8 2.1.1-1.1.8-1.6.5-2.4z" fill="#ffd34d"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="#fff" stroke-width="2"/><path d="M3 9h18M8 3v4M16 3v4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M7 13h3M14 13h3M7 17h3M14 17h3" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  rocket: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4c3-2 6-1 6-1s1 3-1 6l-6 6-4-4 5-7z" fill="#fff"/><circle cx="16" cy="7" r="1.7" fill="#2688ff"/><path d="M8 12l-3 1-2 4 5-1M12 16l-1 5 4-2 1-3" fill="#fff"/><path d="M7 17l-3 3M9 18l-2 3" stroke="#ffd34d" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  map: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2V5z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><path d="M9 3v16M15 5v16" stroke="#fff" stroke-width="1.7"/></svg>`,
  search: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="#fff" stroke-width="2.3"/><path d="M15.5 15.5L21 21" stroke="#fff" stroke-width="2.3" stroke-linecap="round"/></svg>`,
  trophy: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10v4c0 4-2 7-5 7S7 11 7 7V3z" fill="#ffc73d"/><path d="M7 5H3v2c0 3 2 5 5 5M17 5h4v2c0 3-2 5-5 5" fill="none" stroke="#ffc73d" stroke-width="2"/><path d="M12 14v4M8 21h8M9 18h6" stroke="#ffc73d" stroke-width="2" stroke-linecap="round"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="#fff" stroke-width="2"/><path d="M12 7v5l3 2" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  clipboard: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2" fill="none" stroke="#fff" stroke-width="2"/><path d="M9 4V2h6v2M8 9h8M8 13h8M8 17h6" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>`
};

function icon(name, size=24){
  return `<span class="tenx-svg-icon" style="width:${size}px;height:${size}px">${SVG[name]||SVG.chart}</span>`;
}

function installIconStyles(){
  if(document.getElementById("tenxStableIconStyle")) return;
  const st=document.createElement("style");
  st.id="tenxStableIconStyle";
  st.textContent=`
    .tenx-svg-icon{display:inline-flex;align-items:center;justify-content:center;vertical-align:-.16em;flex:0 0 auto}
    .tenx-svg-icon svg{display:block;width:100%;height:100%}
    #quickBuyCheck .qb-title .tenx-svg-icon,
    #marketInfoLinks .sectiontitle .tenx-svg-icon{margin-right:5px}
    #mainCta .tenx-svg-icon{width:23px!important;height:23px!important}
  `;
  document.head.appendChild(st);
}

function patchStableIcons(){
  installIconStyles();

  const qbTitle=document.querySelector("#quickBuyCheck .qb-title");
  if(qbTitle && qbTitle.dataset.stableIcon!=="1"){
    qbTitle.innerHTML=icon("chart",23)+" 買いタイミング診断";
    qbTitle.dataset.stableIcon="1";
  }

  const mainIcon=document.querySelector("#mainCta .icon");
  if(mainIcon && mainIcon.dataset.stableIcon!=="1"){
    mainIcon.innerHTML=icon("rise",23);
    mainIcon.dataset.stableIcon="1";
  }

  const rankingTitle=document.querySelector("#rankingTitle");
  if(rankingTitle && !rankingTitle.querySelector(".tenx-svg-icon")){
    const txt=rankingTitle.textContent.replace(/^🏆\s*/,"").trim();
    rankingTitle.innerHTML=icon("trophy",25)+" "+txt;
  }

  document.querySelectorAll("#marketInfoLinks .sectiontitle").forEach(el=>{
    const t=el.textContent.trim();
    if(t.includes("データ・ランキング")){
      el.innerHTML=icon("chart",22)+" データ・ランキング";
    }else if(t.includes("注目・急増・高値")){
      el.innerHTML=icon("flame",22)+" 注目・急増・高値";
    }else if(t.includes("分析・検索")){
      el.innerHTML=icon("clipboard",22)+" 分析・検索";
    }
  });

  const cardIcons=[
    ["値上がり","rise"],["値下がり","fall"],["出来高\nランキング","bars"],
    ["出来高\n急増","flame"],["決算カレンダー","calendar"],["52週高値","rocket"],
    ["セクター動向","map"],["スクリーナー","search"]
  ];
  document.querySelectorAll("#marketInfoLinks > div[style*='grid-template-columns:repeat(4,1fr)'] > div").forEach(card=>{
    const text=card.innerText.replace(/\s+/g," ").trim();
    let name=null;
    if(text.includes("値上がり")) name="rise";
    else if(text.includes("値下がり")) name="fall";
    else if(text.includes("出来高 急増")) name="flame";
    else if(text.includes("出来高 ランキング")) name="bars";
    else if(text.includes("決算カレンダー")) name="calendar";
    else if(text.includes("52週高値")) name="rocket";
    else if(text.includes("セクター動向")) name="map";
    else if(text.includes("スクリーナー")) name="search";
    if(name){
      const first=card.firstElementChild;
      if(first && first.dataset.stableIcon!=="1"){
        first.innerHTML=icon(name,27);
        first.dataset.stableIcon="1";
      }
    }
  });

  const individual=document.querySelector("#individualBtn b");
  if(individual && individual.dataset.stableIcon!=="1"){
    individual.innerHTML=icon("search",27);
    individual.dataset.stableIcon="1";
  }

  document.querySelectorAll("div").forEach(el=>{
    if(el.children.length===0 && el.textContent.includes("TOP10 データ更新時間") && el.dataset.stableIcon!=="1"){
      el.innerHTML=icon("clock",17)+" TOP10 データ更新時間（日本時間）";
      el.dataset.stableIcon="1";
    }
  });

  document.querySelectorAll("[data-home-target]").forEach(btn=>{
    const t=btn.textContent.trim();
    if(t.includes("買いタイミング診断") && btn.dataset.stableIcon!=="1"){
      btn.innerHTML=icon("chart",18)+" 買いタイミング診断";
      btn.dataset.stableIcon="1";
    }else if(t.includes("TOP10ランキング") && btn.dataset.stableIcon!=="1"){
      btn.innerHTML=icon("trophy",18)+" TOP10ランキング";
      btn.dataset.stableIcon="1";
    }else if(t.includes("データ・ランキング") && btn.dataset.stableIcon!=="1"){
      btn.innerHTML=icon("chart",18)+" データ・ランキング";
      btn.dataset.stableIcon="1";
    }
  });
}

/* ---- Original buy timing diagnosis ---- */

const box=document.createElement("div");
box.id="quickBuyCheck";
box.innerHTML=`
<style>
#quickBuyCheck{margin:10px 0 12px;padding:12px;border:2px solid #ffc73d;border-radius:14px;background:linear-gradient(145deg,#07131f,#091b2b);box-shadow:0 0 18px rgba(255,199,61,.18)}
#quickBuyCheck .qb-title{font-size:18px;font-weight:1000}
#quickBuyCheck .qb-sub{font-size:10px;color:#a8b4c2;margin:4px 0 10px}
#quickBuyCheck .qb-input{display:grid;grid-template-columns:1fr 90px;gap:7px}
#quickBuyCheck input{width:100%;min-width:0;height:44px;padding:0 11px;color:#fff;background:#091725;border:1px solid #31506c;border-radius:10px;font-size:16px}
#quickBuyCheck button{height:44px;border:1px solid #e0ac2b;border-radius:10px;background:linear-gradient(135deg,#ffd76a,#e9a91d);color:#151009;font-weight:1000}
#qbStatus{margin-top:7px;color:#93a2b5;font-size:10px}
#qbResult{margin-top:10px}
.qb-stock{display:flex;justify-content:space-between;gap:8px;border-top:1px solid #294157;padding-top:10px}
.qb-name{font-size:16px;font-weight:1000}.qb-price{text-align:right;font-size:15px;font-weight:1000}
.qb-main{margin-top:9px;padding:11px;border-radius:11px;text-align:center}.qb-main small{display:block;color:#d5dde6;font-size:10px}.qb-main strong{display:block;margin-top:3px;font-size:25px}
.qb-main.strong{border:1px solid #ff3454;background:linear-gradient(110deg,#6f091f,#260914)}
.qb-main.buy{border:1px solid #49dc80;background:linear-gradient(110deg,#0d5830,#082619)}
.qb-main.care{border:1px solid #ffc73d;background:linear-gradient(110deg,#57410a,#251d08)}
.qb-main.watch{border:1px solid #2688ff;background:linear-gradient(110deg,#092c62,#07182c)}
.qb-main.strong strong{color:#ff526c}.qb-main.buy strong{color:#55dc7f}.qb-main.care strong{color:#ffd34f}.qb-main.watch strong{color:#4fa2ff}
.qb-gauges{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:10px}
.qb-gauge{border:1px solid #294157;border-radius:11px;background:#081522;padding:8px 3px 7px;text-align:center}
.qb-gauge-title{font-size:10px;font-weight:1000;margin-bottom:3px}.qb-gauge svg{width:100%;height:auto;display:block}.qb-gauge-value{margin-top:-2px;font-size:13px;font-weight:1000}
.qb-zone{display:flex;justify-content:space-between;gap:2px;padding:0 3px;margin-top:1px;font-size:6px;color:#7e8fa1}
.qb-reason{margin-top:9px;padding:9px;border:1px solid #294157;border-radius:10px;background:#081522;font-size:10px;line-height:1.55}.qb-reason b{color:#ffc73d}
.qb-detail{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:9px}.qb-detail div{display:flex;justify-content:space-between;padding:7px;border:1px solid #294157;border-radius:8px;background:#081522;font-size:9px}
.qb-note{margin-top:7px;color:#7f90a2;font-size:8px;line-height:1.4}
</style>
<div class="qb-title">${icon("chart",23)} 買いタイミング診断</div>
<div class="qb-sub">気になる銘柄コードを入力して、現在の買い条件を確認</div>
<div class="qb-input"><input id="qbCode" autocomplete="off" autocapitalize="characters" placeholder="7203 / AAPL"><button id="qbRun">診断する</button></div>
<div id="qbStatus">現在の分析データを使って判定します。</div>
<div id="qbResult" hidden></div>`;

const ranking=document.querySelector("#rankingTable");
const rankcard=ranking && ranking.closest(".rankcard");
if(!rankcard)return;
rankcard.insertAdjacentElement("afterend",box);

let DATA_CACHE=null;
const n=(v,d=50)=>{const x=Number(v);return Number.isFinite(x)?x:d};
const clamp=v=>Math.max(0,Math.min(100,v));

async function loadData(){
  if(DATA_CACHE)return DATA_CACHE;
  const r=await fetch("https://shu39a-lang.github.io/10x-stock-project/tenx_data.json?t="+Date.now(),{cache:"no-store"});
  if(!r.ok)throw new Error();
  DATA_CACHE=await r.json();
  return DATA_CACHE;
}
function findStock(data,code){
  code=String(code).trim().toUpperCase().replace(/\.T$/,"");
  for(const market of ["japan","usa"]){
    const g=data[market]||{};
    for(const key of ["short","medium","mid","long","all"]){
      const rows=Array.isArray(g[key])?g[key]:[];
      const hit=rows.find(x=>String(x.code||"").toUpperCase().replace(/\.T$/,"")===code);
      if(hit)return{stock:hit,market};
    }
  }
  return null;
}
function judge(x){
  const score=n(x.score),technical=n(x.technical),quality=n(x.quality),financial=n(x.financial),catalyst=n(x.catalyst);
  const trend=clamp(technical*.55+score*.25+catalyst*.20);
  const total=clamp(score*.50+technical*.25+trend*.25);
  let text="様子見",cls="watch";
  if(total>=70&&technical>=65&&score>=68&&quality>=60&&financial>=50&&catalyst>=70){text="強い買い";cls="strong"}
  else if(total>=60&&technical>=55){text="買い";cls="buy"}
  else if(total>=50){text="慎重";cls="care"}
  return{score,technical,quality,financial,catalyst,trend,total,text,cls};
}
function level(v){
  if(v>=70)return{text:"強い買い",color:"#ff3d5e"};
  if(v>=60)return{text:"買い",color:"#49dc80"};
  if(v>=50)return{text:"慎重",color:"#ffc73d"};
  return{text:"様子見",color:"#288cff"};
}
function gaugeHTML(title,value){
  value=clamp(value);
  const angle=180+(value/100)*180,rad=angle*Math.PI/180,cx=50,cy=48,len=30;
  const x2=cx+Math.cos(rad)*len,y2=cy+Math.sin(rad)*len,lv=level(value);
  return `<div class="qb-gauge"><div class="qb-gauge-title">${title}</div>
  <svg viewBox="0 0 100 58">
  <path d="M15 48 A35 35 0 0 1 85 48" pathLength="100" fill="none" stroke="#288cff" stroke-width="9" stroke-dasharray="22 78" stroke-dashoffset="0" stroke-linecap="round"/>
  <path d="M15 48 A35 35 0 0 1 85 48" pathLength="100" fill="none" stroke="#ffc73d" stroke-width="9" stroke-dasharray="22 78" stroke-dashoffset="-25" stroke-linecap="round"/>
  <path d="M15 48 A35 35 0 0 1 85 48" pathLength="100" fill="none" stroke="#49dc80" stroke-width="9" stroke-dasharray="22 78" stroke-dashoffset="-50" stroke-linecap="round"/>
  <path d="M15 48 A35 35 0 0 1 85 48" pathLength="100" fill="none" stroke="#ff3d5e" stroke-width="9" stroke-dasharray="22 78" stroke-dashoffset="-75" stroke-linecap="round"/>
  <line x1="50" y1="48" x2="${x2}" y2="${y2}" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="50" cy="48" r="4" fill="#fff"/></svg>
  <div class="qb-gauge-value" style="color:${lv.color}">${lv.text}</div><div class="qb-zone"><span>様子見</span><span>慎重</span><span>買い</span><span>強い買い</span></div></div>`;
}
function reasons(j){
  const a=[];
  if(j.score>=70)a.push("総合スコアが高い水準です。");
  else if(j.score>=60)a.push("総合スコアは買いを検討できる水準です。");
  else if(j.score>=50)a.push("総合スコアは慎重に確認したい水準です。");
  else a.push("総合スコアは様子を見たい水準です。");
  if(j.technical>=65)a.push("テクニカル面の勢いは良好です。");
  else if(j.technical<55)a.push("テクニカル面はまだ弱めです。");
  if(j.quality>=65)a.push("企業の質・成長性も高く評価されています。");
  if(j.financial<50)a.push("財務評価には確認余地があります。");
  return a.slice(0,3);
}
const f=v=>Math.round(n(v)*10)/10;
function render(found){
  const x=found.stock,j=judge(x),price=Number(x.price),reason=reasons(j).map(v=>"・"+v).join("<br>");
  document.querySelector("#qbResult").innerHTML=`
  <div class="qb-stock"><div><div class="qb-name">${x.code||""}　${x.name||""}</div><div style="color:#93a2b5;font-size:9px;margin-top:3px">${found.market==="japan"?"日本株":"米国株"}</div></div>
  <div class="qb-price">${Number.isFinite(price)?price.toLocaleString():"－"} ${found.market==="japan"?"円":"USD"}</div></div>
  <div class="qb-main ${j.cls}"><small>総合判断</small><strong>${j.text}</strong></div>
  <div class="qb-gauges">${gaugeHTML("総合",j.total)}${gaugeHTML("テクニカル",j.technical)}${gaugeHTML("トレンド",j.trend)}</div>
  <div class="qb-reason"><b>判断の理由</b><br>${reason}</div>
  <div class="qb-detail">
  <div><span>総合スコア</span><b>${f(j.score)}</b></div><div><span>テクニカル</span><b>${f(j.technical)}</b></div>
  <div><span>品質・成長</span><b>${f(j.quality)}</b></div><div><span>財務</span><b>${f(j.financial)}</b></div>
  <div><span>割安性</span><b>${f(x.valuation)}</b></div><div><span>カタリスト</span><b>${f(j.catalyst)}</b></div>
  </div><div class="qb-note">※この診断は現在の分析データによる判断目安です。将来の株価上昇や利益を保証するものではありません。</div>`;
  document.querySelector("#qbResult").hidden=false;
}
async function run(){
  const code=document.querySelector("#qbCode").value.trim(),status=document.querySelector("#qbStatus");
  if(!code){status.textContent="銘柄コードを入力してください。";return}
  status.textContent="分析しています…";
  try{
    const data=await loadData(),hit=findStock(data,code);
    if(!hit){document.querySelector("#qbResult").hidden=true;status.textContent="現在の分析対象データでは見つかりませんでした。";return}
    render(hit);status.textContent="診断結果を表示しました。";
  }catch(e){status.textContent="分析データを読み込めませんでした。"}
}
document.querySelector("#qbRun").onclick=run;
document.querySelector("#qbCode").addEventListener("keydown",e=>{if(e.key==="Enter")run()});

/* Apply stable icons now, and again after ranking/UI redraws. */
patchStableIcons();
let iconTimer=0;
new MutationObserver(()=>{
  clearTimeout(iconTimer);
  iconTimer=setTimeout(patchStableIcons,40);
}).observe(document.body,{childList:true,subtree:true,characterData:true});

})();
