const YAHOO_HOSTS = [
  "https://query1.finance.yahoo.com",
  "https://query2.finance.yahoo.com"
];

function jres(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
      "pragma": "no-cache",
      "expires": "0",
      "access-control-allow-origin": "*"
    }
  });
}

function normalizeSymbol(market, code) {
  const c = String(code || "").trim().toUpperCase().replace(/\.T$/i, "");
  if (!c) return null;
  if (market === "japan") {
    if (!/^\d{4}[A-Z]?$/.test(c)) return null;
    return { code: c, symbol: c + ".T" };
  }
  if (market === "usa") {
    if (!/^[A-Z0-9.\-^=]+$/.test(c)) return null;
    return { code: c, symbol: c };
  }
  return null;
}

async function yahooJson(path) {
  let lastStatus = 0;
  for (const host of YAHOO_HOSTS) {
    try {
      const sep = path.includes("?") ? "&" : "?";
      const u = host + path + sep + "_=" + Date.now();
      const r = await fetch(u, {
        headers: {
          "Accept": "application/json,text/plain,*/*",
          "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1"
        },
        cache: "no-store",
        cf: { cacheTtl: 0, cacheEverything: false }
      });
      lastStatus = r.status;
      if (!r.ok) continue;
      return { ok: true, data: await r.json() };
    } catch (_) {}
  }
  return { ok: false, status: lastStatus || 502 };
}

function latestValidClose(result) {
  try {
    const closes = result?.indicators?.quote?.[0]?.close || [];
    const ts = result?.timestamp || [];
    for (let i = closes.length - 1; i >= 0; i--) {
      const v = Number(closes[i]);
      if (Number.isFinite(v)) return { price: v, time: Number(ts[i] || 0) || null };
    }
  } catch (_) {}
  return null;
}

async function stockLookup(request) {
  const url = new URL(request.url);
  const market = String(url.searchParams.get("market") || "").toLowerCase();
  const norm = normalizeSymbol(market, url.searchParams.get("code"));
  if (!norm) return jres({ ok: false, error: "invalid_code" }, 400);

  const { code, symbol } = norm;

  // Primary: Yahoo chart meta regularMarketPrice (worked in the earlier version).
  const day = await yahooJson(
    "/v8/finance/chart/" + encodeURIComponent(symbol) +
    "?interval=1d&range=5d&includePrePost=false&events=div%2Csplits"
  );
  if (!day.ok) return jres({ ok: false, error: "quote_fetch_failed" }, 502);

  const result = day.data?.chart?.result?.[0];
  const meta = result?.meta;
  if (!meta) return jres({ ok: false, error: "not_found" }, 404);

  let price = Number(meta.regularMarketPrice);
  let priceTime = Number(meta.regularMarketTime || 0) || null;
  let source = "regularMarketPrice";

  // Secondary: latest 1-minute close. If available, use it only when it is at least
  // as recent as regularMarketTime. If it fails, primary value remains untouched.
  const intraday = await yahooJson(
    "/v8/finance/chart/" + encodeURIComponent(symbol) +
    "?interval=1m&range=1d&includePrePost=false&events=div%2Csplits"
  );
  if (intraday.ok) {
    const ir = intraday.data?.chart?.result?.[0];
    const last = latestValidClose(ir);
    if (last && Number.isFinite(last.price) && (!priceTime || !last.time || last.time >= priceTime - 120)) {
      price = last.price;
      priceTime = last.time || priceTime;
      source = "latest_1m_close";
    }
  }

  if (!Number.isFinite(price)) return jres({ ok: false, error: "not_found" }, 404);

  let name = meta.longName || meta.shortName || "";
  if (!name) {
    const sr = await yahooJson(
      "/v1/finance/search?q=" + encodeURIComponent(symbol) + "&quotesCount=8&newsCount=0"
    );
    if (sr.ok) {
      const quotes = sr.data?.quotes || [];
      const hit = quotes.find(x => String(x.symbol || "").toUpperCase() === symbol.toUpperCase()) || quotes[0];
      if (hit) name = hit.longname || hit.shortname || hit.displayName || "";
    }
  }

  const prev = Number(meta.chartPreviousClose ?? meta.previousClose);
  const changePct = Number.isFinite(prev) && prev > 0 ? (price / prev - 1) * 100 : 0;

  return jres({
    ok: true,
    market,
    code,
    symbol: meta.symbol || symbol,
    name: name || code,
    price: Math.round(price * 10000) / 10000,
    previous_close: Number.isFinite(prev) ? prev : null,
    change_pct: Math.round(changePct * 100) / 100,
    currency: meta.currency || (market === "japan" ? "JPY" : "USD"),
    exchange: meta.fullExchangeName || meta.exchangeName || "",
    time: priceTime,
    source
  });
}


