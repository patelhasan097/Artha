const Watchlist = {
  items: [],
  listener: null,

  async init(uid) {
    if (this.listener) { this.listener(); this.listener = null; }
    this.listener = db.collection('users').doc(uid).collection('watchlist')
      .orderBy('addedAt', 'desc')
      .onSnapshot(snap => {
        this.items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        this.render();
        Inbox.refreshWatchedSymbols();
        if (this.items.length > 0) StockAPI.startAutoRefresh();
      }, err => console.error('Watchlist snapshot error:', err));
  },

  async add(symbol, name, exchange = 'NSE', sector = 'Other') {
    const uid = auth.currentUser.uid;
    if (this.items.find(i => i.symbol === symbol && (i.exchange || 'NSE') === exchange)) {
      Utils.toast(`${symbol} is already in watchlist`, 'info');
      return;
    }
    await db.collection('users').doc(uid).collection('watchlist').add({
      symbol, name: name || symbol, exchange, sector, addedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  },

  async remove(id) {
    const uid = auth.currentUser.uid;
    await db.collection('users').doc(uid).collection('watchlist').doc(id).delete();
  },

  render() {
    const list = Utils.el('watch-list');
    const empty = Utils.el('watch-empty');
    if (!list) return;

    if (this.items.length === 0) { list.innerHTML = ''; empty?.classList.remove('hidden'); return; }
    empty?.classList.add('hidden');

    list.innerHTML = this.items.map((item, i) => this._cardHTML(item, i)).join('');

    list.querySelectorAll('[data-action="del"]').forEach(btn => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id, sym = btn.dataset.sym;
        if (!Utils.confirm(`Remove ${sym} from watchlist?`)) return;
        try { await this.remove(id); Utils.toast(`${sym} removed`, 'success'); } catch (_) { Utils.toast('Failed to remove', 'error'); }
      };
    });

    list.querySelectorAll('[data-action="add"]').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const item = this.items.find(i => i.id === btn.dataset.id);
        if (item) App.openAddModal({ symbol: item.symbol, name: item.name, exchange: item.exchange || 'NSE', sector: item.sector || 'Other' });
      };
    });

    requestAnimationFrame(() => Charts.renderSparklines(this.items));
  },

  _cardHTML(item, i = 0) {
    const p = StockAPI.getPrice(item.symbol, item.exchange || 'NSE');
    const isPos = p ? p.changePct >= 0 : true;
    return `
    <div class="watch-card stagger-in" style="animation-delay:${Math.min(i * 30, 240)}ms">
      <div class="watch-card-left">
        <div class="stock-avatar" style="width:35px;height:35px;font-size:11.5px;flex-shrink:0;">${Utils.initials(item.symbol)}</div>
        <div class="watch-info">
          <div class="watch-sym">${item.symbol}<span style="font-size:9.5px;color:var(--t3);font-weight:400;margin-left:4px;">${item.exchange || 'NSE'}</span></div>
          <div class="watch-name">${item.name || item.symbol}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin-left:auto;">
        <div id="spark-${item.id}" class="watch-sparkline"></div>
        <div class="watch-card-right">
          <div class="watch-price" id="wp-${item.id}">${p ? Utils.fmtCurrencyFull(p.price) : '–'}</div>
          <div class="watch-change ${isPos ? 'gain' : 'loss'}" id="wc-${item.id}">${p ? Utils.fmtPctSigned(p.changePct) : '–'}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:5px;">
          <button class="watch-add-btn" data-action="add" data-id="${item.id}" title="Add to portfolio"><i class="ti ti-plus" style="font-size:12px;"></i></button>
          <button class="watch-del-btn" data-action="del" data-id="${item.id}" data-sym="${item.symbol}" title="Remove"><i class="ti ti-x" style="font-size:12px;"></i></button>
        </div>
      </div>
    </div>`;
  },

  getSymbols() { return this.items.map(i => i.symbol); },
};
