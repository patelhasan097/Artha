/**
 * ARTHA PROXY WORKER
 * ───────────────────
 * Deploy free on Cloudflare Workers (workers.cloudflare.com — no card needed,
 * 100,000 requests/day free).
 *
 * What this does:
 *  1. Talks to Yahoo Finance's data endpoints, which need no API key but DO
 *     now require a session "cookie + crumb" handshake for /quote and
 *     /quoteSummary (Yahoo added this bot-check in 2024). This Worker does
 *     that handshake once, caches it, and reuses it — the same thing a
 *     browser or the popular `yfinance` library does. /chart doesn't need it.
 *  2. Talks to MFapi.in for Indian mutual fund NAVs (no key needed there at all).
 *  3. Fixes CORS so the browser can call these directly.
 *  4. Locks access to your own domain (see ALLOWED_ORIGIN) so nobody else
 *     rides your free quota.
 *
 * Routes:
 *   /quote?symbols=RELIANCE.NS,TCS.NS      → live price quotes
 *   /chart?symbol=RELIANCE.NS&range=1mo    → historical OHLC for charts
 *   /fundamentals?symbol=RELIANCE.NS       → EPS growth, P/E, dividend yield
 *   /indices                                → NIFTY 50 / SENSEX / BANK NIFTY
 *   /news?q=Reliance%20Industries           → Google News RSS → JSON
 *   /mf/search?q=hdfc%20flexi               → mutual fund scheme search
 *   /mf/:code                               → mutual fund NAV history
 */

const ALLOWED_ORIGIN = "*"; // tighten to "https://YOUR-USERNAME.github.io" once deployed — see worker/SETUP.md

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "public, max-age=10",
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", ...corsHeaders() } });
}

// ─────────────────────────────────────────────────────────
//  Yahoo session (cookie + crumb) — cached per Worker isolate.
//  Workers reuse the same isolate for a while, so this in-memory cache
//  usually survives across many requests. Refreshed hourly regardless.
// ─────────────────────────────────────────────────────────
let cachedSession = null;

async function getYahooSession() {
  if (cachedSession && Date.now() - cachedSession.fetchedAt < 50 * 60 * 1000) return cachedSession;

  // Step 1 — grab a session cookie. fc.yahoo.com hands one out without a GDPR
  // consent wall, which is more reliable than hitting finance.yahoo.com directly.
  const cookieRes = await fetch("https://fc.yahoo.com", {
    headers: { "User-Agent": BROWSER_UA },
    redirect: "manual",
  });
  const setCookie = cookieRes.headers.get("set-cookie") || "";
  const cookie = setCookie.split(";")[0];

  if (!cookie) {
    cachedSession = { cookie: "", crumb: "", fetchedAt: Date.now() };
    return cachedSession;
  }

  // Step 2 — trade that cookie for a crumb token.
  const crumbRes = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
    headers: { "User-Agent": BROWSER_UA, "Cookie": cookie },
  });
  const crumb = (await crumbRes.text()).trim();

  cachedSession = { cookie, crumb: /^[\w-]+$/.test(crumb) ? crumb : "", fetchedAt: Date.now() };
  return cachedSession;
}

async function yahooFetch(url) {
  const session = await getYahooSession();
  const finalUrl = session.crumb ? `${url}&crumb=${encodeURIComponent(session.crumb)}` : url;
  const res = await fetch(finalUrl, {
    headers: { "User-Agent": BROWSER_UA, "Accept": "application/json", ...(session.cookie ? { "Cookie": session.cookie } : {}) },
  });
  if (res.status === 401) {
    // Crumb went stale — refresh once and retry
    cachedSession = null;
    const retrySession = await getYahooSession();
    const retryUrl = retrySession.crumb ? `${url}&crumb=${encodeURIComponent(retrySession.crumb)}` : url;
    return fetch(retryUrl, { headers: { "User-Agent": BROWSER_UA, "Accept": "application/json", ...(retrySession.cookie ? { "Cookie": retrySession.cookie } : {}) } });
  }
  return res;
}