const APP_HTML = "<!doctype html>\n<html lang=\"ja\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">\n<meta name=\"theme-color\" content=\"#050910\">\n<meta name=\"apple-mobile-web-app-capable\" content=\"yes\">\n<meta name=\"apple-mobile-web-app-status-bar-style\" content=\"black-translucent\">\n<meta name=\"apple-mobile-web-app-title\" content=\"元金10倍計画\">\n<title>元金10倍計画</title>\n<style>\n*{box-sizing:border-box}\nbody{margin:0;background:#050910;color:#fff;font-family:-apple-system,BlinkMacSystemFont,\"Hiragino Sans\",\"Yu Gothic\",sans-serif}\n.app{max-width:900px;margin:auto;padding:16px 12px 40px}\n.gold{color:#ffd54f;font-weight:900;letter-spacing:.06em}\nh1{font-size:38px;margin:4px 0 8px}\n.sub{color:#aab5c3;font-size:13px}\n.status{margin:14px 0;padding:12px;border:1px solid #263448;border-radius:14px;background:#0a121c;display:flex;justify-content:space-between;gap:10px}\n.auto{color:#75ec9c;font-weight:900}\n.sticky{position:sticky;top:0;z-index:10;background:rgba(5,9,16,.96);padding:8px 0}\n.markets,.hz{display:grid;gap:8px}\n.markets{grid-template-columns:1fr 1fr}\n.hz{grid-template-columns:repeat(3,1fr);margin-top:9px}\nbutton{font-family:inherit}\n.market{height:60px;border:0;border-radius:15px;font-size:22px;font-weight:900}\n.jp{background:#fff;color:#c20e2d}.us{background:#28479d;color:#fff}\n.h{height:70px;border-radius:14px;border:1px solid #2a394b;background:#101923;color:#fff}\n.h b{display:block;font-size:19px}.h small{display:block;color:#98a5b5;margin-top:5px}\n.active{outline:3px solid #ffd54f;outline-offset:1px}\n.title{font-size:26px;font-weight:900;margin:20px 2px 10px}\n.legend{font-size:11px;color:#91a0b3;margin:0 2px 10px;line-height:1.6}\n.list{display:grid;gap:10px}\n.stock{background:#0b141e;border:1px solid #29384b;border-radius:16px;padding:13px}\n.r1{display:grid;grid-template-columns:42px 1fr 42px;gap:10px;align-items:center}\n.rank{width:40px;height:40px;border-radius:50%;background:#182433;display:grid;place-items:center;font-size:18px;font-weight:900}\n.stock:nth-child(1) .rank{background:#f5c928;color:#111}\n.stock:nth-child(2) .rank{background:#d8dde5;color:#111}\n.stock:nth-child(3) .rank{background:#d98933;color:#111}\n.name{font-size:20px;font-weight:900}\n.code{color:#96a3b3;font-size:12px;margin-top:3px}\n.chart{width:42px;height:42px;border-radius:9px;border:1px solid #2b425a;background:#101a25;display:grid;place-items:center;text-decoration:none;font-size:22px}\n.r2{display:grid;grid-template-columns:1.1fr 1fr 1fr auto;gap:8px;border-top:1px solid #223142;margin-top:11px;padding-top:10px;align-items:end}\n.m label{display:block;color:#8492a4;font-size:10px;margin-bottom:3px}\n.m strong{font-size:16px}\n.up{color:#42df7d}.down{color:#ff626c}\n.sig{padding:7px 9px;border-radius:8px;font-size:13px;font-weight:900;white-space:nowrap}\n.best{color:#ff646c;border:1px solid #c6373e}.good{color:#ffb33a;border:1px solid #96610c}.watch{color:#91f177;border:1px solid #4c9b35}\n.five{display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin-top:10px}\n.f{background:#0f1924;border:1px solid #23354a;border-radius:8px;padding:6px;text-align:center}\n.f label{display:block;color:#7f8ea0;font-size:9px}.f b{font-size:13px}.ga{color:#63e693}.gb{color:#ffd25e}.gc{color:#9ec8ff}.gd{color:#ff7c86}\n.sim{margin-top:22px;border:1px solid #29384b;border-radius:16px;overflow:hidden;background:#09121b}\n.simh{padding:14px;background:#101a26}.simh h2{font-size:21px;margin:0}.simh div{font-size:11px;color:#98a6b6;margin-top:4px}.simnote{line-height:1.5}\n.srow{padding:12px;border-top:1px solid #1f2d3d}\n.sname{display:flex;justify-content:space-between;gap:10px;font-size:14px;font-weight:900}.smeta{font-size:10px;color:#8e9caf;margin-top:4px;line-height:1.5}\n.sg{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px}\n.sc{background:#0f1924;border:1px solid #1f3043;border-radius:8px;padding:7px}\n.sc label{display:block;color:#7f8ea0;font-size:9px}.sc strong{font-size:12px}\n.total{margin:12px;padding:12px;border:1px solid #29435f;border-radius:11px;background:#111e2b;display:grid;grid-template-columns:1fr 1fr;gap:8px}\n.total span{font-size:11px;color:#9facbc}.total b{display:block;margin-top:3px;font-size:15px}\n.note{text-align:center;color:#6f7d8d;font-size:10px;line-height:1.6;margin:18px 5px}\n.empty{text-align:center;padding:24px;color:#788596}\n\n.tools{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:10px 0}\n.tool{border:1px solid #2a394b;background:#0d1722;color:#fff;border-radius:11px;padding:9px 4px;font-size:12px;font-weight:800}\n.tool.on{outline:2px solid #ffd54f}\n.alertbox,.portbox{display:none;margin:10px 0;border:1px solid #2b3e53;border-radius:14px;background:#0a131e;padding:12px}\n.custombox{margin-top:14px;border-top:1px solid #2b3e53;padding-top:13px}.customtitle{font-size:15px;font-weight:900;margin-bottom:5px}.customnote{font-size:10px;color:#93a2b5;line-height:1.5;margin-bottom:9px}.customgrid{display:grid;grid-template-columns:1fr 1fr;gap:7px}.customgrid input,.customgrid select{width:100%;border:1px solid #2b3e53;background:#101a25;color:#fff;border-radius:8px;padding:9px;font-size:12px}.customgrid .wide{grid-column:1/-1}.lookupstatus{grid-column:1/-1;font-size:10px;color:#93a2b5;min-height:1.5em;padding:1px 2px}.lookupstatus.ok{color:#63e693}.lookupstatus.warn{color:#ffd25e}.customadd{width:100%;margin-top:8px;border:1px solid #6f5a00;background:#2b2300;color:#ffd54f;border-radius:9px;padding:9px;font-weight:900}.sourcehint{font-size:9px;color:#7f8ea0;margin-top:5px}.porttotals{display:grid;gap:7px;margin-top:10px}\n.alertbox.show,.portbox.show{display:block}\n.paneltitle{font-size:17px;font-weight:900;margin-bottom:8px}\n.alertitem,.portitem{border-top:1px solid #203044;padding:9px 0}.alertitem:first-of-type,.portitem:first-of-type{border-top:0}\n.alertwhy{font-size:11px;color:#9fadc0;margin-top:3px;line-height:1.45}\n.actions{display:flex;gap:6px;margin-top:9px}.act{flex:1;border:1px solid #29415b;background:#101c29;color:#fff;border-radius:8px;padding:7px;font-size:11px;font-weight:800}.act.favon{color:#ffd54f;border-color:#9d7c19}\n.buymatch{margin-top:8px;border-radius:8px;padding:7px 9px;background:#172617;border:1px solid #3c7b43;color:#7df197;font-size:11px;font-weight:900}\n.portgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:6px}.portgrid div{background:#101a25;border-radius:8px;padding:7px}.portgrid label{display:block;color:#8391a3;font-size:9px}.portgrid b{font-size:12px}\n.badge{display:inline-block;border-radius:999px;padding:2px 7px;font-size:10px;font-weight:900;background:#3b2d00;color:#ffd54f;margin-left:6px}\n\n@media(min-width:760px){.list{grid-template-columns:1fr 1fr}}\n</style>\n</head>\n<body>\n<div class=\"app\">\n<div class=\"gold\">10X STOCK PROJECT</div>\n<h1>元金10倍計画</h1>\n<div class=\"sub\">割安性・企業品質/成長・財務安全性・テクニカル・カタリストの5本柱で総合評価</div>\n\n<div class=\"status\"><div id=\"updated\">最終更新：読込中…</div><div class=\"auto\">自動更新</div></div>\n<div class=\"tools\">\n  <button id=\"refresh\" class=\"tool\">↻ 更新</button>\n  <button id=\"alertsBtn\" class=\"tool\">🔔 買いアラート</button>\n  <button id=\"favBtn\" class=\"tool\">★ お気に入り</button>\n  <button id=\"portBtn\" class=\"tool\">💼 保有株</button>\n</div>\n<div id=\"alertbox\" class=\"alertbox\"><div class=\"paneltitle\">買い条件一致候補 <span id=\"alertCount\" class=\"badge\">0</span></div><div id=\"alertRows\"></div><button id=\"notifyBtn\" class=\"act\">アプリ起動時通知をON</button></div>\n<div id=\"portbox\" class=\"portbox\"><div class=\"paneltitle\">保有株管理</div><div id=\"portRows\"></div>\n  <div class=\"custombox\">\n    <div class=\"customtitle\">➕ ランキング外の株を自由登録</div>\n    <div class=\"customnote\">ランキング外の株も登録できます。コードを入力すると会社名・現在株価・騰落率を自動取得します。</div>\n    <div class=\"customgrid\">\n      <select id=\"customMarket\"><option value=\"japan\">🇯🇵 日本株</option><option value=\"usa\">🇺🇸 米国株</option></select>\n      <input id=\"customCode\" placeholder=\"コード 例 7203 / NVDA\">\n      <input id=\"customName\" class=\"wide\" placeholder=\"銘柄名（コード入力で自動表示）\">\n      <input id=\"customQty\" inputmode=\"decimal\" placeholder=\"株数 例 100\">\n      <input id=\"customBuy\" inputmode=\"decimal\" placeholder=\"平均購入単価\">\n      <input id=\"customNow\" class=\"wide\" inputmode=\"decimal\" placeholder=\"現在値（自動取得時は自動表示）\">\n      <div id=\"customLookup\" class=\"lookupstatus\">コードを入力すると銘柄名を確認します。</div>\n    </div>\n    <button id=\"customAddBtn\" class=\"customadd\">この株を保有株に追加</button>\n  </div>\n</div>\n\n\n<div class=\"sticky\">\n  <div class=\"markets\">\n    <button id=\"jp\" class=\"market jp active\">🇯🇵 日本株</button>\n    <button id=\"us\" class=\"market us\">🇺🇸 米国株</button>\n  </div>\n  <div class=\"hz\">\n    <button class=\"h active\" data-h=\"short\"><b>短期</b><small>〜6か月</small></button>\n    <button class=\"h\" data-h=\"medium\"><b>中期</b><small>6か月〜1年</small></button>\n    <button class=\"h\" data-h=\"long\"><b>長期</b><small>1年以上</small></button>\n  </div>\n</div>\n\n<div id=\"title\" class=\"title\">日本株・短期 TOP10</div>\n<div class=\"legend\">100点満点：割安20点・品質/成長25点・財務15点・テクニカル25点・カタリスト15点。A=80以上 / B=65以上 / C=50以上 / D=50未満</div>\n<div id=\"list\" class=\"list\"></div>\n\n<div class=\"sim\">\n  <div class=\"simh\"><h2>100株 仮想購入シミュレーション（累計）</h2><div id=\"simtitle\"></div><div class=\"simnote\">初回選出日の購入価格を固定し、その後の現在値との差を累計で表示します。</div></div>\n  <div id=\"simrows\"></div>\n  <div id=\"total\" class=\"total\"></div>\n</div>\n\n<div class=\"note\">※候補抽出・検証用の参考情報です。利益や元金10倍を保証するものではありません。投資判断はご自身の責任で行ってください。</div>\n</div>\n\n<script>\nlet market=localStorage.getItem(\"tenx_market\")||\"japan\",horizon=localStorage.getItem(\"tenx_horizon\")||\"short\",\nD={japan:{short:[],medium:[],long:[]},usa:{short:[],medium:[],long:[]},quotes:{japan:{},usa:{}}},H=[],favOnly=false,remoteQuotes={japan:{},usa:{}};\nconst $=s=>document.querySelector(s),L={short:\"短期\",medium:\"中期\",long:\"長期\"};\nconst money=(x,m=market)=>m===\"japan\"?\"¥\"+Number(x).toLocaleString(undefined,{maximumFractionDigits:2}):\"$\"+Number(x).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});\nconst chart=x=>\"https://www.tradingview.com/chart/?symbol=\"+encodeURIComponent(market===\"japan\"?\"TSE:\"+x.code:x.code);\nconst sig=s=>s===\"最有力\"?\"best\":s===\"有力\"?\"good\":\"watch\";\nconst gclass=g=>\"g\"+String(g||\"C\").toLowerCase();\nconst gv=(x,k)=>x.grades?.[k]||\"C\";\nconst sv=(x,k)=>Number(x[k]??50).toFixed(0);\nconst favKey=(m,c)=>m+\":\"+c;\nconst getFavs=()=>new Set(JSON.parse(localStorage.getItem(\"tenx_favs\")||\"[]\"));\nconst setFavs=s=>localStorage.setItem(\"tenx_favs\",JSON.stringify([...s]));\nconst getPorts=()=>JSON.parse(localStorage.getItem(\"tenx_portfolio\")||\"{}\");\nconst setPorts=o=>localStorage.setItem(\"tenx_portfolio\",JSON.stringify(o));\nfunction firstBuyRecord(code){const a=H.filter(x=>x.market===market&&x.horizon===horizon&&String(x.code)===String(code)).sort((a,b)=>String(a.date).localeCompare(String(b.date)));return a.length?a[0]:null}\nfunction entryInfo(x){const r=firstBuyRecord(x.code),n=Number(x.price),c=Number(x.change_pct);let b=r?Number(r.buy_price):null;if(b!==null&&Number.isFinite(b)&&b>0){const same=Math.abs(b-n)<.005;if(same&&Number.isFinite(c)&&Math.abs(c)>.005&&1+c/100>0)b=n/(1+c/100);return {price:b,date:r.date||\"初回選出\"}}if(Number.isFinite(n)&&Number.isFinite(c)&&1+c/100>0)return {price:n/(1+c/100),date:\"初回選出\"};return {price:n,date:\"初回選出\"}}\nfunction entryPrice(x){return entryInfo(x).price}\nfunction buyMatch(x){const score=Number(x.score),tech=Number(x.technical),cat=Number(x.catalyst),fin=Number(x.financial),q=Number(x.quality);let ok=false,why=[];if(horizon===\"short\"){ok=score>=78&&tech>=78&&cat>=60; if(tech>=78)why.push(\"技術強い\"); if(cat>=60)why.push(\"材料良好\")}else if(horizon===\"medium\"){ok=score>=76&&tech>=70&&q>=65; if(q>=65)why.push(\"品質/成長良好\"); if(tech>=70)why.push(\"上昇基調\")}else{ok=score>=75&&q>=70&&fin>=60; if(q>=70)why.push(\"成長力\"); if(fin>=60)why.push(\"財務安定\")}if(score>=80)why.unshift(\"総合80点以上\");return {ok,why:why.join(\"・\")||\"総合条件を確認\"}}\nfunction syncControls(){$(\"#jp\").classList.toggle(\"active\",market===\"japan\");$(\"#us\").classList.toggle(\"active\",market===\"usa\");document.querySelectorAll(\".h\").forEach(b=>b.classList.toggle(\"active\",b.dataset.h===horizon));$(\"#favBtn\").classList.toggle(\"on\",favOnly)}\nfunction toggleFav(code){const f=getFavs(),k=favKey(market,code);f.has(k)?f.delete(k):f.add(k);setFavs(f);render()}\nfunction addHolding(x){const qty=prompt(x.name+\" の保有株数を入力してください\",\"100\");if(qty===null)return;const q=Number(qty);if(!(q>0))return alert(\"株数を正しく入力してください\");const bp=prompt(\"平均購入単価を入力してください\",String(x.price));if(bp===null)return;const b=Number(bp);if(!(b>0))return alert(\"購入単価を正しく入力してください\");const p=getPorts();p[favKey(market,x.code)]={market,code:x.code,name:x.name,qty:q,buyPrice:b};setPorts(p);renderPortfolio();alert(\"保有株に登録しました\")}\nfunction removeHolding(k){const p=getPorts();delete p[k];setPorts(p);renderPortfolio()}\nfunction quoteInfo(m,c){const rq=remoteQuotes?.[m]?.[String(c)];if(rq&&Number.isFinite(Number(rq.price)))return rq;const q=D?.quotes?.[m]?.[String(c)];if(q&&Number.isFinite(Number(q.price)))return q;for(const h of [\"short\",\"medium\",\"long\"]){const x=(D[m]?.[h]||[]).find(z=>String(z.code)===String(c));if(x)return x}return null}\nfunction latestPrice(m,c,fallback=null){const q=quoteInfo(m,c);if(q)return Number(q.price);const f=Number(fallback);return Number.isFinite(f)&&f>0?f:null}\n\nfunction normalizeCustomCode(){const el=$(\"#customCode\");el.value=el.value.trim().toUpperCase().replace(/\\.T$/i,\"\");return el.value}\nasync function fetchAnyQuote(m,c){\n  c=String(c||\"\").trim().toUpperCase().replace(/\\.T$/i,\"\");\n  if(!c)return null;\n  try{\n    const r=await fetch(\"/api/stock?market=\"+encodeURIComponent(m)+\"&code=\"+encodeURIComponent(c)+\"&_=\"+Date.now(),{cache:\"no-store\"});\n    const q=await r.json();\n    if(!r.ok||!q||!q.ok||!Number.isFinite(Number(q.price)))return null;\n    remoteQuotes[m]??={};\n    remoteQuotes[m][c]={name:q.name||c,code:c,price:Number(q.price),change_pct:Number(q.change_pct||0),previous_close:Number(q.previous_close||0),remote:true};\n    return remoteQuotes[m][c];\n  }catch(e){return null}\n}\nasync function autofillCustomStock(){\n  const m=$(\"#customMarket\").value,c=normalizeCustomCode(),st=$(\"#customLookup\");\n  if(!c){st.className=\"lookupstatus\";st.textContent=\"コードを入力すると会社名と現在値を確認します。\";return null}\n  $(\"#customName\").readOnly=false;$(\"#customNow\").readOnly=false;\n  st.className=\"lookupstatus\";st.textContent=\"会社名・現在値を取得中…\";\n  const q=await fetchAnyQuote(m,c);\n  if(c!==normalizeCustomCode()||m!==$(\"#customMarket\").value)return null;\n  if(q){\n    $(\"#customName\").value=q.name||c;\n    $(\"#customNow\").value=Number(q.price);\n    $(\"#customName\").readOnly=true;$(\"#customNow\").readOnly=true;\n    st.className=\"lookupstatus ok\";\n    st.textContent=\"✓ \"+(q.name||c)+\" ｜ 現在値 \"+money(q.price,m)+\" ｜ \"+(q.change_pct>=0?\"+\":\"\")+Number(q.change_pct||0).toFixed(2)+\"%\";\n    return q;\n  }\n  $(\"#customName\").readOnly=false;$(\"#customNow\").readOnly=false;$(\"#customNow\").value=\"\";\n  st.className=\"lookupstatus warn\";st.textContent=\"自動取得できませんでした。コードと市場を確認してください。\";\n  return null;\n}\nfunction editManualPrice(k){const p=getPorts(),v=p[k];if(!v)return;const q=quoteInfo(v.market,v.code);if(q)return alert(\"この銘柄は自動更新対象です。現在値は自動で更新されます。\");const x=prompt(\"現在値を入力してください\",v.manualPrice?String(v.manualPrice):\"\");if(x===null)return;const n=Number(x);if(!(n>0))return alert(\"現在値を正しく入力してください\");v.manualPrice=n;p[k]=v;setPorts(p);renderPortfolio()}\nfunction addCustomHolding(){const m=$(\"#customMarket\").value,c=normalizeCustomCode(),auto=quoteInfo(m,c),name=(auto?.name||$(\"#customName\").value).trim(),q=Number($(\"#customQty\").value),b=Number($(\"#customBuy\").value),manual=Number($(\"#customNow\").value);if(!c)return alert(\"銘柄コードを入力してください\");if(!name)return alert(\"銘柄名を入力してください\");if(!(q>0))return alert(\"株数を正しく入力してください\");if(!(b>0))return alert(\"購入単価を正しく入力してください\");if(!auto&&!(manual>0))return alert(\"この銘柄は自動価格取得の対象外です。現在値も入力してください\");const p=getPorts(),k=favKey(m,c);p[k]={market:m,code:c,name,qty:q,buyPrice:b,manualPrice:auto?null:manual>0?manual:null,custom:true};setPorts(p);[\"customCode\",\"customName\",\"customQty\",\"customBuy\",\"customNow\"].forEach(id=>$(\"#\"+id).value=\"\");$(\"#customName\").readOnly=false;$(\"#customNow\").readOnly=false;$(\"#customLookup\").className=\"lookupstatus\";$(\"#customLookup\").textContent=\"コードを入力すると銘柄名を確認します。\";renderPortfolio();alert(auto?`登録しました。${name} の現在値は自動更新されます`:\"登録しました。現在値は手入力で管理します\")}\nfunction renderPortfolio(){const p=getPorts(),rows=Object.entries(p);if(!rows.length){$(\"#portRows\").innerHTML='<div class=\"empty\">まだ保有株は登録されていません。</div>';return}const totals={japan:{cost:0,now:0,known:0},usa:{cost:0,now:0,known:0}};$(\"#portRows\").innerHTML=rows.map(([k,v])=>{const auto=quoteInfo(v.market,v.code),n=latestPrice(v.market,v.code,v.manualPrice),cost=v.qty*v.buyPrice,now=n==null?null:v.qty*n,pl=now==null?null:now-cost,pct=pl==null||!cost?null:pl/cost*100;t=totals[v.market]||totals.japan;t.cost+=cost;if(now!=null){t.now+=now;t.known++}const plText=pl==null?'現在値未設定':`${pl>=0?'+':''}${money(pl,v.market)} (${pct>=0?'+':''}${pct.toFixed(2)}%)`;const src=remoteQuotes?.[v.market]?.[String(v.code)]?'リアルタイム自動更新':auto?'データ自動更新':v.custom?'自動取得待ち':'手入力';return `<div class=\"portitem\"><b>${v.name}（${v.code}）</b><div class=\"portgrid\"><div><label>保有</label><b>${v.qty}株</b></div><div><label>購入単価</label><b>${money(v.buyPrice,v.market)}</b></div><div><label>損益 / 損益率</label><b class=\"${pl==null?'':pl>=0?'up':'down'}\">${plText}</b></div></div><div class=\"sourcehint\">現在値 ${n==null?'未設定':money(n,v.market)} ｜ ${src}</div><div class=\"actions\">${auto?'':`<button class=\"act\" onclick=\"editManualPrice('${k}')\">現在値を修正</button>`}<button class=\"act\" onclick=\"removeHolding('${k}')\">削除</button></div></div>`}).join(\"\")+`<div class=\"porttotals\">${totals.japan.cost?`<div class=\"total\"><span>日本株 取得額合計<b>${money(totals.japan.cost,'japan')}</b></span><span>現在額参考<b>${money(totals.japan.now,'japan')}</b></span></div>`:''}${totals.usa.cost?`<div class=\"total\"><span>米国株 取得額合計<b>${money(totals.usa.cost,'usa')}</b></span><span>現在額参考<b>${money(totals.usa.now,'usa')}</b></span></div>`:''}</div>`}\n\nasync function refreshRemotePortfolio(){\n  const p=getPorts(), jobs=[];\n  for(const v of Object.values(p)){\n    jobs.push(fetchAnyQuote(v.market,v.code));\n  }\n  if(jobs.length){await Promise.allSettled(jobs);renderPortfolio()}\n}\nfunction currentAlerts(){return (D[market]?.[horizon]||[]).slice(0,10).filter(x=>buyMatch(x).ok)}\nfunction renderAlerts(){const a=currentAlerts();$(\"#alertCount\").textContent=a.length;$(\"#alertRows\").innerHTML=a.length?a.map(x=>`<div class=\"alertitem\"><b>${x.name}（${x.code}）</b> <span class=\"sig ${sig(x.signal)}\">${x.signal}</span><div class=\"alertwhy\">${buyMatch(x).why}・総合 ${x.score}点</div></div>`).join(\"\"):'<div class=\"empty\">現在、この条件に一致する銘柄はありません。</div>'}\nasync function maybeNotify(){if(!('Notification' in window)||Notification.permission!==\"granted\")return;const a=currentAlerts();const key=market+\":\"+horizon+\":\"+a.map(x=>x.code).join(\",\"),prev=localStorage.getItem(\"tenx_last_alert\");if(a.length&&key!==prev){localStorage.setItem(\"tenx_last_alert\",key);if('serviceWorker' in navigator){const reg=await navigator.serviceWorker.ready;reg.showNotification(\"10X STOCK 買いアラート\",{body:`${market==='japan'?'日本株':'米国株'}・${L[horizon]}で ${a.length}銘柄が条件一致`,icon:'icon-192.png',badge:'icon-192.png'})}}}\nfunction render(){syncControls();const favs=getFavs();let a=(D[market]?.[horizon]||[]).slice(0,10);if(favOnly)a=a.filter(x=>favs.has(favKey(market,x.code)));const mname=market===\"japan\"?\"日本株\":\"米国株\";$(\"#title\").textContent=mname+\"・\"+L[horizon]+(favOnly?\" お気に入り\":\" TOP10\");$(\"#simtitle\").textContent=mname+\"・\"+L[horizon]+\" TOP10（各100株）\";$(\"#list\").innerHTML=a.length?a.map((x,i)=>{const bm=buyMatch(x),isfav=favs.has(favKey(market,x.code));return `<div class=\"stock\"><div class=\"r1\"><div class=\"rank\">${i+1}</div><div><div class=\"name\">${x.name}</div><div class=\"code\">${x.code}</div></div><a class=\"chart\" href=\"${chart(x)}\" target=\"_blank\" rel=\"noopener\">📈</a></div><div class=\"r2\"><div class=\"m\"><label>現在値</label><strong>${money(x.price)}</strong></div><div class=\"m\"><label>騰落率</label><strong class=\"${x.change_pct>=0?'up':'down'}\">${x.change_pct>0?'+':''}${x.change_pct}%</strong></div><div class=\"m\"><label>総合スコア</label><strong>${x.score}</strong></div><span class=\"sig ${sig(x.signal)}\">${x.signal}</span></div><div class=\"five\"><div class=\"f\"><label>割安</label><b class=\"${gclass(gv(x,'valuation'))}\">${gv(x,'valuation')} ${sv(x,'valuation')}</b></div><div class=\"f\"><label>品質</label><b class=\"${gclass(gv(x,'quality'))}\">${gv(x,'quality')} ${sv(x,'quality')}</b></div><div class=\"f\"><label>財務</label><b class=\"${gclass(gv(x,'financial'))}\">${gv(x,'financial')} ${sv(x,'financial')}</b></div><div class=\"f\"><label>技術</label><b class=\"${gclass(gv(x,'technical'))}\">${gv(x,'technical')} ${sv(x,'technical')}</b></div><div class=\"f\"><label>材料</label><b class=\"${gclass(gv(x,'catalyst'))}\">${gv(x,'catalyst')} ${sv(x,'catalyst')}</b></div></div>${bm.ok?`<div class=\"buymatch\">✅ 買い条件一致：${bm.why}</div>`:''}<div class=\"actions\"><button class=\"act ${isfav?'favon':''}\" onclick=\"toggleFav('${x.code}')\">${isfav?'★ お気に入り済':'☆ お気に入り'}</button><button class=\"act\" onclick='addHolding(${JSON.stringify(x).replace(/'/g,\"&#39;\")})'>💼 保有登録</button></div></div>`}).join(''):'<div class=\"empty\">該当する銘柄がありません。</div>';let sim=(D[market]?.[horizon]||[]).slice(0,10),tb=0,tn=0;$(\"#simrows\").innerHTML=sim.length?sim.map((x,i)=>{const e=entryInfo(x),b=e.price,n=Number(x.price),bv=b*100,nv=n*100,pl=nv-bv,p=b?(n/b-1)*100:0;tb+=bv;tn+=nv;return `<div class=\"srow\"><div class=\"sname\"><span>${i+1}. ${x.name}（${x.code}）</span><span class=\"${pl>=0?'up':'down'}\">${pl>=0?'+':''}${p.toFixed(2)}%</span></div><div class=\"smeta\">購入日 ${e.date} ｜ 購入単価 ${money(b)} → 現在 ${money(n)}</div><div class=\"sg\"><div class=\"sc\"><label>購入額（100株）</label><strong>${money(bv)}</strong></div><div class=\"sc\"><label>現在価値（100株）</label><strong>${money(nv)}</strong></div><div class=\"sc\"><label>累計損益</label><strong class=\"${pl>=0?'up':'down'}\">${pl>=0?'+':''}${money(pl)}</strong></div></div></div>`}).join(''):'<div class=\"empty\">仮想購入データがありません。</div>';const pl=tn-tb,pct=tb?(tn/tb-1)*100:0;$(\"#total\").innerHTML=`<span>合計購入額<b>${money(tb)}</b></span><span>現在評価額<b>${money(tn)}</b></span><span>累計損益<b class=\"${pl>=0?'up':'down'}\">${pl>=0?'+':''}${money(pl)}</b></span><span>累計損益率<b class=\"${pl>=0?'up':'down'}\">${pl>=0?'+':''}${pct.toFixed(2)}%</b></span>`;renderAlerts();renderPortfolio();maybeNotify()}\nfunction loadData(){$(\"#updated\").textContent=\"最終更新：読込中…\";return Promise.all([fetch(\"https://raw.githubusercontent.com/shu39a-lang/10x-stock-project/main/tenx_data.json?\"+Date.now(),{cache:\"no-store\"}).then(r=>r.json()),fetch(\"https://raw.githubusercontent.com/shu39a-lang/10x-stock-project/main/tenx_history.json?\"+Date.now(),{cache:\"no-store\"}).then(r=>r.json())]).then(([d,h])=>{D=d;H=Array.isArray(h)?h:[];$(\"#updated\").textContent=\"最終更新：\"+d.updated_at;render();refreshRemotePortfolio()}).catch(()=>{$(\"#updated\").textContent=\"データ読込エラー\"})}\n\n// iPhone/Safari対応: 操作イベントを明示的に登録\nfunction bindControls(){\n  $(\"#jp\").addEventListener(\"click\",()=>{market=\"japan\";localStorage.setItem(\"tenx_market\",market);render()});\n  $(\"#us\").addEventListener(\"click\",()=>{market=\"usa\";localStorage.setItem(\"tenx_market\",market);render()});\n  document.querySelectorAll(\".h\").forEach(b=>b.addEventListener(\"click\",()=>{horizon=b.dataset.h;localStorage.setItem(\"tenx_horizon\",horizon);render()}));\n  $(\"#refresh\").addEventListener(\"click\",()=>loadData());\n  $(\"#alertsBtn\").addEventListener(\"click\",()=>{$(\"#alertbox\").classList.toggle(\"show\")});\n  $(\"#favBtn\").addEventListener(\"click\",()=>{favOnly=!favOnly;render()});\n  $(\"#portBtn\").addEventListener(\"click\",()=>{$(\"#portbox\").classList.toggle(\"show\");renderPortfolio();refreshRemotePortfolio()});\n  let lookupTimer=null;\n  $(\"#customCode\").addEventListener(\"input\",()=>{\n    clearTimeout(lookupTimer);\n    const raw=$(\"#customCode\").value.trim();\n    $(\"#customLookup\").className=\"lookupstatus\";\n    $(\"#customLookup\").textContent=raw?\"入力を確認中…\":\"コードを入力すると会社名と現在値を確認します。\";\n    lookupTimer=setTimeout(autofillCustomStock,350);\n  });\n  $(\"#customCode\").addEventListener(\"change\",autofillCustomStock);\n  $(\"#customCode\").addEventListener(\"blur\",autofillCustomStock);\n  $(\"#customMarket\").addEventListener(\"change\",()=>{if($(\"#customCode\").value.trim())autofillCustomStock()});\n  $(\"#customAddBtn\").addEventListener(\"click\",addCustomHolding);\n  $(\"#notifyBtn\").addEventListener(\"click\",async()=>{if(!(\"Notification\" in window))return alert(\"この端末では通知に対応していません\");const p=await Notification.requestPermission();alert(p===\"granted\"?\"通知をONにしました\":\"通知は許可されませんでした\")});\n}\nbindControls();\nrender();loadData();</script>\n</body>\n</html>\n";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,OPTIONS",
          "access-control-allow-headers": "*",
          "cache-control": "no-store"
        }
      });
    }

    if (url.pathname === "/api/stock") return stockLookup(request);

    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(APP_HTML, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store, no-cache, must-revalidate, max-age=0"
        }
      });
    }

    return new Response("Not found", { status: 404 });
  }
};
