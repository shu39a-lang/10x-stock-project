(function(){
"use strict";

const REMOTE_DATA = "tenx_data.json";

function classifyStock(x,market){
  const score=Number(x.score)||0;
  const quality=Number(x.quality)||0;
  const financial=Number(x.financial)||0;
  const technical=Number(x.technical)||0;
  const catalyst=Number(x.catalyst)||0;

  if(market==="usa"){
  if(quality>=75 && catalyst>=70){
    return "成長株";
  }
  if(financial>=60 && technical>=60 && score>=64){
    return "安定上昇";
  }
}else{
  if(quality>=72 && catalyst>=67){
    return "成長株";
  }
  if(financial>=62 && technical>=62 && score>=65){
    return "安定上昇";
  }
}
  return "上昇期待";
}

function convertRows(rows,market){
  if(!Array.isArray(rows)) return [];

  return rows.slice(0,20).map(x => [
    String(x.code || ""),
    String(x.name || ""),
    Math.round(Number(x.score) || 0),
    classifyStock(x,market)
  ]);
}

function rankColor(category){
  if(category==="安定上昇") return "#0b73d9";
  if(category==="成長株") return "#d9a400";
  return "#c90035";
}

function balancedTop10(arr){
  const top20=arr.slice(0,20);
  const selected=top20.slice(0,10);
  const cats=["上昇期待","安定上昇","成長株"];

  const total={};
  const target={};
  const count={};

  cats.forEach(c=>{
    total[c]=top20.filter(x=>x[3]===c).length;
    target[c]=Math.floor(total[c]/2);
    count[c]=selected.filter(x=>x[3]===c).length;
  });

  let remain=10-cats.reduce((s,c)=>s+target[c],0);
  cats
    .slice()
    .sort((a,b)=>(total[b]%2)-(total[a]%2)||total[b]-total[a])
    .forEach(c=>{
      if(remain>0){
        target[c]++;
        remain--;
      }
    });

  cats.forEach(c=>{
    while(count[c]<target[c]){
      const cand=top20.slice(10).find(x=>
        x[3]===c && !selected.includes(x)
      );
      if(!cand) break;

      let swap=-1;
      for(let i=selected.length-1;i>=0;i--){
        const dc=selected[i][3];
        const diff=Number(selected[i][2])-Number(cand[2]);

        if(dc!==c && count[dc]>target[dc] && diff<=2){
          swap=i;
          break;
        }
      }

      if(swap<0) break;

      count[selected[swap][3]]--;
      selected[swap]=cand;
      count[c]++;
    }
  });

  return selected.sort((a,b)=>Number(b[2])-Number(a[2]));
}
  function decorateRanking(){
  try{
    const arr=DATA[state.market][state.term];
    if(!Array.isArray(arr)) return;

    const shown=state.showAll ? arr.slice(0,20) : balancedTop10(arr);
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

    DATA.japan.short=convertRows(j.japan.short,"japan");
DATA.japan.mid=convertRows(j.japan.medium,"japan");
DATA.japan.long=convertRows(j.japan.long,"japan");

DATA.usa.short=convertRows(j.usa.short,"usa");
DATA.usa.mid=convertRows(j.usa.medium,"usa");
DATA.usa.long=convertRows(j.usa.long,"usa");

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
