const CACHE="tenx-stock-v3";
const SHELL=["./","./index.html","./manifest.webmanifest","./icon-192.png","./icon-512.png","./apple-touch-icon.png"];
const AO="https://api.allorigins.win/raw?url=";

function jsonResponse(data,status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:{
      "content-type":"application/json; charset=utf-8",
      "cache-control":"no-store"
    }
  });
}

function normalize(market,code){
  const c=String(code||"").trim().toUpperCase().replace(/\.T$/i,"");
  if(!c) return null;
  if(market==="japan"){
    if(!/^\d{4}[A-Z]?$/.test(c)) return null;
    return {code:c,symbol:c+".T"};
  }
  if(market==="usa" && /^[0-9A-Z.\-^=]+$/.test(c)){
    return {code:c,symbol:c};
  }
  return null;
}

async function stockApi(request){
  const u=new URL(request.url);
  const market=u.searchParams.get("market");
  const n=normalize(market,u.searchParams.get("code"));
  if(!n) return jsonResponse({ok:false,error:"invalid_code"},400);

  try{
    const yahoo=`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(n.symbol)}?interval=1d&range=5d`;
    const proxy=await fetch(AO+encodeURIComponent(yahoo),{cache:"no-store"});
    if(!proxy.ok) return jsonResponse({ok:false,error:"proxy_unavailable"},502);

    const body=await proxy.json();
    const result=body?.chart?.result?.[0];
    const meta=result?.meta;
    const price=Number(meta?.regularMarketPrice);
    if(!meta || !Number.isFinite(price)){
      return jsonResponse({ok:false,error:"not_found"},404);
    }

    const prev=Number(meta?.chartPreviousClose ?? meta?.previousClose);
    const changePct=Number.isFinite(prev)&&prev>0 ? (price/prev-1)*100 : 0;
    let name=meta.longName || meta.shortName || meta.symbol || n.code;

    if(!meta.longName && !meta.shortName){
      try{
        const searchUrl=`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(n.symbol)}&quotesCount=5&newsCount=0`;
        const sr=await fetch(AO+encodeURIComponent(searchUrl),{cache:"no-store"});
        if(sr.ok){
          const sj=await sr.json();
          const hit=(sj.quotes||[]).find(x=>String(x.symbol||"").toUpperCase()===n.symbol.toUpperCase()) || (sj.quotes||[])[0];
          if(hit) name=hit.longname || hit.shortname || hit.displayName || name;
        }
      }catch(e){}
    }

    return jsonResponse({
      ok:true,
      market,
      code:n.code,
      symbol:meta.symbol || n.symbol,
      name,
      price,
      change_pct:Math.round(changePct*100)/100,
      currency:meta.currency || (market==="japan" ? "JPY" : "USD")
    });
  }catch(e){
    return jsonResponse({ok:false,error:"lookup_failed"},500);
  }
}

self.addEventListener("install",e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate",e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch",e=>{
  const r=e.request;
  const u=new URL(r.url);
  if(r.method!=="GET" || u.origin!==location.origin) return;

  if(u.pathname.endsWith("/api/stock") || u.pathname==="/api/stock"){
    e.respondWith(stockApi(r));
    return;
  }

  if(u.pathname.endsWith(".json")){
    e.respondWith(
      fetch(r)
        .then(res=>{
          const copy=res.clone();
          caches.open(CACHE).then(c=>c.put(r,copy));
          return res;
        })
        .catch(()=>caches.match(r))
    );
    return;
  }

  if(r.mode==="navigate"){
    e.respondWith(fetch(r).catch(()=>caches.match("./index.html")));
    return;
  }

  e.respondWith(
    caches.match(r).then(hit=>hit || fetch(r).then(res=>{
      const copy=res.clone();
      caches.open(CACHE).then(c=>c.put(r,copy));
      return res;
    }))
  );
});
