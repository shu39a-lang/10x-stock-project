function jres(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
      "pragma": "no-cache",
      "expires": "0"
    }
  });
}

function cleanCode(market, code) {
  const c = String(code || "").trim().toUpperCase().replace(/\.T$/i, "");
  if (market === "japan") return /^\d{4}[A-Z]?$/.test(c) ? c : null;
  if (market === "usa") return /^[A-Z0-9.\-]+$/.test(c) ? c : null;
  return null;
}

function decodeHtml(s) {
  return String(s || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function parseNumber(s) {
  if (!s) return null;
  const x = String(s).replace(/[¥$,\s]/g, "").replace(/[^\d.\-]/g, "");
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

async function googleFinanceQuote(code) {
  const target = `https://www.google.com/finance/quote/${encodeURIComponent(code)}:TYO?hl=ja`;
  const r = await fetch(target, {
    headers: {
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "ja,en-US;q=0.8,en;q=0.6",
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1"
    },
    cache: "no-store",
    cf: { cacheTtl: 0, cacheEverything: false }
  });
  if (!r.ok) return null;
  const html = await r.text();

  // Current Google Finance price node. Keep several fallbacks to survive class changes.
  const pricePatterns = [
    /class="YMlKec fxKbKc"[^>]*>([^<]+)</,
    /class="YMlKec[^"]*"[^>]*>([^<]+)</,
    /data-last-price="([^"]+)"/,
    /"price":\s*"?(?:(?:JPY|¥)\s*)?([0-9][0-9,]*(?:\.[0-9]+)?)/i
  ];
  let price = null;
  for (const p of pricePatterns) {
    const m = html.match(p);
    if (m) {
      price = parseNumber(decodeHtml(m[1]));
      if (Number.isFinite(price)) break;
    }
  }
  if (!Number.isFinite(price)) return null;

  const namePatterns = [
    /class="zzDege"[^>]*>([^<]+)</,
    /<title>([^<|]+?)(?:\s*[|–-]\s*Google Finance)?<\/title>/i,
    /property="og:title"\s+content="([^"]+)"/i
  ];
  let name = "";
  for (const p of namePatterns) {
    const m = html.match(p);
    if (m) {
      name = decodeHtml(m[1]).trim();
      if (name) break;
    }
  }

  return { price, name, source: "google-finance" };
}

async function yahooUSQuote(code) {
  const u = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(code)}?interval=1d&range=5d&_=${Date.now()}`;
  const r = await fetch(u, {
    headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" },
    cache: "no-store",
    cf: { cacheTtl: 0, cacheEverything: false }
  });
  if (!r.ok) return null;
  const b = await r.json();
  const meta = b?.chart?.result?.[0]?.meta;
  const price = Number(meta?.regularMarketPrice);
  if (!meta || !Number.isFinite(price)) return null;
  return {
    price,
    name: meta.longName || meta.shortName || code,
    source: "yahoo-us",
    currency: meta.currency || "USD",
    time: meta.regularMarketTime || null
  };
}

async function stockLookup(request) {
  const url = new URL(request.url);
  const market = String(url.searchParams.get("market") || "").toLowerCase();
  const code = cleanCode(market, url.searchParams.get("code"));
  if (!code) return jres({ ok:false, error:"invalid_code" }, 400);

  try {
    if (market === "japan") {
      const q = await googleFinanceQuote(code);
      if (!q) return jres({ ok:false, error:"quote_unavailable" }, 502);
      return jres({
        ok:true,
        market,
        code,
        symbol:`${code}:TYO`,
        name:q.name || code,
        price:q.price,
        currency:"JPY",
        source:q.source
      });
    }

    const q = await yahooUSQuote(code);
    if (!q) return jres({ ok:false, error:"quote_unavailable" }, 502);
    return jres({
      ok:true,
      market,
      code,
      symbol:code,
      name:q.name || code,
      price:q.price,
      currency:q.currency || "USD",
      time:q.time || null,
      source:q.source
    });
  } catch (_) {
    return jres({ ok:false, error:"lookup_failed" }, 500);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/stock") return stockLookup(request);
    return env.ASSETS.fetch(request);
  }
};
