# Artha Proxy Worker — Setup (5 minutes, free forever)

This is what makes live prices, charts, Peter Lynch fundamentals and news
actually reliable — instead of the public CORS proxies that keep going down.

## Deploy it

1. Go to **dash.cloudflare.com** → sign up free (no card required).
2. Left sidebar → **Workers & Pages** → **Create** → **Create Worker**.
3. Give it a name, e.g. `artha-proxy` → **Deploy** (deploys a starter template first).
4. Click **Edit code** → delete everything → paste the full contents of `worker.js`.
5. Click **Deploy** again.
6. Copy your Worker URL — looks like `https://artha-proxy.YOUR-SUBDOMAIN.workers.dev`.

## Connect it to the app

Open `js/config.js` in your project and paste that URL into:
```js
const PROXY_BASE_URL = "https://artha-proxy.YOUR-SUBDOMAIN.workers.dev";
```

## Lock it to your domain (recommended, optional)

Once your app is live on GitHub Pages, open `worker.js` line ~20 and change:
```js
const ALLOWED_ORIGIN = "*";
```
to:
```js
const ALLOWED_ORIGIN = "https://YOUR-GITHUB-USERNAME.github.io";
```
Redeploy the Worker (paste updated code → Deploy). This stops anyone else from
using your free quota — only your app's domain can call it.

## Why the Worker is required now, not just "nice to have"

Yahoo tightened its unofficial API in 2024 — live quotes now need a
cookie+crumb handshake (the same two-step dance a real browser does). A
plain CORS pass-through proxy can't do that handshake because it can't hold
a cookie across two chained requests. The Worker can, and does it for you
automatically (see `getYahooSession()` in `worker.js`). **Without the Worker
deployed, live prices, sector %, and Peter Lynch valuations won't load —
that's expected, not a bug.** Historical charts still work either way since
that endpoint doesn't need the handshake.

## That's it

No API keys to hide — Yahoo Finance and MFapi.in's data endpoints don't
require one. The Worker's job is the cookie/crumb handshake, reliability,
and CORS — not secrecy. If you ever add a paid data provider later, put its
key in **Settings → Variables → Add secret** on the Worker (never in a file
that goes to GitHub) and read it as `env.YOUR_KEY` inside `worker.js`.
