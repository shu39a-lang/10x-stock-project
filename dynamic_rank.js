(function(){
"use strict";

const REMOTE_DATA =
  "https://raw.githubusercontent.com/shu39a-lang/10x-stock-project/main/tenx_data.json";

function convertRows(rows){
  if(!Array.isArray(rows)) return [];
  return rows.slice(0,10).map(x => [
    String(x.code || ""),
    String(x.name || ""),
    Math.round(Number(x.score) || 0)
  ]);
}

async function updateDynamicRanking(){
  try{
    const url = REMOTE_DATA + "?t=" + Date.now();

    const r = await fetch(url,{
      cache:"no-store"
    });

    if(!r.ok){
      throw new Error("HTTP " + r.status);
    }

    const j = await r.json();

    if(!j || !j.japan || !j.usa){
      throw new Error("ranking data invalid");
    }

    DATA.japan.short = convertRows(j.japan.short);
    DATA.japan.mid   = convertRows(j.japan.medium);
    DATA.japan.long  = convertRows(j.japan.long);

    DATA.usa.short = convertRows(j.usa.short);
    DATA.usa.mid   = convertRows(j.usa.medium);
    DATA.usa.long  = convertRows(j.usa.long);

    if(typeof renderRanking === "function"){
      renderRanking();
    }

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

if(document.readyState === "loading"){
  document.addEventListener(
    "DOMContentLoaded",
    updateDynamicRanking
  );
}else{
  updateDynamicRanking();
}

})();

document.addEventListener("DOMContentLoaded",function(){
  window.updateHoldingNow=function(i){
    const h=holdings();
    const el=document.getElementById("holdNow"+i);
    const n=Number(String(el?.value||"").replace(/,/g,""));

    if(!h[i]||!Number.isFinite(n)||n<=0){
      alert("現在値を正しく入力してください");
      return;
    }

    h[i].now=n;
    setJSON("tenx_zero_holdings",h);
    renderPortfolio();
    alert("現在値を反映しました");
  };
});
