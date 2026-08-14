# Artha — User Guide

Ye guide batati hai ki app ke andar har feature kaise use karna hai aur kis kaam aata hai.

---

## 1. Sign in aur security

- **Google ya Email se sign in** karo — pehli baar.
- Onboarding ke baad **6-digit PIN** banao — ye har baar app kholne pe lagega.
- PIN ke saath **biometric (Face ID / Fingerprint)** bhi on kar sakte ho — device support karta ho to setup ke waqt hi puchega, ya baad me **Settings → Biometric unlock** se on karo.
- PIN 5 baar galat try karne pe app temporarily lock ho jaata hai — sign out karke wapas sign in karna padega.

## 2. Home tab — Dashboard

- **Total Portfolio Value** — sabse upar bada number, tumhare saare stocks ki current value.
- Neeche **Invested / Today's P&L / Holdings** — teen quick stats.
- **Sector breakdown** — donut chart, kaunsa sector kitna % hai tumhare portfolio mein.
- **Top performers** — best aur worst 4 stocks ek nazar mein.
- Header mein **NIFTY 50 / SENSEX / BANK NIFTY** live ticker — market ka overall mood dikhata hai.

## 3. Portfolio tab — Stocks aur Mutual Funds dono

Upar do buttons milenge: **Stocks** aur **Mutual Funds** — dono alag-alag track hote hain, ek hi jagah se switch karo.

### Stocks
- **+ button** (neeche right) se naya stock add karo — symbol search karo, exchange (NSE/BSE), sector, buy price, quantity, buy date bharo.
- **Holdings / Analytics** toggle — Holdings mein list dikhti hai, Analytics mein sector allocation, best/worst, aur P&L bar chart.
- **Sort** — Value, P&L, P&L%, ya Name se apni list arrange karo.
- Har stock card pe tap karo → poora detail khulega: live chart (1D/5D/1M/3M/1Y), P&L, 52-week high/low, **aur Peter Lynch Fair Value Check** (neeche point 6 dekho).

### Mutual Funds
- **+ button** se fund add karo — naam search karo (AMFI ke database se), units, buy NAV, investment date bharo.
- NAV daily update hoti hai (mutual funds real-time trade nahi karte, isliye din mein ek baar NAV change hoti hai — ye normal hai).
- Fund pe tap karo → NAV history chart, invested/current/P&L, aur fund house ka naam dikhega.
- Analytics mein **category allocation** milega — Equity/Debt/Hybrid/Index mein kitna paisa hai.

## 4. Watchlist tab

- Jo stocks tumhare paas nahi hain lekin nazar rakhni hai, unhe yahan add karo.
- Har row mein mini sparkline chart + live price + % change.
- **+ icon** se watchlist se seedha portfolio mein bhi add kar sakte ho.

## 5. Inbox tab

- Tumhare portfolio + watchlist ke stocks ke **quarterly results, board meetings, dividends, aur news** — sab ek jagah.
- **Results / Board meetings / Dividends / News** filters se chhaanp sakte ho.
- Unread items pe blue dot dikhega; **Mark all read** se sab clear karo.
- Item pe tap karke summary padho; title pe dobara tap karo to original article khul jayega.

## 6. Peter Lynch Fair Value Check (har stock detail mein)

Ye Peter Lynch ki book *One Up On Wall Street* wala formula hai:

```
Result = (Future EPS Growth % + Dividend Yield %) ÷ P/E Ratio
```

- **Result < 1.0** → Overvalued (price growth se aage nikal gayi hai)
- **1.0 – 1.5** → Fairly Valued
- **Result > 1.5** → Undervalued (growth ke hisaab se sasta hai)

Ek "fair price" bhi dikhta hai — rough estimate ki stock ka kya price hona chahiye. (i) icon pe tap karke poora explanation padh sakte ho.

**Note:** Agar kisi stock ke liye "not enough analyst data" dikhe, to iska matlab Yahoo ke paas us company ka growth-estimate data nahi hai — chhoti ya newly-listed companies mein aksar hota hai, ye bug nahi hai.

## 7. Privacy mode (eye icon)

Header mein eye 👁 icon — tap karo to saare rupee amounts `₹••••` ho jayenge, sirf % dikhega. Kisi ke saamne phone dikhana ho to kaam aata hai. Doobara tap karo to wapas normal.

## 8. Settings tab

- **Change PIN** — naya PIN set karo.
- **Biometric unlock** — on/off.
- **Price refresh rate** — 10s / 30s / 1 min (market hours ke dauraan kitni jaldi prices update ho).
- **Inbox notifications** — on/off toggle.
- **Export to CSV** — apna poora portfolio Excel-compatible file mein download karo.
- **Sign out**.

## 9. App install karna (PWA)

Browser mein "Add to Home Screen" ya "Install App" prompt aayega (Chrome/Edge pe address bar mein bhi icon dikhta hai) — tap karke install karo, phir app native jaisi chalegi, bina browser bar ke.

## 10. Kuch cheezein jo normal hain, bug nahi

- **Mutual fund NAV din mein ek hi baar update hoti hai** (usually raat ko) — ye AMFI ka rule hai, sab MF apps mein aisa hi hota hai.
- **Weekend/market-closed hours mein** live prices "as of last close" rahenge, ticker "Market closed" dikhayega.
- Kisi stock ka **Lynch valuation na dikhna** — upar point 6 dekho, data availability ka masla hai.

---

Koi feature samajh na aaye ya kuch expected se alag behave kare — screenshot bhej dena, dekh lete hain.
