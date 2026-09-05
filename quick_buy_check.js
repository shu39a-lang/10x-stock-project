(()=>{
"use strict";

const box=document.createElement("div");
box.id="quickBuyCheck";
box.innerHTML=`
<style>
#quickBuyCheck{
 margin:10px 0 12px;
 padding:12px;
 border:2px solid #ffc73d;
 border-radius:14px;
 background:linear-gradient(145deg,#07131f,#091b2b);
 box-shadow:0 0 16px rgba(255,199,61,.15)
}
#quickBuyCheck .qb-title{
 font-size:18px;
 font-weight:1000
}
#quickBuyCheck .qb-sub{
 font-size:10px;
 color:#a8b4c2;
 margin:4px 0 10px
}
#quickBuyCheck .qb-input{
 display:grid;
 grid-template-columns:1fr 90px;
 gap:7px
}
#quickBuyCheck input{
 width:100%;
 min-width:0;
 height:44px;
 padding:0 11px;
 color:#fff;
 background:#091725;
 border:1px solid #31506c;
 border-radius:10px;
 font-size:16px
}
#quickBuyCheck button{
 height:44px;
 border:1px solid #e0ac2b;
 border-radius:10px;
 background:linear-gradient(135deg,#ffd76a,#e9a91d);
 font-weight:1000
}
#qbStatus{
 margin-top:7px;
 color:#93a2b5;
 font-size:10px
}
#qbResult{
 margin-top:10px
}
.qb-stock{
 display:flex;
 justify-content:space-between;
 gap:8px;
 border-top:1px solid #294157;
 padding-top:10px
}
.qb-name{
 font-size:16px;
 font-weight:1000
}
.qb-price{
 text-align:right;
 font-size:15px;
 font-weight:1000
}
.qb-main{
 margin-top:9px;
 padding:10px;
 border:1px solid #69364b;
 border-radius:11px;
 background:linear-gradient(110deg,#3d0b1c,#0a1b31)
}
.qb-main small{
 display:block;
 color:#9dacbc
}
.qb-main strong{
 display:block;
 margin-top:3px;
 font-size:24px
}
.qb-buy{color:#ff6077}
.qb-watch{color:#ffc73d}
.qb-care{color:#a9b6c5}
.qb-three{
 display:grid;
 grid-template-columns:repeat(3,1fr);
 gap:6px;
 margin-top:9px
}
.qb-card{
 padding:8px 4px;
 text-align:center;
 border:1px solid #294157;
 border-radius:10px;
 background:#081522
}
.qb-card span{
 display:block;
 font-size:9px;
 color:#9aa9b8
}
.qb-card b{
 display:block;
 margin-top:4px;
 font-size:14px
}
.qb-reason{
 margin-top:9px;
 padding:9px;
 border:1px solid #294157;
 border-radius:10px;
 background:#081522;
 font-size:10px;
 line-height:1.55
}
.qb-reason b{color:#ffc73d}
.qb-detail{
 display:grid;
 grid-template-columns:1fr 1fr;
 gap:5px;
 margin-top:9px
}
.qb-detail div{
 display:flex;
 justify-content:space-between;
 padding:7px;
 border:1px solid #294157;
 border-radius:8px;
 background:#081522;
 font-size:9px
}
.qb-note{
 margin-top:7px;
 color:#7f90a2;
 font-size:8px;
 line-height:1.4
}
</style>

<div class="qb-title">📊 買い判断クイック診断 ⚡</div>
<div class="qb-sub">気になる銘柄コードを入力して、現在の買い条件を確認</div>

<div class="qb-input">
 <input id="qbCode"
  autocomplete="off"
  autocapitalize="characters"
  placeholder="7203 / AAPL">
 <button id="qbRun">診断する</button>
</div>

<div id="qbStatus">
 現在の分析データを使って判定します。
</div>

<div id="qbResult" hidden></div>
`;

const ranking=document.querySelector("#rankingTable");
const rankcard=ranking && ranking.closest(".rankcard");

if(!rankcard)return;

rankcard.insertAdjacentElement("afterend",box);

let DATA_CACHE=null;

const n=(v,d=50)=>{
 const x=Number(v);
 return Number.isFinite(x)?x:d;
};

const clamp=v=>Math.max(0,Math.min(100,v));

async function loadData(){
 if(DATA_CACHE)return DATA_CACHE;

 const r=await fetch(
  "tenx_data.json?t="+Date.now(),
  {cache:"no-store"}
 );

 if(!r.ok)throw new Error();

 DATA_CACHE=await r.json();
 return DATA_CACHE;
}

function findStock(data,code){
 code=String(code)
  .trim()
  .toUpperCase()
  .replace(/\.T$/,"");

 for(const market of ["japan","usa"]){

  const g=data[market]||{};

  for(const key of [
   "short",
   "medium",
   "mid",
   "long",
   "all"
  ]){

   const rows=Array.isArray(g[key])
    ?g[key]
    :[];

   const hit=rows.find(x=>
    String(x.code||"")
     .toUpperCase()
     .replace(/\.T$/,"")===code
   );

   if(hit)return{
    stock:hit,
    market
   };
  }
 }

 return null;
}

function judge(x){

 const score=n(x.score);
 const technical=n(x.technical);
 const quality=n(x.quality);
 const financial=n(x.financial);
 const catalyst=n(x.catalyst);

 const trend=clamp(
  technical*.55+
  score*.25+
  catalyst*.20
 );

 const total=clamp(
  score*.50+
  technical*.25+
  trend*.25
 );

 let text="慎重";
 let cls="qb-care";

 if(total>=69 && technical>=60){
  text="買い優勢";
  cls="qb-buy";
 }else if(total>=62){
  text="様子見";
  cls="qb-watch";
 }

 return{
  score,
  technical,
  quality,
  financial,
  catalyst,
  trend,
  total,
  text,
  cls
 };
}

function level(v){
 if(v>=70)return"強い";
 if(v>=62)return"中立";
 return"弱い";
}

function reasons(j){
 const a=[];

 if(j.score>=70)
  a.push("総合スコアが高い水準です。");
 else if(j.score>=64)
  a.push("総合スコアは中間以上です。");
 else
  a.push("総合スコアは慎重に確認したい水準です。");

 if(j.technical>=65)
  a.push("テクニカル面の勢いは良好です。");
 else if(j.technical<58)
  a.push("テクニカル面はまだ弱めです。");

 if(j.quality>=70)
  a.push("企業の質・成長性も高く評価されています。");

 if(j.financial<55)
  a.push("財務評価には確認余地があります。");

 return a.slice(0,3);
}

function f(v){
 return Math.round(n(v)*10)/10;
}

function render(found){

 const x=found.stock;
 const j=judge(x);

 const price=Number(x.price);

 const reason=reasons(j)
  .map(v=>"・"+v)
  .join("<br>");

 document.querySelector("#qbResult").innerHTML=`
 <div class="qb-stock">

  <div>
   <div class="qb-name">
    ${x.code||""}　${x.name||""}
   </div>

   <div style="
    color:#93a2b5;
    font-size:9px;
    margin-top:3px">
    ${found.market==="japan"
     ?"日本株"
     :"米国株"}
   </div>
  </div>

  <div class="qb-price">
   ${Number.isFinite(price)
     ?price.toLocaleString()
     :"－"}
   ${found.market==="japan"
     ?"円"
     :"USD"}
  </div>

 </div>

 <div class="qb-main">
  <small>総合判断</small>
  <strong class="${j.cls}">
   ${j.text}
  </strong>
 </div>

 <div class="qb-three">

  <div class="qb-card">
   <span>総合</span>
   <b>${f(j.total)}</b>
  </div>

  <div class="qb-card">
   <span>テクニカル</span>
   <b>${level(j.technical)}</b>
  </div>

  <div class="qb-card">
   <span>トレンド</span>
   <b>${level(j.trend)}</b>
  </div>

 </div>

 <div class="qb-reason">
  <b>💡 判断の理由</b><br>
  ${reason}
 </div>

 <div class="qb-detail">

  <div>
   <span>総合スコア</span>
   <b>${f(j.score)}</b>
  </div>

  <div>
   <span>テクニカル</span>
   <b>${f(j.technical)}</b>
  </div>

  <div>
   <span>品質・成長</span>
   <b>${f(j.quality)}</b>
  </div>

  <div>
   <span>財務</span>
   <b>${f(j.financial)}</b>
  </div>

  <div>
   <span>割安性</span>
   <b>${f(x.valuation)}</b>
  </div>

  <div>
   <span>カタリスト</span>
   <b>${f(j.catalyst)}</b>
  </div>

 </div>

 <div class="qb-note">
  ※この診断は現在の分析データによる判断目安です。
  将来の株価上昇や利益を保証するものではありません。
 </div>
 `;

 document.querySelector("#qbResult").hidden=false;
}

async function run(){

 const code=document
  .querySelector("#qbCode")
  .value
  .trim();

 const status=document
  .querySelector("#qbStatus");

 if(!code){
  status.textContent=
   "銘柄コードを入力してください。";
  return;
 }

 status.textContent=
  "分析しています…";

 try{

  const data=await loadData();
  const hit=findStock(data,code);

  if(!hit){
   document.querySelector("#qbResult")
    .hidden=true;

   status.textContent=
    "現在の分析対象データでは見つかりませんでした。";

   return;
  }

  render(hit);

  status.textContent=
   "診断結果を表示しました。";

 }catch(e){

  status.textContent=
   "分析データを読み込めませんでした。";
 }
}

document
 .querySelector("#qbRun")
 .onclick=run;

document
 .querySelector("#qbCode")
 .addEventListener(
  "keydown",
  e=>{
   if(e.key==="Enter")run();
  }
 );

})();
