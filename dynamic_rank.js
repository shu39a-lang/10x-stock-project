(function(){
"use strict";

const REMOTE_DATA =
  "https://raw.githubusercontent.com/shu39a-lang/10x-stock-project/main/tenx_data.json";

function classifyStock(x){
  const score=Number(x.score)||0;
  const quality=Number(x.quality)||0;
  const financial=Number(x.financial)||0;
  const technical=Number(x.technical)||0;
  const catalyst=Number(x.catalyst)||0;

  if(quality>=75 && catalyst>=70){
    return "成長株";
  }

  if(financial>=62 && technical>=62 && score>=65){
    return "安定上昇";
  }

  return "上昇期待";
}

function convertRows(rows){
  if(!Array.isArray(rows)) return [];

  return rows.slice(0,20).map(x => [
    String(x.code || ""),
    String(x.name || ""),
    Math.round(Number(x.score) || 0),
    classifyStock(x)
  ]);
}

function rankColor(category){
  if(category==="安定上昇") return "#0b73d9";
  if(category==="成長株") return "#d9a400";
  return "#c90035";
}

function decorateRanking(){
  try{
    const arr=DATA[state.market][state.term];
    if(!Array.isArray(arr)) return;

    const shown=state.showAll ? arr.slice(0,20) : arr.slice(0,10);
    const rows=document.querySelectorAll(
      "#rankingTable .trow:not(.thead)"
    );

    rows.forEach((row,i)=>{
      const item=shown[i];
      if(!item) return;

      const nameCell=row.querySelector(".sname");
      const rankCell=row.querySelector(".rank");

      if(!nameCell || !rankCell) return;

      nameCell.textContent=item[1];
      nameCell.style.whiteSpace="nowrap";
      nameCell.style.overflow="hidden";
      nameCell.style.textOverflow="ellipsis";
      nameCell.style.lineHeight="normal";

      rankCell.style.width="30px";
      rankCell.style.height="30px";
      rankCell.style.margin="0 auto";
      rankCell.style.display="flex";
      rankCell.style.alignItems="center";
      rankCell.style.justifyContent="center";
      rankCell.style.borderRadius="4px";
      rankCell.style.background=rankColor(item[3] || "上昇期待");
      rankCell.style.color="#fff";
      rankCell.style.fontWeight="1000";
      rankCell.style.lineHeight="1";
    });

  }catch(e){
    console.log("classification display failed:",e);
  }
}

function installRankingDecorator(){
  if(typeof window.renderRanking!=="function") return;
  if(window.renderRanking.__threeClassPatched) return;

  const original=window.renderRanking;

  const patched=function(){
    const result=original.apply(this,arguments);
    setTimeout(decorateRanking,0);
    return result;
  };

  patched.__threeClassPatched=true;
  window.renderRanking=patched;
}

async function updateDynamicRanking(){
  try{
    const r=await fetch(
      REMOTE_DATA+"?t="+Date.now(),
      {cache:"no-store"}
    );

    if(!r.ok){
      throw new Error("HTTP "+r.status);
    }

    const j=await r.json();

    if(!j || !j.japan || !j.usa){
      throw new Error("ranking data invalid");
    }

    DATA.japan.short=convertRows(j.japan.short);
    DATA.japan.mid=convertRows(j.japan.medium);
    DATA.japan.long=convertRows(j.japan.long);

    DATA.usa.short=convertRows(j.usa.short);
    DATA.usa.mid=convertRows(j.usa.medium);
    DATA.usa.long=convertRows(j.usa.long);

    installRankingDecorator();

    if(typeof renderRanking==="function"){
      renderRanking();
    }

    setTimeout(decorateRanking,0);

  }catch(e){
    console.log("dynamic ranking update failed:",e);
  }
}

if(document.readyState==="loading"){
  document.addEventListener(
    "DOMContentLoaded",
    updateDynamicRanking
  );
}else{
  updateDynamicRanking();
}

})();
