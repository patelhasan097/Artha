const MfAPI = {
  navCache: {},  // schemeCode -> { meta, latestNav, latestDate, prevNav, history, fetchedAt }

  async _fetch(path) {
    if (StockAPI.workerConfigured()) {
      try {
        const res = await fetch(`${PROXY_BASE_URL}${path}`, { signal: AbortSignal.timeout(8000) });
        if (res.ok) return await res.json();
      } catch (_) { /* fall through */ }
    }
    // MFapi.in is a public API built for direct browser consumption — usually
    // fine without a proxy, so this fallback keeps fund search/NAV working
    // even before the Worker is deployed (unlike stock quotes, which can't).
    try {
      const direct = 'https://api.mfapi.in' + path;
      const res = await fetch(direct, { signal: AbortSignal.timeout(8000) });
      if (res.ok) return await res.json();
    } catch (_) { /* ignore */ }
    return null;
  },

  async search(query) {
    if (!query || query.length < 2) return [];
    const data = await this._fetch(`/mf/search?q=${encodeURIComponent(query)}`);
    return Array.isArray(data) ? data.slice(0, 10) : [];
  },

  async fetchScheme(code) {
    const cached = this.navCache[code];
    if (cached && Date.now() - cached.fetchedAt < 6 * 60 * 60 * 1000) return cached; // NAV updates a few times a day, not live-ticking

    const data = await this._fetch(`/mf/${code}`);
    if (!data || !Array.isArray(data.data) || data.data.length === 0) return null;

    const history = data.data; // MFapi.in returns newest-first
    const result = {
      meta: data.meta,
      latestNav: parseFloat(history[0].nav),
      latestDate: history[0].date,
      prevNav: history[1] ? parseFloat(history[1].nav) : parseFloat(history[0].nav),
      history,
      fetchedAt: Date.now(),
    };
    this.navCache[code] = result;
    return result;
  },

  getCached(code) { return this.navCache[code] || null; },

  // Broad category grouping for the allocation chart
  categoryGroup(cat) {
    if (!cat) return 'Other';
    const c = cat.toLowerCase();
    if (c.includes('equity') || c.includes('elss')) return 'Equity';
    if (c.includes('debt') || c.includes('income') || c.includes('gilt') || c.includes('liquid') || c.includes('money market')) return 'Debt';
    if (c.includes('hybrid') || c.includes('balanced')) return 'Hybrid';
    if (c.includes('index') || c.includes('etf') || c.includes('fof')) return 'Index / ETF';
    if (c.includes('solution')) return 'Solution Oriented';
    return 'Other';
  },

  categoryColor(group) {
    const map = { 'Equity': '#E3A63E', 'Debt': '#9BADCF', 'Hybrid': '#B6A2BE', 'Index / ETF': '#9EC2AC', 'Solution Oriented': '#C2985F', 'Other': '#675F53' };
    return map[group] || '#675F53';
  },
};
