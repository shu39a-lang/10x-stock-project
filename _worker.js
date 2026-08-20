const YAHOO = 'https://query1.finance.yahoo.com/v8/finance/chart/';

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=60',
      ...extra,
    },
  });
}

function normalizeSymbol(market, code) {
  const c = String(code || '').trim().toUpperCase().replace(/\.T$/i, '');
  if (!c || !/^[0-9A-Z.\-^=]+$/.test(c)) return null;
  if (market === 'japan') {
    if (!/^\d{4}[A-Z]?$/.test(c)) return null;
    return c + '.T';
  }
  if (market === 'usa') return c;
  return null;
}

async function stockLookup(request) {
  const url = new URL(request.url);
  const market = url.searchParams.get('market');
  const code = String(url.searchParams.get('code') || '').trim().toUpperCase().replace(/\.T$/i, '');
  const symbol = normalizeSymbol(market, code);
  if (!symbol) return json({ ok: false, error: 'invalid_code' }, 400);

  try {
    const upstream = await fetch(`${YAHOO}${encodeURIComponent(symbol)}?interval=1d&range=5d`, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; 10XStockProject/1.0)',
      },
      cf: { cacheTtl: 60, cacheEverything: true },
    });
    if (!upstream.ok) return json({ ok: false, error: 'quote_unavailable' }, 502);
    const body = await upstream.json();
    const result = body?.chart?.result?.[0];
    const meta = result?.meta;
    const price = Number(meta?.regularMarketPrice);
    if (!meta || !Number.isFinite(price)) return json({ ok: false, error: 'not_found' }, 404);

    const prev = Number(meta?.chartPreviousClose ?? meta?.previousClose);
    const changePct = Number.isFinite(prev) && prev > 0 ? (price / prev - 1) * 100 : 0;
    const name = meta.longName || meta.shortName || meta.symbol || code;
    return json({
      ok: true,
      market,
      code,
      symbol: meta.symbol || symbol,
      name,
      price,
      change_pct: Math.round(changePct * 100) / 100,
      currency: meta.currency || (market === 'japan' ? 'JPY' : 'USD'),
      exchange: meta.fullExchangeName || meta.exchangeName || '',
      time: meta.regularMarketTime || null,
    });
  } catch (e) {
    return json({ ok: false, error: 'lookup_failed' }, 500);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/stock') return stockLookup(request);
    return env.ASSETS.fetch(request);
  },
};