// ─────────────────────────────────────────────────────────
//  Yahoo Finance routes
// ─────────────────────────────────────────────────────────
async function handleQuote(url) {
  const symbols = url.searchParams.get("symbols");
  if (!symbols) return json({ error: "symbols param required" }, 400);
  const yUrl = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,regularMarketPreviousClose,regularMarketDayHigh,regularMarketDayLow,fiftyTwoWeekHigh,fiftyTwoWeekLow,shortName,trailingPE,trailingAnnualDividendYield`;
  const res = await yahooFetch(yUrl);
  return json(await res.json());
}

async function handleChart(url) {
  const symbol = url.searchParams.get("symbol");
  const range = url.searchParams.get("range") || "1mo";
  const intervalMap = { "1d": "5m", "5d": "15m", "1mo": "1d", "3mo": "1d", "1y": "1wk" };
  const interval = intervalMap[range] || "1d";
  if (!symbol) return json({ error: "symbol param required" }, 400);
  // v8/finance/chart doesn't require the crumb, but sending it (when we have one)
  // never hurts and helps if Yahoo tightens this endpoint later too.
  const yUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
  const res = await yahooFetch(yUrl);
  return json(await res.json());
}

async function handleFundamentals(url) {
  const symbol = url.searchParams.get("symbol");
  if (!symbol) return json({ error: "symbol param required" }, 400);
  const modules = "defaultKeyStatistics,financialData,summaryDetail,earningsTrend,price";
  const yUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=${modules}`;
  const res = await yahooFetch(yUrl);
  return json(await res.json());
}

async function handleIndices() {
  const symbols = "%5ENSEI,%5EBSESN,%5ENSEBANK"; // NIFTY 50, SENSEX, BANK NIFTY
  const yUrl = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${symbols}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,shortName`;
  const res = await yahooFetch(yUrl);
  return json(await res.json());
}

// Google News RSS → JSON. Public, designed for consumption, far more stable
// than scraping NSE's own site (which actively blocks non-browser traffic).
async function handleNews(url) {
  const q = url.searchParams.get("q");
  if (!q) return json({ error: "q param required" }, 400);
  const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}+when:14d&hl=en-IN&gl=IN&ceid=IN:en`;
  const res = await fetch(rssUrl, { headers: { "User-Agent": BROWSER_UA } });
  const xml = await res.text();

  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRegex.exec(xml)) !== null && items.length < 12) {
    const block = m[1];
    const get = (tag) => {
      const mm = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`).exec(block);
      return mm ? mm[1].replace("<![CDATA[", "").replace("]]>", "").trim() : "";
    };
    items.push({ title: get("title"), link: get("link"), pubDate: get("pubDate"), source: get("source") });
  }
  return json({ items });
}

// ─────────────────────────────────────────────────────────
//  Mutual funds — MFapi.in (free, no key, built for this exact use case)
// ─────────────────────────────────────────────────────────
async function handleMfSearch(url) {
  const q = url.searchParams.get("q");
  if (!q) return json({ error: "q param required" }, 400);
  const res = await fetch(`https://api.mfapi.in/mf/search?q=${encodeURIComponent(q)}`, { headers: { "User-Agent": BROWSER_UA } });
  return json(await res.json());
}

async function handleMfScheme(code) {
  const res = await fetch(`https://api.mfapi.in/mf/${encodeURIComponent(code)}`, { headers: { "User-Agent": BROWSER_UA } });
  return json(await res.json());
}

async function handleOptions() {
  return new Response(null, { headers: corsHeaders() });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return handleOptions();

    try {
      if (url.pathname === "/quote") return await handleQuote(url);
      if (url.pathname === "/chart") return await handleChart(url);
      if (url.pathname === "/fundamentals") return await handleFundamentals(url);
      if (url.pathname === "/indices") return await handleIndices();
      if (url.pathname === "/news") return await handleNews(url);
      if (url.pathname === "/mf/search") return await handleMfSearch(url);
      if (url.pathname.startsWith("/mf/")) return await handleMfScheme(url.pathname.replace("/mf/", ""));

      return json({ status: "ok", message: "Artha proxy worker is running", routes: ["/quote", "/chart", "/fundamentals", "/indices", "/news", "/mf/search", "/mf/:code"] });
    } catch (err) {
      return json({ error: err.message || "proxy error" }, 500);
    }
  },
};
