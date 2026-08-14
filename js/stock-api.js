const StockAPI = {
  prices: {},        // 'SYMBOL.EXCH' -> { price, change, changePct, ... }
  fundamentals: {},  // 'SYMBOL.EXCH' -> { epsGrowth, dividendYield, pe, ... }
  indices: {},        // 'NIFTY' | 'SENSEX' | 'BANKNIFTY' -> { price, change, changePct }
  history: [],         // rolling portfolio-value snapshots for the hero sparkline (session-only)

  _timer: null,
  _interval: 30000,
  _publicProxies: [
    'https://corsproxy.io/?url=',
    'https://api.allorigins.win/raw?url=',
  ],

  // ─── NSE/BSE stock list ───
  STOCKS: [
    {s:'RELIANCE',n:'Reliance Industries',sec:'Energy'},
    {s:'TCS',n:'Tata Consultancy Services',sec:'Technology'},
    {s:'HDFCBANK',n:'HDFC Bank',sec:'Finance'},
    {s:'INFY',n:'Infosys',sec:'Technology'},
    {s:'ICICIBANK',n:'ICICI Bank',sec:'Finance'},
    {s:'WIPRO',n:'Wipro',sec:'Technology'},
    {s:'BAJFINANCE',n:'Bajaj Finance',sec:'Finance'},
    {s:'BHARTIARTL',n:'Bharti Airtel',sec:'Telecom'},
    {s:'AXISBANK',n:'Axis Bank',sec:'Finance'},
    {s:'HINDUNILVR',n:'Hindustan Unilever',sec:'FMCG'},
    {s:'ITC',n:'ITC Limited',sec:'FMCG'},
    {s:'TATAMOTORS',n:'Tata Motors',sec:'Auto'},
    {s:'MARUTI',n:'Maruti Suzuki India',sec:'Auto'},
    {s:'SUNPHARMA',n:'Sun Pharmaceuticals',sec:'Pharma'},
    {s:'TATASTEEL',n:'Tata Steel',sec:'Metals'},
    {s:'POWERGRID',n:'Power Grid Corporation',sec:'Utilities'},
    {s:'ADANIENT',n:'Adani Enterprises',sec:'Energy'},
    {s:'HCLTECH',n:'HCL Technologies',sec:'Technology'},
    {s:'KOTAKBANK',n:'Kotak Mahindra Bank',sec:'Finance'},
    {s:'LT',n:'Larsen & Toubro',sec:'Infrastructure'},
    {s:'ASIANPAINT',n:'Asian Paints',sec:'Chemicals'},
    {s:'ONGC',n:'Oil & Natural Gas Corp',sec:'Energy'},
    {s:'NTPC',n:'NTPC Limited',sec:'Utilities'},
    {s:'SBILIFE',n:'SBI Life Insurance',sec:'Insurance'},
    {s:'BAJAJFINSV',n:'Bajaj Finserv',sec:'Finance'},
    {s:'HDFCLIFE',n:'HDFC Life Insurance',sec:'Insurance'},
    {s:'DRREDDY',n:"Dr. Reddy's Laboratories",sec:'Pharma'},
    {s:'ULTRACEMCO',n:'UltraTech Cement',sec:'Cement'},
    {s:'M&M',n:'Mahindra & Mahindra',sec:'Auto'},
    {s:'GRASIM',n:'Grasim Industries',sec:'Cement'},
    {s:'DIVISLAB',n:"Divi's Laboratories",sec:'Pharma'},
    {s:'JSWSTEEL',n:'JSW Steel',sec:'Metals'},
    {s:'CIPLA',n:'Cipla',sec:'Pharma'},
    {s:'TECHM',n:'Tech Mahindra',sec:'Technology'},
    {s:'HEROMOTOCO',n:'Hero MotoCorp',sec:'Auto'},
    {s:'APOLLOHOSP',n:'Apollo Hospitals',sec:'Healthcare'},
    {s:'COALINDIA',n:'Coal India',sec:'Metals'},
    {s:'TATACONSUM',n:'Tata Consumer Products',sec:'FMCG'},
    {s:'EICHERMOT',n:'Eicher Motors',sec:'Auto'},
    {s:'BRITANNIA',n:'Britannia Industries',sec:'FMCG'},
    {s:'SBIN',n:'State Bank of India',sec:'Finance'},
    {s:'BPCL',n:'Bharat Petroleum',sec:'Energy'},
    {s:'INDUSINDBK',n:'IndusInd Bank',sec:'Finance'},
    {s:'VEDL',n:'Vedanta Limited',sec:'Metals'},
    {s:'GODREJCP',n:'Godrej Consumer Products',sec:'FMCG'},
    {s:'DABUR',n:'Dabur India',sec:'FMCG'},
    {s:'NESTLEIND',n:'Nestle India',sec:'FMCG'},
    {s:'ADANIPORTS',n:'Adani Ports & SEZ',sec:'Infrastructure'},
    {s:'BAJAJ-AUTO',n:'Bajaj Auto',sec:'Auto'},
    {s:'SHREECEM',n:'Shree Cement',sec:'Cement'},
    {s:'DMART',n:'Avenue Supermarts (DMart)',sec:'FMCG'},
    {s:'PIDILITIND',n:'Pidilite Industries',sec:'Chemicals'},
    {s:'SIEMENS',n:'Siemens India',sec:'Infrastructure'},
    {s:'HAVELLS',n:'Havells India',sec:'Technology'},
    {s:'MARICO',n:'Marico',sec:'FMCG'},
    {s:'MUTHOOTFIN',n:'Muthoot Finance',sec:'Finance'},
    {s:'TORNTPHARM',n:'Torrent Pharmaceuticals',sec:'Pharma'},
    {s:'LUPIN',n:'Lupin',sec:'Pharma'},
    {s:'BIOCON',n:'Biocon',sec:'Pharma'},
    {s:'ZOMATO',n:'Zomato',sec:'Technology'},
    {s:'NYKAA',n:'FSN E-Commerce (Nykaa)',sec:'Technology'},
    {s:'PAYTM',n:'One97 Communications (Paytm)',sec:'Technology'},
    {s:'IRCTC',n:'IRCTC',sec:'Infrastructure'},
    {s:'BANDHANBNK',n:'Bandhan Bank',sec:'Finance'},
    {s:'CANBK',n:'Canara Bank',sec:'Finance'},
    {s:'PNB',n:'Punjab National Bank',sec:'Finance'},
    {s:'BANKBARODA',n:'Bank of Baroda',sec:'Finance'},
    {s:'IDFCFIRSTB',n:'IDFC First Bank',sec:'Finance'},
    {s:'FEDERALBNK',n:'Federal Bank',sec:'Finance'},
    {s:'TITAN',n:'Titan Company',sec:'Other'},
    {s:'TRENT',n:'Trent',sec:'FMCG'},
    {s:'JUBLFOOD',n:'Jubilant Foodworks',sec:'FMCG'},
    {s:'TVSMOTOR',n:'TVS Motor Company',sec:'Auto'},
    {s:'MRF',n:'MRF',sec:'Auto'},
    {s:'APOLLOTYRE',n:'Apollo Tyres',sec:'Auto'},
    {s:'AMBUJACEM',n:'Ambuja Cements',sec:'Cement'},
    {s:'NHPC',n:'NHPC',sec:'Utilities'},
    {s:'TATAPOWER',n:'Tata Power Company',sec:'Utilities'},
    {s:'ADANIGREEN',n:'Adani Green Energy',sec:'Utilities'},
    {s:'DLF',n:'DLF',sec:'Real Estate'},
    {s:'GODREJPROP',n:'Godrej Properties',sec:'Real Estate'},
    {s:'OBEROIRLTY',n:'Oberoi Realty',sec:'Real Estate'},
    {s:'CONCOR',n:'Container Corporation',sec:'Infrastructure'},
  ],

  // Routes that need Yahoo's cookie+crumb handshake — only the Worker can do
  // that (it requires two chained requests sharing a cookie jar, which a dumb
  // pass-through CORS proxy can't provide). Without the Worker deployed,
  // these routes cannot work at all — this isn't a reliability nice-to-have,
  // it's now a hard requirement. /chart is the one exception (no crumb needed).
  _CRUMB_GATED: ['/quote', '/fundamentals', '/indices'],
  workerConfigured() { return typeof PROXY_BASE_URL === 'string' && PROXY_BASE_URL.trim().length > 0; },
  _workerWarned: false,

  // ─── Core fetch: worker first, public proxy fallback (chart only) ───
  async _proxiedFetch(path, params = {}) {
    const qs = new URLSearchParams(params).toString();

    if (this.workerConfigured()) {
      try {
        const res = await fetch(`${PROXY_BASE_URL}${path}?${qs}`, { signal: AbortSignal.timeout(8000) });
        if (res.ok) return await res.json();
      } catch (_) { /* fall through */ }
    } else if (this._CRUMB_GATED.includes(path)) {
      if (!this._workerWarned) {
        this._workerWarned = true;
        Utils.toast('Live prices need the free Cloudflare Worker set up — see README', 'info', 6000);
      }
      return null;
    }

    // /chart fallback (works without the Worker — no crumb needed for this one)
    const yahooUrlMap = {
      '/chart': `https://query1.finance.yahoo.com/v8/finance/chart/${params.symbol}?interval=${params._interval}&range=${params.range}`,
    };
    const targetUrl = yahooUrlMap[path];
    if (!targetUrl) return null;

    for (const proxy of this._publicProxies) {
      try {
        const res = await fetch(proxy + encodeURIComponent(targetUrl), { signal: AbortSignal.timeout(8000) });
        if (res.ok) return await res.json();
      } catch (_) { /* try next */ }
    }
    return null;
  },

  // ─── Live quotes for holdings + watchlist ───
  async fetchQuotes(items) {
    if (!items || items.length === 0) return;
    const symbols = items.map(h => h.symbol + (h.exchange === 'BSE' ? '.BO' : '.NS'));
    const unique  = [...new Set(symbols)];

    const data = await this._proxiedFetch('/quote', { symbols: unique.join(',') });
    const results = data?.quoteResponse?.result || [];

    results.forEach(q => {
      const sym  = q.symbol.replace('.NS', '').replace('.BO', '');
      const exch = q.symbol.endsWith('.BO') ? 'BSE' : 'NSE';
      const key  = sym + '.' + exch;
      this.prices[key] = {
        price: q.regularMarketPrice, change: q.regularMarketChange, changePct: q.regularMarketChangePercent,
        prevClose: q.regularMarketPreviousClose, dayHigh: q.regularMarketDayHigh, dayLow: q.regularMarketDayLow,
        hi52: q.fiftyTwoWeekHigh, lo52: q.fiftyTwoWeekLow, name: q.shortName,
        pe: q.trailingPE, divYield: q.trailingAnnualDividendYield,
        updatedAt: Date.now(),
      };
    });
  },

  // ─── Historical OHLC for stock detail chart ───
  async fetchHistory(symbol, exchange, range = '1mo') {
    const suffix      = exchange === 'BSE' ? '.BO' : '.NS';
    const intervalMap = { '1d':'5m','5d':'15m','1mo':'1d','3mo':'1d','1y':'1wk' };
    const interval     = intervalMap[range] || '1d';
    const fullSymbol   = symbol + suffix;

    const data = await this._proxiedFetch('/chart', { symbol: fullSymbol, range, _interval: interval });
    const result = data?.chart?.result?.[0];
    if (!result) return [];
    const ts     = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];
    return ts.map((t, i) => ({ time: t, value: closes[i] })).filter(p => p.value != null);
  },

  // ─── Fundamentals for Peter Lynch valuation ───
  async fetchFundamentals(symbol, exchange) {
    const key = symbol + '.' + exchange;
    if (this.fundamentals[key] && Date.now() - this.fundamentals[key]._fetchedAt < 6 * 60 * 60 * 1000) {
      return this.fundamentals[key]; // cache for 6h — this data doesn't change intraday
    }
    const suffix = exchange === 'BSE' ? '.BO' : '.NS';
    const data = await this._proxiedFetch('/fundamentals', { symbol: symbol + suffix });
    const r = data?.quoteSummary?.result?.[0];
    if (!r) return null;

    const trailingPE  = r.summaryDetail?.trailingPE?.raw ?? r.price?.trailingPE?.raw ?? null;
    const divYieldRaw = r.summaryDetail?.dividendYield?.raw ?? null;
    const epsGrowthRaw = r.earningsTrend?.trend?.[4]?.growth?.raw   // 5-year annual growth estimate
                       ?? r.earningsTrend?.trend?.[0]?.growth?.raw  // fallback: current-quarter estimate
                       ?? r.financialData?.earningsGrowth?.raw
                       ?? null;

    const fundamentals = {
      trailingPE,
      dividendYieldPct: divYieldRaw != null ? divYieldRaw * 100 : 0,
      epsGrowthPct: epsGrowthRaw != null ? epsGrowthRaw * 100 : null,
      _fetchedAt: Date.now(),
    };
    this.fundamentals[key] = fundamentals;
    return fundamentals;
  },

  // ─── Index snapshot (NIFTY / SENSEX / BANK NIFTY) ───
  async fetchIndices() {
    const data = await this._proxiedFetch('/indices', {});
    const results = data?.quoteResponse?.result || [];
    const keyMap = { '^NSEI': 'nifty', '^BSESN': 'sensex', '^NSEBANK': 'banknifty' };
    results.forEach(q => {
      const key = keyMap[q.symbol];
      if (key) this.indices[key] = { price: q.regularMarketPrice, change: q.regularMarketChange, changePct: q.regularMarketChangePercent };
    });
    return this.indices;
  },

  // ─── News (Google News RSS via worker, client-side XML fallback) ───
  async fetchNews(query) {
    if (typeof PROXY_BASE_URL === 'string' && PROXY_BASE_URL.trim()) {
      try {
        const res = await fetch(`${PROXY_BASE_URL}/news?q=${encodeURIComponent(query)}`, { signal: AbortSignal.timeout(8000) });
        if (res.ok) { const d = await res.json(); return d.items || []; }
      } catch (_) { /* fall through */ }
    }
    // Fallback: fetch raw RSS through a public proxy, parse client-side
    try {
      const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query + ' when:14d')}&hl=en-IN&gl=IN&ceid=IN:en`;
      const res = await fetch(this._publicProxies[0] + encodeURIComponent(rssUrl), { signal: AbortSignal.timeout(8000) });
      const xmlText = await res.text();
      const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
      return Array.from(doc.querySelectorAll('item')).slice(0, 10).map(item => ({
        title: item.querySelector('title')?.textContent || '',
        link: item.querySelector('link')?.textContent || '',
        pubDate: item.querySelector('pubDate')?.textContent || '',
        source: item.querySelector('source')?.textContent || '',
      }));
    } catch (_) { return []; }
  },

  getPrice(symbol, exchange = 'NSE') { return this.prices[symbol + '.' + exchange] || null; },

  isMarketOpen() {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const day = now.getDay();
    if (day === 0 || day === 6) return false;
    const mins = now.getHours() * 60 + now.getMinutes();
    return mins >= 9 * 60 + 15 && mins <= 15 * 60 + 30;
  },

  startAutoRefresh() {
    this._clearTimer();
    this._doRefresh();
    const interval = this.isMarketOpen() ? this._interval : 5 * 60 * 1000;
    this._timer = setInterval(() => this._doRefresh(), interval);
  },
  stopAutoRefresh() { this._clearTimer(); },
  _clearTimer() { if (this._timer) { clearInterval(this._timer); this._timer = null; } },

  async _doRefresh() {
    const holdings = Portfolio.holdings || [];
    const watched  = Watchlist.items   || [];
    const all = [...holdings, ...watched.map(w => ({ symbol: w.symbol, exchange: w.exchange || 'NSE' }))];

    const btn = Utils.el('btn-refresh');
    btn?.classList.add('spinning');

    await Promise.all([
      all.length ? this.fetchQuotes(all) : Promise.resolve(),
      this.fetchIndices(),
    ]);

    btn?.classList.remove('spinning');

    Portfolio.renderCards();
    Portfolio.renderDashboard();
    Watchlist.render();
    Charts.refreshSectorDonut();
    App.updateIndexTickerUI(); // render from the indices we just fetched above — no second fetch

    const now = new Date();
    Utils.setText('last-updated-text', now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    Utils.setClass('live-dot', 'on', this.isMarketOpen());
    this._updateMarketPill?.();
  },

  setInterval(ms) { this._interval = ms; this.startAutoRefresh(); },

  search(query) {
    if (!query || query.length < 1) return [];
    const q = query.toUpperCase();
    return this.STOCKS.filter(s => s.s.includes(q) || s.n.toUpperCase().includes(q)).slice(0, 8);
  },

  findStock(symbol) { return this.STOCKS.find(s => s.s === symbol.toUpperCase()) || null; },
};
