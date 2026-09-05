(function(){
"use strict";

const REMOTE_DATA = "tenx_data.json";

const JP_BANK_CODES = new Set([
  "7180","7182","7327","7337","7342","7380","7381","7389",
  "8304","8306","8308","8309","8316","8331","8334","8336",
  "8337","8338","8341","8343","8344","8345","8354","8358",
  "8359","8360","8361","8362","8366","8367","8368","8370",
  "8377","8381","8386","8387","8388","8392","8393","8395",
  "8410","8411","8522","8524","8537","8541","8544","8550",
  "8551","8558","8562","8563","8600","8713"
]);

function isBankRow(x){
  const code=String(x[0]||"");
  const name=String(x[1]||"");
  const theme=String(x[4]||"");

  return (
    theme==="銀行" ||
    JP_BANK_CODES.has(code) ||
    name.includes("銀行") ||
    name.includes("フィナンシャルグループ") ||
    name.includes("フィナンシャル・グループ") ||
    name.includes("フィナンシャルホールディングス") ||
    name.includes("フィナンシャルHD")
  );
}

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
    if(financial>=59 && technical>=59 && score>=64){
      return "安定上昇";
    }
  }else{
    if(quality>=71 && catalyst>=66){
      return "成長株";
    }
    if(financial>=62 && technical>=62 && score>=65){
      return "安定上昇";
    }
  }
  return "上昇期待";
}

function diversifyJapanRows(arr){
  const pool=arr.slice(0,20);
  const selected=[];
  const used=new Set();

  function fillUntil(target,bankLimit){
    for(const item of pool){
      if(selected.length>=target) break;
      if(used.has(item[0])) continue;

      const bankCount=selected.filter(isBankRow).length;
      if(isBankRow(item) && bankCount>=bankLimit) continue;

      selected.push(item);
      used.add(item[0]);
    }
  }

  fillUntil(5,2);
  fillUntil(10,3);
  fillUntil(20,4);

  if(selected.length<20){
    for(const item of pool){
      if(selected.length>=20) break;
      if(used.has(item[0])) continue;
      selected.push(item);
      used.add(item[0]);
    }
  }

  return selected;
}

function convertRows(rows,market){
  if(!Array.isArray(rows)) return [];

  const mapped=rows.slice(0,20).map(x => [
    String(x.code || ""),
    String(x.name || ""),
    Math.round(Number(x.score) || 0),
    classifyStock(x,market),
    String(x.trend_theme || "")
  ]);

  return market==="japan"
    ? diversifyJapanRows(mapped)
    : mapped;
}

function rankColor(category){
  if(category==="安定上昇") return "#0b73d9";
  if(category==="成長株") return "#d9a400";
  return "#c90035";
}

function enforceJapanBankCap(selected,pool,limit){
  if(state.market!=="japan") return selected;

  const out=selected.slice();
  let bankCount=out.filter(isBankRow).length;

  if(bankCount<=limit) return out;

  const replacements=pool.filter(
    x=>!isBankRow(x) && !out.some(y=>y[0]===x[0])
  );

  for(let i=out.length-1;i>=0 && bankCount>limit;i--){
    if(!isBankRow(out[i])) continue;
    const replacement=replacements.shift();
    if(!replacement) break;
    out[i]=replacement;
    bankCount--;
  }

  return out;
}

function balancedTop10(arr){
  const top20=arr.slice(0,20);
  const selected=top20.slice(0,10);

  const targetCategory=
    state.market==="japan" ? "成長株" :
    state.market==="usa" ? "安定上昇" : null;

  if(targetCategory){
    const minimum=3;
    let current=selected.filter(x=>x[3]===targetCategory).length;

    if(current<minimum){
      const candidates=top20.slice(10).filter(
        x=>x[3]===targetCategory && !selected.some(y=>y[0]===x[0])
      );

      for(const cand of candidates){
        if(current>=minimum) break;

        let swap=-1;
        for(let i=selected.length-1;i>=0;i--){
          if(selected[i][3]!==targetCategory){
            swap=i;
            break;
          }
        }

        if(swap<0) break;
        selected[swap]=cand;
        current++;
      }
    }
  }

  const capped=enforceJapanBankCap(selected,top20,3);

  return capped.sort(
    (a,b)=>Number(b[2])-Number(a[2])
  );
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
