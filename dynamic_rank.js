(function(){
"use strict";

const REMOTE_DATA =
  "https://raw.githubusercontent.com/shu39a-lang/10x-stock-project/main/tenx_data.json";

function classifyStock(x){
  const score=Number(x.score)||50;
  const quality=Number(x.quality)||50;
  const financial=Number(x.financial)||50;
  const technical=Number(x.technical)||50;
  const catalyst=Number(x.catalyst)||50;

  const rise=
    technical*0.45+
    catalyst*0.30+
    score*0.25;

  const stable=
    financial*0.40+
    technical*0.30+
    score*0.30;

  const growth=
    quality*0.50+
    catalyst*0.25+
    score*0.25;

  if(growth>=rise && growth>=stable) return "成長株";
  if(stable>=rise && stable>=growth) return "安定上昇";
  return "上昇期待";
}

function convertRows(rows){
  if(!Array.isArray(rows)) return [];

  return rows.slice(0,10).map(x => [
    String(x.code || ""),
    String(x.name || ""),
    Math.round(Number(x.score) || 0),
    classifyStock(x)
  ]);
}

function decorateRanking(){
  try{
    const arr=DATA[state.market][state.term];
    if(!Array.isArray(arr)) return;

    const shown=state.showAll ? arr : arr.slice(0,5);
    const rows=document.querySelectorAll(
      "#rankingTable .trow:not(.thead)"
    );

    rows.forEach((row,i)=>{
      const item=shown[i];
      if(!item) return;

      const nameCell=row.querySelector(".sname");
      if(!nameCell) return;

      const originalName=item[1];
      const category=item[3] || "";

      nameCell.style.whiteSpace="normal";
      nameCell.style.overflow="visible";
      nameCell.style.textOverflow="clip";
      nameCell.style.lineHeight="1.25";

      nameCell.innerHTML="";

      const title=document.createElement("span");
      title.textContent=originalName;
      title.style.display="block";
      title.style.whiteSpace="nowrap";
      title.style.overflow="hidden";
      title.style.textOverflow="ellipsis";

      const badge=document.createElement("span");
      badge.textContent=category;
      badge.style.display="inline-block";
      badge.style.marginTop="4px";
      badge.style.padding="2px 6px";
      badge.style.border="1px solid #ffc73d";
      badge.style.borderRadius="999px";
      badge.style.fontSize="9px";
      badge.style.fontWeight="800";
      badge.style.lineHeight="1.3";
      badge.style.color="#ffc73d";
      badge.style.whiteSpace="nowrap";

      nameCell.appendChild(title);
      nameCell.appendChild(badge);
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
    const url=REMOTE_DATA+"?t="+Date.now();

    const r=await fetch(url,{
      cache:"no-store"
    });

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

    console.log(
      "dynamic ranking updated:",
      j.updated_at || ""
    );

  }catch(e){
    console.log(
      "dynamic ranking update failed:",
      e
    );
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
