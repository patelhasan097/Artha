# Artha — Smart Portfolio Tracker (v2.1)

A premium, installable PWA for tracking your NSE/BSE stocks and Indian mutual
funds in real time — with an automatic Peter Lynch fair-value check on every
stock, a category-wise mutual fund tracker, and a clean inbox for results,
board meetings and news.

## What changed in v2.1

- **Fixed: live data now actually works.** Yahoo Finance added a
  cookie+crumb security check to its quote API in 2024 — the Worker now does
  that handshake for you (see `worker/worker.js`). This is the #1 fix; see
  "Why the Worker is required" below.
- **Fixed: the infinite chart spinner.** A DOM ordering bug meant the loading
  spinner never cleared even after data arrived. Rebuilt with a proper
  loading/ready/error state machine.
- **New: Mutual Funds tracking**, powered by MFapi.in (a free, no-key,
  India-specific NAV API). Switch between Stocks and Mutual Funds right
  inside the Portfolio tab, same as Groww's layout.
- **New: Privacy mode.** Tap the eye icon in the header to mask rupee amounts
  — percentages stay visible. Same pattern Groww and Dhan use.
- **New: Sort control** on your holdings (Value / P&L / P&L % / Name),
  Groww-style.
- **New: Inline sparklines** on every holding row.
- **Redesigned PIN screens** — greets you by name, OTP-box style input,
  matching the pattern used by Groww (a well-tested, trusted convention for
  financial app PINs).
- **Secrets are now genuinely never committed to GitHub** — a GitHub Actions
  workflow builds `js/config.js` from your repo's Secrets at deploy time.
  See "Secrets" below.

## Setup (in order)

### 1. Firebase (auth + database)
1. [console.firebase.google.com](https://console.firebase.google.com) → New Project.
2. **Authentication** → Sign-in method → enable **Google** and **Email/Password**.
3. **Firestore Database** → Create database → **production mode**, region `asia-south1`.
4. **Firestore Database → Rules** → paste `firestore.rules` → Publish.
5. **Project Settings ⚙️ → Your apps → Web `</>`** → register app → copy the config.
   *(Keep this tab open — you'll paste these six values into GitHub Secrets, not into any file.)*

### 2. Proxy Worker — **required**, not optional, for live prices
Follow `worker/SETUP.md` (5 minutes, Cloudflare free plan, no card).
This is what performs Yahoo's cookie+crumb handshake — without it, stock
quotes, sector %, and Peter Lynch valuations cannot load, full stop. Mutual
fund NAVs and stock charts will still work without it, just less reliably.

### 3. Icons
Open `generate-icons.html` in your browser → **Generate & Download All** →
move the PNGs into `assets/icons/`.

### 4. Push to GitHub
```bash
git init
git add .
git commit -m "Artha v2.1"
git remote add origin https://github.com/YOUR_USERNAME/artha.git
git push -u origin main
```
Notice `js/config.js` isn't in this commit — it's in `.gitignore` on purpose.

### 5. Add your secrets (this is what keeps keys off GitHub)
Repo → **Settings → Secrets and variables → Actions → New repository secret.**
Add each of these one at a time:

| Secret name | Value |
|---|---|
| `FIREBASE_API_KEY` | from step 1 |
| `FIREBASE_AUTH_DOMAIN` | from step 1 |
| `FIREBASE_PROJECT_ID` | from step 1 |
| `FIREBASE_STORAGE_BUCKET` | from step 1 |
| `FIREBASE_MESSAGING_SENDER_ID` | from step 1 |
| `FIREBASE_APP_ID` | from step 1 |
| `PROXY_BASE_URL` | your Worker URL from step 2 |

### 6. Turn on GitHub Pages via Actions
Repo → **Settings → Pages** → Source: **GitHub Actions** (not "Deploy from a branch").
Push anything to `main` (or re-run the workflow from the **Actions** tab) —
the workflow in `.github/workflows/deploy.yml` builds `js/config.js` from
your secrets and deploys. Your app: `https://YOUR_USERNAME.github.io/artha`

### 7. Authorize the domain in Firebase
**Authentication → Settings → Authorized domains** → add your Pages URL.

### 8. Lock the Worker to your domain
Once your Pages URL is live, follow the last step in `worker/SETUP.md` to
restrict `ALLOWED_ORIGIN` in `worker.js` to just your app.

## Local testing (optional, before you push)
```bash
cp js/config.example.js js/config.js
# edit js/config.js with your real values — it's gitignored, safe to fill in
python3 -m http.server 8000
# open http://localhost:8000
```

## Project structure
```
artha/
├── .github/workflows/deploy.yml   ← builds config.js from Secrets, deploys
├── .gitignore                      ← keeps js/config.js out of git
├── index.html
├── manifest.json
├── sw.js
├── offline.html
├── firestore.rules
├── generate-icons.html
├── css/style.css
├── js/
│   ├── config.example.js          ← committed template, no real values
│   ├── config.js                  ← gitignored; local-only or Actions-generated
│   ├── utils.js
│   ├── auth.js
│   ├── stock-api.js
│   ├── mf-api.js                  ← mutual fund NAV data (MFapi.in)
│   ├── lynch.js
│   ├── charts.js
│   ├── portfolio.js
│   ├── mutualfunds.js
│   ├── watchlist.js
│   ├── inbox.js
│   └── app.js
├── assets/{logo.svg, icons/}
└── worker/{worker.js, SETUP.md}    ← deploy separately to Cloudflare
```

See `USER_GUIDE.md` for how to use every feature once it's live.
