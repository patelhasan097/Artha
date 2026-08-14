const Inbox = {
  items: [],           // merged, categorized, sorted feed
  _cache: {},           // symbol -> { items, fetchedAt }
  _watchedSymbols: [],   // union of portfolio + watchlist symbols
  _filter: 'all',
  _readIds: new Set(JSON.parse(localStorage.getItem('artha_inbox_read') || '[]')),
  _lastFetchAt: 0,
  CACHE_MS: 15 * 60 * 1000, // 15 min per-symbol cache — keeps this gentle on the free news source

  // Called whenever Portfolio or Watchlist snapshots change
  refreshWatchedSymbols() {
    const combined = [...new Set([...Portfolio.getSymbols(), ...Watchlist.getSymbols()])];
    const changed = JSON.stringify(combined.sort()) !== JSON.stringify([...this._watchedSymbols].sort());
    this._watchedSymbols = combined;
    if (changed && combined.length > 0) this.fetchAll();
    this._updateBadge();
  },

  _stockMeta(symbol) {
    return StockAPI.findStock(symbol) || { s: symbol, n: symbol, sec: 'Other' };
  },

  // Classify a headline into a category so the Inbox feels organized, not a raw news dump
  _classify(title) {
    const t = title.toLowerCase();
    if (/\bq[1-4]\b|quarterly result|net profit|revenue rises|revenue falls|earnings/i.test(t)) return 'result';
    if (/board meeting|board approves|board of directors/i.test(t)) return 'board';
    if (/dividend|bonus issue|stock split|buyback/i.test(t)) return 'dividend';
    return 'news';
  },

  // Turn a raw headline into a short, plain-English one-liner (light copywriting pass)
  _cleanTitle(rawTitle, source) {
    // Google News titles are usually "Headline - Source" — strip the trailing source
    let t = rawTitle;
    if (source && t.endsWith(source)) t = t.slice(0, t.length - source.length).replace(/[-–]\s*$/, '').trim();
    return t;
  },

  async fetchAll(force = false) {
    if (!force && Date.now() - this._lastFetchAt < 60000) return; // don't hammer on rapid re-triggers
    this._lastFetchAt = Date.now();

    const symbols = this._watchedSymbols;
    if (symbols.length === 0) { this.items = []; this.render(); return; }

    for (const symbol of symbols) {
      const cached = this._cache[symbol];
      if (!force && cached && Date.now() - cached.fetchedAt < this.CACHE_MS) continue;

      const meta = this._stockMeta(symbol);
      const query = `"${meta.n}"`;
      try {
        const rawItems = await StockAPI.fetchNews(query);
        const mapped = rawItems.map(r => {
          const cleanTitle = this._cleanTitle(r.title, r.source);
          return {
            id: symbol + '::' + (r.link || r.title),
            symbol, name: meta.n,
            title: cleanTitle,
            desc: this._describeFor(cleanTitle, meta.n),
            category: this._classify(cleanTitle),
            link: r.link,
            timestamp: r.pubDate ? new Date(r.pubDate).getTime() : Date.now(),
          };
        });
        this._cache[symbol] = { items: mapped, fetchedAt: Date.now() };
      } catch (_) {
        // leave stale/empty cache for this symbol, move on — one flaky symbol shouldn't block the rest
      }
      await new Promise(r => setTimeout(r, 250)); // gentle pacing between requests
    }

    this._rebuild();
  },

  // Short plain-English summary line based on category (real copywriting pass, not just the raw headline twice)
  _describeFor(title, companyName) {
    const t = title.toLowerCase();
    if (/\bq[1-4]\b|quarterly result|earnings/.test(t)) return `${companyName} just reported its quarterly numbers. Tap to read what changed.`;
    if (/board meeting|board approves/.test(t)) return `The board at ${companyName} met — here's what was on the table.`;
    if (/dividend/.test(t)) return `${companyName} announced a dividend update. Check the payout and date.`;
    if (/bonus issue|stock split/.test(t)) return `A corporate action from ${companyName} — could affect your holding.`;
    return `Fresh update on ${companyName}.`;
  },

  _rebuild() {
    const all = Object.values(this._cache).flatMap(c => c.items);
    // De-duplicate by id, sort newest first
    const seen = new Set();
    this.items = all.filter(i => { if (seen.has(i.id)) return false; seen.add(i.id); return true; })
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 60);
    this.render();
    this._updateBadge();
  },

  setFilter(f) { this._filter = f; this.render(); },

  render() {
    const list = Utils.el('inbox-list');
    const empty = Utils.el('inbox-empty');
    if (!list) return;

    const filtered = this._filter === 'all' ? this.items : this.items.filter(i => i.category === this._filter);

    if (filtered.length === 0) {
      list.innerHTML = '';
      empty?.classList.remove('hidden');
      Utils.el('empty-title') && (Utils.el('empty-title').textContent = this._watchedSymbols.length === 0 ? 'Inbox is empty' : 'No updates yet');
      return;
    }
    empty?.classList.add('hidden');

    const icons = { result: 'ti-report-analytics', board: 'ti-users', dividend: 'ti-coin', news: 'ti-news' };

    list.innerHTML = filtered.map((item, i) => `
      <div class="inbox-item stagger-in ${this._readIds.has(item.id) ? '' : 'unread'}" style="animation-delay:${Math.min(i * 25, 200)}ms" data-id="${item.id}">
        <div class="inbox-icon ${item.category}"><i class="ti ${icons[item.category]}"></i></div>
        <div class="inbox-body">
          <div class="inbox-top-row"><span class="inbox-sym">${item.symbol}</span><span class="inbox-time">${Utils.timeAgo(item.timestamp)}</span></div>
          <div class="inbox-title">${item.title}</div>
          <div class="inbox-desc">${item.desc}</div>
          <span class="inbox-tag ${item.category}">${item.category === 'result' ? 'Quarterly Result' : item.category === 'board' ? 'Board Meeting' : item.category === 'dividend' ? 'Dividend' : 'News'}</span>
        </div>
      </div>`).join('');

    list.querySelectorAll('.inbox-item').forEach(el => {
      el.onclick = () => this.openDetail(el.dataset.id);
    });
  },

  openDetail(id) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;
    this._readIds.add(id);
    localStorage.setItem('artha_inbox_read', JSON.stringify([...this._readIds]));

    Utils.setText('ib-modal-sym', item.symbol);
    Utils.setText('ib-modal-title', item.title);
    Utils.setText('ib-modal-desc', item.desc + (item.link ? '' : ''));
    Utils.setText('ib-modal-time', Utils.timeAgo(item.timestamp));
    const tagEl = Utils.el('ib-modal-tag');
    if (tagEl) { tagEl.className = `inbox-tag ${item.category}`; tagEl.textContent = item.category === 'result' ? 'Quarterly Result' : item.category === 'board' ? 'Board Meeting' : item.category === 'dividend' ? 'Dividend' : 'News'; }

    App.openModal('modal-inbox-detail');
    this.render(); // refresh unread dot
    this._updateBadge();

    // Open full article on a second tap of the title (keeps first tap = read + summary)
    const titleEl = Utils.el('ib-modal-title');
    if (titleEl && item.link) titleEl.onclick = () => window.open(item.link, '_blank', 'noopener');
  },

  markAllRead() {
    this.items.forEach(i => this._readIds.add(i.id));
    localStorage.setItem('artha_inbox_read', JSON.stringify([...this._readIds]));
    this.render();
    this._updateBadge();
    Utils.toast('All caught up', 'success');
  },

  _updateBadge() {
    const unread = this.items.filter(i => !this._readIds.has(i.id)).length;
    const badge = Utils.el('inbox-nav-badge');
    if (badge) badge.classList.toggle('hidden', unread === 0);
  },
};
