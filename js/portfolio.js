const Portfolio = {
  holdings: [],
  listener: null,
  _filter: 'all',
  _sort: 'value',
  _detailId: null,

  async init(uid) {
    if (this.listener) { this.listener(); this.listener = null; }
    this.listener = db.collection('users').doc(uid).collection('portfolio')
      .orderBy('addedAt', 'desc')
      .onSnapshot(snap => {
        this.holdings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        this.renderCards();
        this.renderDashboard();
        Charts.refreshSectorDonut();
        Inbox.refreshWatchedSymbols();
        if (this.holdings.length > 0) StockAPI.startAutoRefresh();
      }, err => console.error('Portfolio snapshot error:', err));
  },

  async add(data) {
    const uid = auth.currentUser.uid;
    return db.collection('users').doc(uid).collection('portfolio').add({
      ...data, addedAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  },
  async update(id, data) {
    const uid = auth.currentUser.uid;
    return db.collection('users').doc(uid).collection('portfolio').doc(id).update({ ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
  },
  async delete(id) {
    const uid = auth.currentUser.uid;
    return db.collection('users').doc(uid).collection('portfolio').doc(id).delete();
  },

  calcPnL(h, price) {
    const invested = h.buyPrice * h.quantity;
    const current  = price * h.quantity;
    const pnl      = current - invested;
    const pct      = invested ? (pnl / invested) * 100 : 0;
    return { invested, current, pnl, pct };
  },

  renderDashboard() {
    let invested = 0, current = 0, todayPnl = 0;
    this.holdings.forEach(h => {
      const p = StockAPI.getPrice(h.symbol, h.exchange);
      const inv = h.buyPrice * h.quantity;
      invested += inv;
      if (p) { current += p.price * h.quantity; todayPnl += (p.change || 0) * h.quantity; }
      else { current += inv; }
    });

    const totalPnl = current - invested;
    const totalPct = invested ? (totalPnl / invested) * 100 : 0;

    Utils.setText('total-value', Utils.fmtCurrency(current));
    Utils.setText('stat-invested', Utils.fmtCurrency(invested));
    Utils.setText('stat-count', this.holdings.length);
    Charts.renderHeroSparkline(current);

    const todayEl = Utils.el('stat-today');
    if (todayEl) { todayEl.textContent = (todayPnl >= 0 ? '+' : '') + Utils.fmtCurrency(todayPnl); todayEl.className = 'hero-stat-val ' + (todayPnl >= 0 ? 'gain' : 'loss'); }

    const badge = Utils.el('total-pnl-badge');
    if (badge) {
      const isPos = totalPnl >= 0;
      badge.className = `pnl-badge ${isPos ? 'gain' : 'loss'}`;
      badge.innerHTML = `<i class="ti ${isPos ? 'ti-trending-up' : 'ti-trending-down'}"></i> ${isPos ? '+' : ''}${Utils.fmtCurrency(totalPnl)} (${Utils.fmtPctSigned(totalPct)})`;
    }

    Utils.setText('port-current', Utils.fmtCurrency(current));
    Utils.setText('port-invested', Utils.fmtCurrency(invested));
    const portPnlEl = Utils.el('port-pnl');
    if (portPnlEl) { portPnlEl.textContent = (totalPnl >= 0 ? '+' : '') + Utils.fmtCurrency(totalPnl); portPnlEl.className = 'port-stat-val ' + (totalPnl >= 0 ? 'gain' : 'loss'); }

    this._renderMovers();
    this._renderAnalyticsSummary(invested, current, totalPnl);
  },

  _renderMovers() {
    const grid = Utils.el('movers-grid');
    if (!grid) return;
    const ranked = this.holdings.map(h => { const p = StockAPI.getPrice(h.symbol, h.exchange); return p ? { ...h, ...this.calcPnL(h, p.price) } : null; }).filter(Boolean).sort((a, b) => b.pct - a.pct);

    if (ranked.length === 0) {
      const msg = StockAPI.workerConfigured()
        ? 'Prices loading…'
        : 'Live prices need setup — see README for the free 5-minute step';
      grid.innerHTML = `<div style="grid-column:1/-1;padding:24px;text-align:center;color:var(--t3);font-size:13px;line-height:1.6;">${msg}</div>`;
      return;
    }

    const top = ranked.slice(0, 2);
    const bottom = ranked.slice(-2).reverse().filter(h => !top.find(t => t.id === h.id));
    const show = [...top, ...bottom].slice(0, 4);

    grid.innerHTML = show.map((h, i) => `
      <div class="mover-card stagger-in" style="animation-delay:${i * 40}ms" onclick="Portfolio.openDetail('${h.id}')">
        <div class="mover-symbol">${h.symbol}</div>
        <div class="mover-name">${h.name || ''}</div>
        <div class="mover-pnl ${h.pct >= 0 ? 'gain' : 'loss'}">${h.pct >= 0 ? '+' : ''}${Utils.fmtCurrency(h.pnl)}</div>
        <div class="mover-pnl-sub ${h.pct >= 0 ? 'gain' : 'loss'}">${Utils.fmtPctSigned(h.pct)}</div>
      </div>`).join('');
  },

  _renderAnalyticsSummary(invested, current, totalPnl) {
    Utils.setText('an-invested', Utils.fmtCurrency(invested));
    Utils.setText('an-current', Utils.fmtCurrency(current));
    const anPnlEl = Utils.el('an-pnl');
    if (anPnlEl) { anPnlEl.textContent = (totalPnl >= 0 ? '+' : '') + Utils.fmtCurrency(totalPnl); anPnlEl.className = 'analytics-mini-val ' + (totalPnl >= 0 ? 'gain' : 'loss'); }

    let wSum = 0, wTotal = 0;
    this.holdings.forEach(h => {
      const p = StockAPI.getPrice(h.symbol, h.exchange);
      if (!p) return;
      const inv = h.buyPrice * h.quantity, cur = p.price * h.quantity, days = Utils.daysSince(h.buyDate);
      if (days > 0 && inv > 0) { wSum += Utils.annualisedReturn(inv, cur, days) * inv; wTotal += inv; }
    });
    const xirr = wTotal ? wSum / wTotal : 0;
    const xirrEl = Utils.el('an-xirr');
    if (xirrEl) { xirrEl.textContent = (xirr >= 0 ? '+' : '') + xirr.toFixed(1) + '%'; xirrEl.className = 'analytics-mini-val ' + (xirr >= 0 ? 'gain' : 'loss'); }

    const ranked = this.holdings.map(h => { const p = StockAPI.getPrice(h.symbol, h.exchange); return p ? { sym: h.symbol, pct: this.calcPnL(h, p.price).pct } : null; }).filter(Boolean).sort((a, b) => b.pct - a.pct);
    if (ranked.length > 0) {
      Utils.setText('an-best-sym', ranked[0].sym);
      Utils.setText('an-worst-sym', ranked[ranked.length - 1].sym);
      Utils.setText('an-best-pct', Utils.fmtPctSigned(ranked[0].pct));
      Utils.setText('an-worst-pct', Utils.fmtPctSigned(ranked[ranked.length - 1].pct));
    }
  },

  renderCards() {
    const list = Utils.el('holdings-list');
    const empty = Utils.el('port-empty');
    if (!list) return;

    if (this.holdings.length === 0) { list.innerHTML = ''; empty?.classList.remove('hidden'); this._buildFilterTabs([]); return; }
    empty?.classList.add('hidden');

    const sectors = [...new Set(this.holdings.map(h => h.sector).filter(Boolean))];
    this._buildFilterTabs(sectors);
    let filtered = this._filter === 'all' ? [...this.holdings] : this.holdings.filter(h => h.sector === this._filter);
    filtered = this._applySort(filtered);

    const oldPrices = {};
    list.querySelectorAll('.stock-card').forEach(c => { const e = c.querySelector('.stock-cmp'); if (e) oldPrices[c.dataset.id] = e.textContent; });

    list.innerHTML = filtered.map((h, i) => this._cardHTML(h, i)).join('');

    filtered.forEach(h => {
      const p = StockAPI.getPrice(h.symbol, h.exchange);
      if (!p) return;
      const newStr = Utils.fmtCurrencyFull(p.price);
      if (oldPrices[h.id] && oldPrices[h.id] !== newStr) { const el = Utils.el('cmp-' + h.id); if (el) Utils.flashPrice(el, p.change >= 0); }
    });

    list.querySelectorAll('.stock-card').forEach(card => { card.onclick = () => this.openDetail(card.dataset.id); });
    requestAnimationFrame(() => Charts.renderSparklines(filtered, 'spark-h-'));
  },

  setSort(key) { this._sort = key; this.renderCards(); },

  _applySort(list) {
    const withPnl = list.map(h => {
      const p = StockAPI.getPrice(h.symbol, h.exchange);
      const cur = p ? p.price * h.quantity : h.buyPrice * h.quantity;
      const { pnl, pct } = p ? this.calcPnL(h, p.price) : { pnl: 0, pct: 0 };
      return { h, cur, pnl, pct };
    });
    const sorters = {
      value:  (a, b) => b.cur - a.cur,
      pnl:    (a, b) => b.pnl - a.pnl,
      pnlpct: (a, b) => b.pct - a.pct,
      name:   (a, b) => a.h.symbol.localeCompare(b.h.symbol),
    };
    withPnl.sort(sorters[this._sort] || sorters.value);
    return withPnl.map(x => x.h);
  },

  _buildFilterTabs(sectors) {
    const tabs = Utils.el('filter-tabs');
    if (!tabs) return;
    tabs.innerHTML = `<button class="filter-tab ${this._filter === 'all' ? 'active' : ''}" data-sector="all">All (${this.holdings.length})</button>` +
      sectors.map(s => `<button class="filter-tab ${this._filter === s ? 'active' : ''}" data-sector="${s}">${s} (${this.holdings.filter(h => h.sector === s).length})</button>`).join('');
    tabs.querySelectorAll('.filter-tab').forEach(btn => { btn.onclick = () => { this._filter = btn.dataset.sector; this.renderCards(); }; });
  },

  _cardHTML(h, i = 0) {
    const p = StockAPI.getPrice(h.symbol, h.exchange);
    const cmp = p?.price ?? null;
    const chgPct = p?.changePct ?? null;
    const { pnl, pct } = cmp != null ? this.calcPnL(h, cmp) : { pnl: 0, pct: 0 };
    const isPos = pnl >= 0;
    const dayPos = (p?.change ?? 0) >= 0;

    return `
    <div class="stock-card stagger-in" data-id="${h.id}" style="animation-delay:${Math.min(i * 30, 240)}ms">
      <div class="stock-card-top">
        <div class="stock-card-left">
          <div class="stock-avatar">${Utils.initials(h.symbol)}</div>
          <div class="stock-info">
            <div class="stock-symbol-row"><span class="stock-sym">${h.symbol}</span><span class="sector-badge ${Utils.sectorClass(h.sector)}">${h.sector || '–'}</span></div>
            <div class="stock-company-name">${h.name || h.symbol}</div>
          </div>
        </div>
        <div class="stock-card-spark" id="spark-h-${h.id}"></div>
        <div class="stock-card-right">
          <div class="stock-cmp" id="cmp-${h.id}">${cmp != null ? Utils.fmtCurrencyFull(cmp) : '–'}</div>
          <div class="stock-change-pct ${dayPos ? 'gain' : 'loss'}">${chgPct != null ? Utils.fmtPctSigned(chgPct) : '–'}</div>
        </div>
      </div>
      <div class="stock-card-bottom">
        <div><div class="stock-meta-lbl">Avg buy</div><div class="stock-meta-val">${Utils.fmtCurrencyFull(h.buyPrice)}</div></div>
        <div><div class="stock-meta-lbl">Qty</div><div class="stock-meta-val">${h.quantity}</div></div>
        <div><div class="stock-meta-lbl">P&amp;L</div><div class="stock-pnl-val ${isPos ? 'gain' : 'loss'}" id="pnl-${h.id}">${isPos ? '+' : ''}${Utils.fmtCurrency(pnl)}<br><span style="font-size:9.5px;font-weight:500;">${Utils.fmtPctSigned(pct)}</span></div></div>
      </div>
    </div>`;
  },

  async openDetail(id) {
    const h = this.holdings.find(x => x.id === id);
    if (!h) return;
    this._detailId = id;

    Utils.setText('d-sym', h.symbol);
    Utils.setText('d-name', h.name || h.symbol);
    Utils.setText('d-avatar', Utils.initials(h.symbol));
    const badgeEl = Utils.el('d-sector-badge');
    if (badgeEl) { badgeEl.textContent = h.sector || '–'; badgeEl.className = `sector-badge ${Utils.sectorClass(h.sector)}`; }

    const p = StockAPI.getPrice(h.symbol, h.exchange);
    let cmp = p?.price ?? null;
    if (p) {
      Utils.el('d-price').textContent = Utils.fmtCurrencyFull(p.price);
      const isUp = p.change >= 0;
      Utils.el('d-change-amt').textContent = (isUp ? '+' : '') + Utils.fmtCurrencyFull(p.change);
      Utils.el('d-change-pct').textContent = '(' + Utils.fmtPctSigned(p.changePct) + ')';
      Utils.el('d-change').className = `detail-change ${isUp ? 'gain' : 'loss'}`;
      Utils.setText('d-52hi', Utils.fmtCurrencyFull(p.hi52));
      Utils.setText('d-52lo', Utils.fmtCurrencyFull(p.lo52));
      const { invested, current, pnl, pct } = this.calcPnL(h, p.price);
      Utils.setText('d-invested', Utils.fmtCurrency(invested));
      Utils.setText('d-current', Utils.fmtCurrency(current));
      const pnlEl = Utils.el('d-pnl');
      if (pnlEl) { pnlEl.textContent = (pnl >= 0 ? '+' : '') + Utils.fmtCurrency(pnl) + ' (' + Utils.fmtPctSigned(pct) + ')'; pnlEl.className = 'detail-stat-val ' + (pnl >= 0 ? 'gain' : 'loss'); }
    } else {
      Utils.el('d-price').textContent = '₹–'; Utils.el('d-change').textContent = '';
      Utils.setText('d-invested', Utils.fmtCurrency(h.buyPrice * h.quantity)); Utils.setText('d-current', '–');
    }

    Utils.setText('d-buy-price', Utils.fmtCurrencyFull(h.buyPrice));
    Utils.setText('d-qty', h.quantity + ' shares');
    Utils.setText('d-days', Utils.daysLabel(Utils.daysSince(h.buyDate)));

    App.openModal('modal-detail');
    Utils.qsa('.chart-tab').forEach(t => t.classList.toggle('active', t.dataset.range === '1mo'));
    Charts.initStockChart();
    await Charts.loadStockChart(h.symbol, h.exchange || 'NSE', '1mo');

    Utils.qsa('.chart-tab').forEach(tab => {
      tab.onclick = async () => { Utils.qsa('.chart-tab').forEach(t => t.classList.remove('active')); tab.classList.add('active'); await Charts.loadStockChart(h.symbol, h.exchange || 'NSE', tab.dataset.range); };
    });

    // Peter Lynch valuation
    Lynch.renderForStock(h.symbol, h.exchange || 'NSE', cmp);

    Utils.el('btn-edit-stock').onclick = () => { App.closeModal('modal-detail'); App.openAddModal({ ...h }); };
    Utils.el('btn-delete-stock').onclick = () => this._deleteStock(id, h.symbol);
  },

  async _deleteStock(id, symbol) {
    if (!Utils.confirm(`Remove ${symbol} from your portfolio?`)) return;
    try { Utils.showLoader(); await this.delete(id); App.closeModal('modal-detail'); Utils.toast(`${symbol} removed`, 'success'); }
    catch (e) { Utils.toast('Failed to remove: ' + e.message, 'error'); }
    finally { Utils.hideLoader(); }
  },

  getSectorBreakdown() {
    const map = {}; let total = 0;
    this.holdings.forEach(h => {
      const p = StockAPI.getPrice(h.symbol, h.exchange);
      const val = p ? p.price * h.quantity : h.buyPrice * h.quantity;
      const sec = h.sector || 'Other';
      map[sec] = (map[sec] || 0) + val; total += val;
    });
    if (!total) return [];
    return Object.entries(map).map(([sector, value]) => ({ sector, value, pct: (value / total) * 100 })).sort((a, b) => b.pct - a.pct);
  },

  // Unique symbols currently held — used by Inbox to know what to fetch news for
  getSymbols() { return [...new Set(this.holdings.map(h => h.symbol))]; },
};
