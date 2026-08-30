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

/* BUILD 30 - analysis input + market buttons safety fix */
(function(){
"use strict";

const codeInput=document.getElementById("codeInput");
const marketInput=document.getElementById("marketInput");

if(codeInput){
  const showTypingStatus=()=>{
    const st=document.getElementById("lookupStatus");
    if(st){
      st.style.color="#93a2b5";
      st.textContent="入力後に「完了」を押すか、別の欄をタップしてください。";
    }
  };

  codeInput.addEventListener("input",function(e){
    e.stopImmediatePropagation();
    showTypingStatus();
  },true);

  codeInput.addEventListener("compositionend",function(e){
    e.stopImmediatePropagation();
    showTypingStatus();
  },true);
}

if(marketInput && !document.getElementById("analysisMarketButtons")){
  const label=marketInput.closest("label");
  if(label){
    const box=document.createElement("div");
    box.id="analysisMarketButtons";
    box.setAttribute("role","group");
    box.setAttribute("aria-label","市場を選択");
    box.style.display="grid";
    box.style.gridTemplateColumns="1fr 1fr";
    box.style.gap="7px";
    box.style.marginTop="5px";

    const makeButton=(value,text,isJapan)=>{
      const b=document.createElement("button");
      b.type="button";
      b.dataset.marketValue=value;
      b.textContent=text;
      b.style.minHeight="44px";
      b.style.borderRadius="10px";
      b.style.fontSize="15px";
      b.style.fontWeight="900";
      b.style.padding="6px 7px";
      b.style.cursor="pointer";
      if(isJapan){
        b.style.background="#fff";
        b.style.color="#b31435";
        b.style.border="1px solid #e9e9e9";
      }else{
        b.style.background="linear-gradient(135deg,#124da8,#082656)";
        b.style.color="#fff";
        b.style.border="1px solid #2f4f77";
      }
      b.addEventListener("click",()=>{
        if(marketInput.value!==value){
          marketInput.value=value;
          marketInput.dispatchEvent(new Event("change",{bubbles:true}));
        }
        syncButtons();
      });
      return b;
    };

    const jp=makeButton("japan","🇯🇵 日本株",true);
    const us=makeButton("usa","🇺🇸 米国株",false);
    box.append(jp,us);

    const syncButtons=()=>{
      [jp,us].forEach(b=>{
        const active=b.dataset.marketValue===marketInput.value;
        b.style.outline=active?"3px solid #ffc73d":"none";
        b.style.outlineOffset=active?"2px":"0";
      });
    };

    marketInput.style.position="absolute";
    marketInput.style.width="1px";
    marketInput.style.height="1px";
    marketInput.style.opacity="0";
    marketInput.style.pointerEvents="none";
    marketInput.style.margin="0";
    marketInput.setAttribute("aria-hidden","true");
    marketInput.tabIndex=-1;

    label.appendChild(box);
    marketInput.addEventListener("change",syncButtons);
    syncButtons();
  }
}

})();
