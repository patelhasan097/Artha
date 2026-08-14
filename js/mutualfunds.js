const MutualFunds = {
  holdings: [],
  listener: null,
  _detailId: null,

  async init(uid) {
    if (this.listener) { this.listener(); this.listener = null; }
    this.listener = db.collection('users').doc(uid).collection('mutualfunds')
      .orderBy('addedAt', 'desc')
      .onSnapshot(snap => {
        this.holdings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        this.renderCards();
        this.renderDashboard();
        if (this.holdings.length > 0) this.refreshAll();
      }, err => console.error('MutualFunds snapshot error:', err));
  },

  async add(data) {
    const uid = auth.currentUser.uid;
    return db.collection('users').doc(uid).collection('mutualfunds').add({
      ...data, addedAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  },
  async update(id, data) {
    const uid = auth.currentUser.uid;
    return db.collection('users').doc(uid).collection('mutualfunds').doc(id).update({ ...data, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
  },
  async delete(id) {
    const uid = auth.currentUser.uid;
    return db.collection('users').doc(uid).collection('mutualfunds').doc(id).delete();
  },

  calcPnL(h, nav) {
    const invested = h.buyNav * h.units;
    const current = nav * h.units;
    const pnl = current - invested;
    const pct = invested ? (pnl / invested) * 100 : 0;
    return { invested, current, pnl, pct };
  },

  getNav(schemeCode) {
    const c = MfAPI.getCached(schemeCode);
    if (!c) return null;
    return { nav: c.latestNav, date: c.latestDate, changePct: c.prevNav ? ((c.latestNav - c.prevNav) / c.prevNav) * 100 : 0, meta: c.meta };
  },

  async refreshAll() {
    for (const h of this.holdings) { await MfAPI.fetchScheme(h.schemeCode); }
    this.renderCards();
    this.renderDashboard();
  },

  renderDashboard() {
    let invested = 0, current = 0;
    this.holdings.forEach(h => {
      const n = this.getNav(h.schemeCode);
      invested += h.buyNav * h.units;
      current += (n ? n.nav : h.buyNav) * h.units;
    });
    const pnl = current - invested;

    Utils.setText('mf-current', Utils.fmtCurrency(current));
    Utils.setText('mf-invested', Utils.fmtCurrency(invested));
    const pnlEl = Utils.el('mf-pnl');
    if (pnlEl) { pnlEl.textContent = (pnl >= 0 ? '+' : '') + Utils.fmtCurrency(pnl); pnlEl.className = 'port-stat-val ' + (pnl >= 0 ? 'gain' : 'loss'); }

    Utils.setText('mfan-invested', Utils.fmtCurrency(invested));
    Utils.setText('mfan-current', Utils.fmtCurrency(current));
    const anPnlEl = Utils.el('mfan-pnl');
    if (anPnlEl) { anPnlEl.textContent = (pnl >= 0 ? '+' : '') + Utils.fmtCurrency(pnl); anPnlEl.className = 'analytics-mini-val ' + (pnl >= 0 ? 'gain' : 'loss'); }

    let wSum = 0, wTotal = 0;
    this.holdings.forEach(h => {
      const n = this.getNav(h.schemeCode);
      if (!n) return;
      const inv = h.buyNav * h.units, cur = n.nav * h.units, days = Utils.daysSince(h.buyDate);
      if (days > 0 && inv > 0) { wSum += Utils.annualisedReturn(inv, cur, days) * inv; wTotal += inv; }
    });
    const xirr = wTotal ? wSum / wTotal : 0;
    const xirrEl = Utils.el('mfan-xirr');
    if (xirrEl) { xirrEl.textContent = (xirr >= 0 ? '+' : '') + xirr.toFixed(1) + '%'; xirrEl.className = 'analytics-mini-val ' + (xirr >= 0 ? 'gain' : 'loss'); }

    Charts.refreshMfCategoryChart();
  },

  renderCards() {
    const list = Utils.el('mf-holdings-list');
    const empty = Utils.el('mf-empty');
    if (!list) return;

    if (this.holdings.length === 0) { list.innerHTML = ''; empty?.classList.remove('hidden'); return; }
    empty?.classList.add('hidden');

    list.innerHTML = this.holdings.map((h, i) => this._cardHTML(h, i)).join('');
    list.querySelectorAll('.stock-card').forEach(card => { card.onclick = () => this.openDetail(card.dataset.id); });
  },

  _cardHTML(h, i = 0) {
    const n = this.getNav(h.schemeCode);
    const nav = n?.nav ?? null;
    const changePct = n?.changePct ?? null;
    const { pnl, pct } = nav != null ? this.calcPnL(h, nav) : { pnl: 0, pct: 0 };
    const isPos = pnl >= 0;
    const dayPos = (changePct ?? 0) >= 0;
    const group = MfAPI.categoryGroup(n?.meta?.scheme_category || h.category);

    return `
    <div class="stock-card stagger-in" data-id="${h.id}" style="animation-delay:${Math.min(i * 30, 240)}ms">
      <div class="stock-card-top">
        <div class="stock-card-left">
          <div class="stock-avatar"><i class="ti ti-building-bank" style="font-size:15px;"></i></div>
          <div class="stock-info">
            <div class="stock-symbol-row"><span class="stock-sym" style="font-size:13px;">${Utils.shortFundName(h.name)}</span></div>
            <div class="stock-company-name">${group} · ${h.units} units</div>
          </div>
        </div>
        <div class="stock-card-right">
          <div class="stock-cmp">${nav != null ? Utils.fmtCurrencyFull(nav) : '–'}</div>
          <div class="stock-change-pct ${dayPos ? 'gain' : 'loss'}">${changePct != null ? Utils.fmtPctSigned(changePct) : '–'}</div>
        </div>
      </div>
      <div class="stock-card-bottom">
        <div><div class="stock-meta-lbl">Avg NAV</div><div class="stock-meta-val">${Utils.fmtCurrencyFull(h.buyNav)}</div></div>
        <div><div class="stock-meta-lbl">Units</div><div class="stock-meta-val">${h.units}</div></div>
        <div><div class="stock-meta-lbl">P&amp;L</div><div class="stock-pnl-val ${isPos ? 'gain' : 'loss'}">${isPos ? '+' : ''}${Utils.fmtCurrency(pnl)}<br><span style="font-size:9.5px;font-weight:500;">${Utils.fmtPctSigned(pct)}</span></div></div>
      </div>
    </div>`;
  },

  async openDetail(id) {
    const h = this.holdings.find(x => x.id === id);
    if (!h) return;
    this._detailId = id;

    Utils.setText('mfd-name', h.name);
    App.openModal('modal-mf-detail');

    // Ensure we have fresh scheme data (meta + history) for this fund
    const scheme = await MfAPI.fetchScheme(h.schemeCode);
    const n = this.getNav(h.schemeCode);

    Utils.setText('mfd-house', scheme?.meta?.fund_house || '–');
    if (n) {
      Utils.el('mfd-nav').textContent = Utils.fmtCurrencyFull(n.nav);
      const isUp = n.changePct >= 0;
      const changeAmt = scheme ? (scheme.latestNav - scheme.prevNav) : 0;
      Utils.el('mfd-change-amt').textContent = (isUp ? '+' : '') + Utils.fmtCurrencyFull(changeAmt);
      Utils.el('mfd-change-pct').textContent = '(' + Utils.fmtPctSigned(n.changePct) + ')';
      Utils.el('mfd-change').className = `detail-change ${isUp ? 'gain' : 'loss'}`;
      Utils.setText('mfd-nav-date', n.date || '–');

      const { invested, current, pnl, pct } = this.calcPnL(h, n.nav);
      Utils.setText('mfd-invested', Utils.fmtCurrency(invested));
      Utils.setText('mfd-current', Utils.fmtCurrency(current));
      const pnlEl = Utils.el('mfd-pnl');
      if (pnlEl) { pnlEl.textContent = (pnl >= 0 ? '+' : '') + Utils.fmtCurrency(pnl) + ' (' + Utils.fmtPctSigned(pct) + ')'; pnlEl.className = 'detail-stat-val ' + (pnl >= 0 ? 'gain' : 'loss'); }
    } else {
      Utils.el('mfd-nav').textContent = '₹–';
      Utils.setText('mfd-invested', Utils.fmtCurrency(h.buyNav * h.units));
    }

    Utils.setText('mfd-units', h.units + ' units');
    Utils.setText('mfd-buy-nav', Utils.fmtCurrencyFull(h.buyNav));
    Utils.setText('mfd-days', Utils.daysLabel(Utils.daysSince(h.buyDate)));

    Charts.initMfChart();
    await Charts.loadMfChart(h.schemeCode);

    Utils.el('btn-edit-mf').onclick = () => { App.closeModal('modal-mf-detail'); App.openAddMfModal({ ...h }); };
    Utils.el('btn-delete-mf').onclick = () => this._deleteFund(id, h.name);
  },

  async _deleteFund(id, name) {
    if (!Utils.confirm(`Remove ${Utils.shortFundName(name)} from your portfolio?`)) return;
    try { Utils.showLoader(); await this.delete(id); App.closeModal('modal-mf-detail'); Utils.toast('Fund removed', 'success'); }
    catch (e) { Utils.toast('Failed to remove: ' + e.message, 'error'); }
    finally { Utils.hideLoader(); }
  },

  getCategoryBreakdown() {
    const map = {}; let total = 0;
    this.holdings.forEach(h => {
      const n = this.getNav(h.schemeCode);
      const val = (n ? n.nav : h.buyNav) * h.units;
      const group = MfAPI.categoryGroup(n?.meta?.scheme_category || h.category);
      map[group] = (map[group] || 0) + val; total += val;
    });
    if (!total) return [];
    return Object.entries(map).map(([group, value]) => ({ group, value, pct: (value / total) * 100 })).sort((a, b) => b.pct - a.pct);
  },
};
