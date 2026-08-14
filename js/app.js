const App = {
  _isSignUp: false,
  _editId: null,
  _selStock: null,

  async init() {
    // Relative path — fixes the "won't install" bug from absolute '/sw.js' on GitHub Pages sub-paths
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }

    this._bindEvents();

    const dateEl = Utils.el('add-date');
    if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];

    auth.onAuthStateChanged(user => {
      Utils.hideLoader();
      if (user) {
        const pinHash = localStorage.getItem('artha_pin_' + user.uid);
        if (pinHash) { this.showScreen('pin-lock'); Auth.initLockPad(); }
        else {
          const isFirstTime = !localStorage.getItem('artha_onboarded_' + user.uid);
          if (isFirstTime) { localStorage.setItem('artha_onboarded_' + user.uid, '1'); this.showScreen('onboarding'); this._initOnboarding(); }
          else this.showMainApp(user);
        }
      } else { this.showScreen('auth'); this._initAuthUI(); }
    });
  },

  showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    Utils.el('app-shell').classList.add('hidden');
    const el = Utils.el(id);
    if (el) { el.style.display = 'flex'; el.style.animation = 'fadeIn 0.35s var(--ease)'; }
    Utils.hideLoader();
  },

  async showMainApp(user) {
    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    Utils.el('app-shell').classList.remove('hidden');

    const name = user.displayName || user.email?.split('@')[0] || 'User';
    const initial = name[0].toUpperCase();
    Utils.setText('settings-name', name);
    Utils.setText('settings-email', user.email || '');

    const avatarEl = Utils.el('user-avatar');
    avatarEl.innerHTML = user.photoURL ? `<img src="${user.photoURL}" alt="">` : initial;
    const sAv = Utils.el('settings-avatar');
    if (sAv) sAv.innerHTML = user.photoURL ? `<img src="${user.photoURL}" alt="">` : initial;

    const bioEl = Utils.el('bio-toggle');
    if (bioEl) bioEl.checked = localStorage.getItem('artha_bio_' + user.uid) === 'true';

    await Portfolio.init(user.uid);
    await Watchlist.init(user.uid);
    await MutualFunds.init(user.uid);

    this.renderIndexTicker();
    setInterval(() => this.renderIndexTicker(), 30000);

    // Handle PWA shortcut deep-links (?action=add / ?action=watchlist)
    const params = new URLSearchParams(location.search);
    if (params.get('action') === 'add') setTimeout(() => { this.Router.go('portfolio'); this.openAddModal(); }, 300);
    else if (params.get('action') === 'watchlist') this.Router.go('watchlist');
    else this.Router.go('home');

    Utils.hideLoader();
  },

  // ═══ INDEX TICKER ═══
  // Two halves on purpose: fetch (network) vs render (DOM from cache). Stock
  // API's own refresh cycle already fetches indices — calling the combined
  // version there would silently double every index request.
  async renderIndexTicker() {
    await StockAPI.fetchIndices();
    this.updateIndexTickerUI();
  },

  updateIndexTickerUI() {
    const map = { nifty: 'NIFTY 50', sensex: 'SENSEX', banknifty: 'BANK NIFTY' };
    Object.entries(map).forEach(([key]) => {
      const d = StockAPI.indices[key];
      if (!d) return;
      const valEl = Utils.el(`tk-${key}-val`);
      const chgEl = Utils.el(`tk-${key}-chg`);
      if (valEl) valEl.textContent = d.price?.toLocaleString('en-IN', { maximumFractionDigits: 2 }) || '–';
      if (chgEl) { chgEl.textContent = Utils.fmtPctSigned(d.changePct); chgEl.className = 'ticker-chg mono ' + (d.changePct >= 0 ? 'gain' : 'loss'); }
    });
  },

  // ═══ ROUTER ═══
  Router: {
    current: 'home',
    go(page) {
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      Utils.el('page-' + page)?.classList.add('active');
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === page));
      this.current = page;

      if (page === 'home') { Portfolio.renderDashboard(); Charts.refreshSectorDonut(); }
      if (page === 'watchlist') { Watchlist.render(); requestAnimationFrame(() => Charts.renderSparklines(Watchlist.items)); }
      if (page === 'inbox') { Inbox.render(); if (Inbox._watchedSymbols.length) Inbox.fetchAll(); }
      if (page === 'portfolio') { /* segmented view already current */ }
    },
  },

  // ═══ MODALS ═══
  openModal(id) { const el = Utils.el(id); if (!el) return; el.classList.add('open'); document.body.style.overflow = 'hidden'; },
  closeModal(id) { const el = Utils.el(id); if (!el) return; el.classList.remove('open'); document.body.style.overflow = ''; this._selStock = null; this._editId = null; },

  // ═══ ADD / EDIT STOCK ═══
  openAddModal(prefill = null) {
    this._editId = prefill?.id || null;
    this._selStock = prefill ? { s: prefill.symbol, n: prefill.name, sec: prefill.sector } : null;
    Utils.el('stock-search').value = prefill?.symbol || '';
    Utils.el('add-exchange').value = prefill?.exchange || 'NSE';
    Utils.el('add-sector').value = prefill?.sector || 'Other';
    Utils.el('add-price').value = prefill?.buyPrice || '';
    Utils.el('add-qty').value = prefill?.quantity || '';
    Utils.el('add-date').value = prefill?.buyDate || new Date().toISOString().split('T')[0];
    Utils.el('add-modal-title').textContent = this._editId ? 'Edit position' : 'Add stock';
    Utils.el('price-preview').classList.remove('show');
    Utils.el('stock-suggestions').classList.remove('show');
    this.openModal('modal-add');
    Utils.el('stock-search').focus();
    if (prefill?.symbol) this._refreshPreview(prefill.symbol, prefill.exchange || 'NSE');
  },

  _refreshPreview(symbol, exchange) {
    const p = StockAPI.getPrice(symbol, exchange);
    const price = parseFloat(Utils.el('add-price').value) || 0;
    const qty = parseInt(Utils.el('add-qty').value) || 0;
    const prev = Utils.el('price-preview');
    if (!p && !price) { prev.classList.remove('show'); return; }
    prev.classList.add('show');
    Utils.setText('preview-cmp', p ? Utils.fmtCurrencyFull(p.price) : '–');
    if (price > 0 && qty > 0) {
      const invested = price * qty;
      const current = p ? p.price * qty : invested;
      const pnl = current - invested;
      Utils.setText('preview-invested', Utils.fmtCurrency(invested));
      const pnlEl = Utils.el('preview-pnl');
      if (pnlEl) { pnlEl.textContent = (pnl >= 0 ? '+' : '') + Utils.fmtCurrency(pnl); pnlEl.className = 'price-preview-val ' + (pnl >= 0 ? 'gain' : 'loss'); }
    }
  },

  // ═══ ONBOARDING ═══
  _initOnboarding() {
    let slide = 0; const total = 3;
    const slidesEl = Utils.el('onboard-slides'), dotsEl = Utils.el('onboard-dots'), nextBtn = Utils.el('btn-onboard-next');
    const goSlide = (i) => {
      slide = Math.max(0, Math.min(total - 1, i));
      slidesEl.style.transform = `translateX(-${slide * 100}%)`;
      dotsEl.querySelectorAll('.onboard-dot').forEach((d, j) => d.classList.toggle('active', j === slide));
      nextBtn.textContent = slide === total - 1 ? 'Get started' : 'Next';
    };
    nextBtn.onclick = () => { if (slide < total - 1) goSlide(slide + 1); else { this.showScreen('pin-setup'); Auth.initSetupPad(); } };
    Utils.el('btn-onboard-skip').onclick = () => { this.showScreen('pin-setup'); Auth.initSetupPad(); };
  },

  // ═══ AUTH UI ═══
  _initAuthUI() {
    this._isSignUp = false;
    Utils.el('btn-google').onclick = () => Auth.signInGoogle();
    Utils.el('btn-email-action').onclick = () => {
      const email = Utils.el('auth-email').value.trim();
      const pass = Utils.el('auth-password').value;
      if (!email || !pass) { Utils.toast('Please fill in email and password', 'error'); return; }
      this._isSignUp ? Auth.createAccount(email, pass) : Auth.signInEmail(email, pass);
    };
    ['auth-email', 'auth-password'].forEach(id => Utils.el(id).addEventListener('keydown', e => { if (e.key === 'Enter') Utils.el('btn-email-action').click(); }));
    Utils.el('btn-auth-switch').onclick = () => {
      this._isSignUp = !this._isSignUp;
      const s = this._isSignUp;
      Utils.el('auth-subtitle').textContent = s ? 'Create your Artha account' : 'Sign in to track your portfolio';
      Utils.el('btn-email-action').textContent = s ? 'Create account' : 'Sign in';
      Utils.el('auth-switch-text').textContent = s ? 'Already have an account?' : "Don't have an account?";
      Utils.el('btn-auth-switch').textContent = s ? 'Sign in' : 'Sign up';
      Utils.el('auth-error').classList.remove('show');
    };
  },

  // ═══ ADD / EDIT MUTUAL FUND ═══
  _editMfId: null,
  _selFund: null,

  openAddMfModal(prefill = null) {
    this._editMfId = prefill?.id || null;
    this._selFund = prefill ? { schemeCode: prefill.schemeCode, name: prefill.name, category: prefill.category } : null;
    Utils.el('mf-search').value = prefill?.name || '';
    Utils.el('add-mf-units').value = prefill?.units || '';
    Utils.el('add-mf-nav').value = prefill?.buyNav || '';
    Utils.el('add-mf-date').value = prefill?.buyDate || new Date().toISOString().split('T')[0];
    Utils.el('add-mf-modal-title').textContent = this._editMfId ? 'Edit position' : 'Add mutual fund';
    Utils.el('mf-price-preview').classList.remove('show');
    Utils.el('mf-suggestions').classList.remove('show');
    this.openModal('modal-add-mf');
    Utils.el('mf-search').focus();
    if (prefill?.schemeCode) this._refreshMfPreview(prefill.schemeCode);
  },

  async _refreshMfPreview(schemeCode) {
    const scheme = await MfAPI.fetchScheme(schemeCode);
    const units = parseFloat(Utils.el('add-mf-units').value) || 0;
    const buyNav = parseFloat(Utils.el('add-mf-nav').value) || 0;
    const prev = Utils.el('mf-price-preview');
    if (!scheme && !buyNav) { prev.classList.remove('show'); return; }
    prev.classList.add('show');
    Utils.setText('mf-preview-nav', scheme ? Utils.fmtCurrencyFull(scheme.latestNav) : '–');
    if (buyNav > 0 && units > 0) {
      const invested = buyNav * units;
      const current = scheme ? scheme.latestNav * units : invested;
      const pnl = current - invested;
      Utils.setText('mf-preview-invested', Utils.fmtCurrency(invested));
      const pnlEl = Utils.el('mf-preview-pnl');
      if (pnlEl) { pnlEl.textContent = (pnl >= 0 ? '+' : '') + Utils.fmtCurrency(pnl); pnlEl.className = 'price-preview-val ' + (pnl >= 0 ? 'gain' : 'loss'); }
    }
  },

  // ═══ SEGMENTED CONTROL (Portfolio: Holdings / Analytics) ═══
  _initSegmented() {
    this._bindSegmented('portfolio-segmented', 'segmented-bg', 'seg-holdings', 'seg-analytics', () => Charts.initAnalyticsCharts(Portfolio.holdings));
    this._bindSegmented('mf-segmented', 'mf-segmented-bg', 'mf-seg-holdings', 'mf-seg-analytics', () => Charts.refreshMfCategoryChart());
  },

  _bindSegmented(wrapId, bgId, holdingsId, analyticsId, onAnalytics) {
    const wrap = Utils.el(wrapId);
    if (!wrap) return;
    const bg = Utils.el(bgId);
    const btns = wrap.querySelectorAll('.segmented-btn');
    btns.forEach((btn, i) => {
      btn.onclick = () => {
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        bg.style.left = i === 0 ? '3px' : 'calc(50% + 0px)';
        bg.style.width = 'calc(50% - 3px)';
        const seg = btn.dataset.seg;
        Utils.setClass(holdingsId, 'hidden', seg !== 'holdings');
        Utils.setClass(analyticsId, 'hidden', seg !== 'analytics');
        if (seg === 'analytics') setTimeout(onAnalytics, 100);
      };
    });
  },

  // ═══ ASSET CLASS SWITCHER (Stocks / Mutual Funds) ═══
  _assetClass: 'stocks',
  _initAssetTabs() {
    Utils.el('asset-tabs')?.querySelectorAll('.asset-tab').forEach(btn => {
      btn.onclick = () => {
        Utils.el('asset-tabs').querySelectorAll('.asset-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this._assetClass = btn.dataset.asset;
        Utils.setClass('asset-stocks', 'hidden', this._assetClass !== 'stocks');
        Utils.setClass('asset-mf', 'hidden', this._assetClass !== 'mf');
        Utils.el('btn-add-stock').classList.toggle('hidden', this._assetClass !== 'stocks');
        Utils.el('btn-add-mf').classList.toggle('hidden', this._assetClass !== 'mf');
      };
    });
  },

  // ═══ ALL EVENT BINDINGS ═══
  _bindEvents() {
    document.querySelectorAll('.nav-btn').forEach(btn => { btn.onclick = () => this.Router.go(btn.dataset.page); });

    Utils.el('btn-refresh').onclick = () => StockAPI._doRefresh();
    Utils.el('user-avatar').onclick = () => this.Router.go('settings');

    // Privacy eye-toggle — a real trust signal in broker apps (Groww, Dhan both
    // have this): masks rupee amounts on screen without needing to leave the app.
    const privacyBtn = Utils.el('btn-privacy');
    const setPrivacyIcon = () => { privacyBtn.querySelector('i').className = 'ti ' + (Utils.hideAmounts ? 'ti-eye-off' : 'ti-eye'); };
    setPrivacyIcon();
    privacyBtn.onclick = () => {
      Utils.togglePrivacy();
      setPrivacyIcon();
      Portfolio.renderDashboard();
      Portfolio.renderCards();
      Watchlist.render();
    };

    Utils.el('chip-add')?.addEventListener('click', () => { this.Router.go('portfolio'); setTimeout(() => this.openAddModal(), 200); });
    Utils.el('chip-refresh')?.addEventListener('click', () => StockAPI._doRefresh());
    Utils.el('chip-inbox')?.addEventListener('click', () => this.Router.go('inbox'));

    Utils.el('btn-add-stock').onclick = () => this.openAddModal();

    Utils.el('btn-close-add').onclick = () => this.closeModal('modal-add');
    Utils.el('btn-close-detail').onclick = () => this.closeModal('modal-detail');
    Utils.el('btn-close-watch-add').onclick = () => this.closeModal('modal-watch-add');
    Utils.el('btn-close-lynch-info').onclick = () => this.closeModal('modal-lynch-info');
    Utils.el('btn-close-inbox-detail').onclick = () => this.closeModal('modal-inbox-detail');

    document.querySelectorAll('.modal-overlay').forEach(ov => {
      ov.onclick = e => { if (e.target === ov) { ov.classList.remove('open'); document.body.style.overflow = ''; } };
    });

    this._initSegmented();
    this._initAssetTabs();

    Utils.el('sort-options')?.querySelectorAll('.sort-opt').forEach(btn => {
      btn.onclick = () => {
        Utils.el('sort-options').querySelectorAll('.sort-opt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        Portfolio.setSort(btn.dataset.sort);
      };
    });

    // ── Add stock: search autocomplete ──
    const searchEl = Utils.el('stock-search'), suggEl = Utils.el('stock-suggestions');
    searchEl.oninput = () => {
      const q = searchEl.value.trim();
      const results = StockAPI.search(q);
      if (!q || results.length === 0) { suggEl.classList.remove('show'); return; }
      suggEl.innerHTML = results.map(s => `<div class="suggestion-item" data-sym="${s.s}" data-name="${s.n}" data-sec="${s.sec}"><div class="suggestion-sym">${s.s}</div><div class="suggestion-name">${s.n}</div></div>`).join('');
      suggEl.classList.add('show');
      suggEl.querySelectorAll('.suggestion-item').forEach(item => {
        item.onclick = () => {
          searchEl.value = item.dataset.sym;
          this._selStock = { s: item.dataset.sym, n: item.dataset.name, sec: item.dataset.sec };
          Utils.el('add-sector').value = item.dataset.sec;
          suggEl.classList.remove('show');
          const exchange = Utils.el('add-exchange').value;
          StockAPI.fetchQuotes([{ symbol: item.dataset.sym, exchange }]).then(() => this._refreshPreview(item.dataset.sym, exchange));
        };
      });
    };
    ['add-price', 'add-qty'].forEach(id => { Utils.el(id).oninput = () => { const sym = searchEl.value.trim().toUpperCase(); if (sym) this._refreshPreview(sym, Utils.el('add-exchange').value); }; });

    Utils.el('btn-save-stock').onclick = async () => {
      const symbol = (searchEl.value || '').trim().toUpperCase();
      const exchange = Utils.el('add-exchange').value;
      const sector = Utils.el('add-sector').value;
      const buyPrice = parseFloat(Utils.el('add-price').value);
      const quantity = parseInt(Utils.el('add-qty').value);
      const buyDate = Utils.el('add-date').value;

      if (!symbol) { Utils.toast('Enter a stock symbol', 'error'); return; }
      if (!buyPrice || buyPrice < 0) { Utils.toast('Enter a valid buy price', 'error'); return; }
      if (!quantity || quantity < 1) { Utils.toast('Quantity must be at least 1', 'error'); return; }
      if (!buyDate) { Utils.toast('Select a buy date', 'error'); return; }

      const meta = this._selStock || StockAPI.findStock(symbol);
      const name = meta?.n || meta?.name || symbol;

      try {
        Utils.showLoader();
        const data = { symbol, name, exchange, sector, buyPrice, quantity, buyDate };
        if (this._editId) { await Portfolio.update(this._editId, data); Utils.toast(`${symbol} updated`, 'success'); }
        else { await Portfolio.add(data); Utils.toast(`${symbol} added to portfolio`, 'success'); }
        this.closeModal('modal-add');
        this.Router.go('portfolio');
        StockAPI.fetchQuotes([{ symbol, exchange }]).then(() => Portfolio.renderCards());
      } catch (e) { Utils.toast('Save failed: ' + e.message, 'error'); }
      finally { Utils.hideLoader(); }
    };

    // ── Add mutual fund ──
    Utils.el('btn-add-mf').onclick = () => this.openAddMfModal();
    Utils.el('btn-close-add-mf').onclick = () => this.closeModal('modal-add-mf');
    Utils.el('btn-close-mf-detail').onclick = () => this.closeModal('modal-mf-detail');

    const mfSearchEl = Utils.el('mf-search'), mfSuggEl = Utils.el('mf-suggestions');
    let mfSearchDebounce = null;
    mfSearchEl.oninput = () => {
      const q = mfSearchEl.value.trim();
      clearTimeout(mfSearchDebounce);
      if (!q || q.length < 2) { mfSuggEl.classList.remove('show'); return; }
      mfSearchDebounce = setTimeout(async () => {
        const results = await MfAPI.search(q);
        if (results.length === 0) { mfSuggEl.innerHTML = '<div style="padding:14px;font-size:12.5px;color:var(--t3);">No funds found</div>'; mfSuggEl.classList.add('show'); return; }
        mfSuggEl.innerHTML = results.map(r => `<div class="suggestion-item" data-code="${r.schemeCode}" data-name="${(r.schemeName || '').replace(/"/g, '&quot;')}"><div class="suggestion-sym" style="font-size:12.5px;">${Utils.shortFundName(r.schemeName)}</div><div class="suggestion-name">${r.schemeName}</div></div>`).join('');
        mfSuggEl.classList.add('show');
        mfSuggEl.querySelectorAll('.suggestion-item').forEach(item => {
          item.onclick = () => {
            mfSearchEl.value = item.dataset.name;
            this._selFund = { schemeCode: item.dataset.code, name: item.dataset.name };
            mfSuggEl.classList.remove('show');
            this._refreshMfPreview(item.dataset.code);
          };
        });
      }, 350);
    };
    ['add-mf-units', 'add-mf-nav'].forEach(id => {
      Utils.el(id).oninput = () => { if (this._selFund?.schemeCode) this._refreshMfPreview(this._selFund.schemeCode); };
    });

    Utils.el('btn-save-mf').onclick = async () => {
      if (!this._selFund?.schemeCode) { Utils.toast('Search and select a fund from the list', 'error'); return; }
      const units = parseFloat(Utils.el('add-mf-units').value);
      const buyNav = parseFloat(Utils.el('add-mf-nav').value);
      const buyDate = Utils.el('add-mf-date').value;
      if (!units || units <= 0) { Utils.toast('Enter valid units', 'error'); return; }
      if (!buyNav || buyNav < 0) { Utils.toast('Enter a valid buy NAV', 'error'); return; }
      if (!buyDate) { Utils.toast('Select an investment date', 'error'); return; }

      try {
        Utils.showLoader();
        const scheme = await MfAPI.fetchScheme(this._selFund.schemeCode);
        const data = { schemeCode: this._selFund.schemeCode, name: this._selFund.name, units, buyNav, buyDate, category: scheme?.meta?.scheme_category || '' };
        if (this._editMfId) { await MutualFunds.update(this._editMfId, data); Utils.toast('Fund updated', 'success'); }
        else { await MutualFunds.add(data); Utils.toast('Fund added', 'success'); }
        this.closeModal('modal-add-mf');
      } catch (e) { Utils.toast('Save failed: ' + e.message, 'error'); }
      finally { Utils.hideLoader(); }
    };

    // ── Watchlist add ──
    Utils.el('btn-add-watch').onclick = () => {
      Utils.el('watch-search').value = ''; Utils.el('watch-search').dataset.name = ''; Utils.el('watch-search').dataset.sec = '';
      this.openModal('modal-watch-add');
      Utils.el('watch-search').focus();
    };
    const watchEl = Utils.el('watch-search'), watchSugg = Utils.el('watch-suggestions');
    watchEl.oninput = () => {
      const q = watchEl.value.trim();
      const results = StockAPI.search(q);
      if (!q || results.length === 0) { watchSugg.classList.remove('show'); return; }
      watchSugg.innerHTML = results.map(s => `<div class="suggestion-item" data-sym="${s.s}" data-name="${s.n}" data-sec="${s.sec}"><div class="suggestion-sym">${s.s}</div><div class="suggestion-name">${s.n}</div></div>`).join('');
      watchSugg.classList.add('show');
      watchSugg.querySelectorAll('.suggestion-item').forEach(item => {
        item.onclick = () => { watchEl.value = item.dataset.sym; watchEl.dataset.name = item.dataset.name; watchEl.dataset.sec = item.dataset.sec; watchSugg.classList.remove('show'); };
      });
    };
    Utils.el('btn-save-watch').onclick = async () => {
      const symbol = watchEl.value.trim().toUpperCase();
      const exchange = Utils.el('watch-exchange').value;
      const name = watchEl.dataset.name || symbol;
      const sector = watchEl.dataset.sec || 'Other';
      if (!symbol) { Utils.toast('Enter a stock symbol', 'error'); return; }
      try {
        Utils.showLoader();
        await Watchlist.add(symbol, name, exchange, sector);
        this.closeModal('modal-watch-add');
        this.Router.go('watchlist');
        StockAPI.fetchQuotes([{ symbol, exchange }]).then(() => Watchlist.render());
      } catch (e) { Utils.toast('Failed to add: ' + e.message, 'error'); }
      finally { Utils.hideLoader(); }
    };

    // ── Inbox ──
    Utils.el('inbox-filter-row')?.querySelectorAll('.filter-tab').forEach(tab => {
      tab.onclick = () => {
        Utils.el('inbox-filter-row').querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        Inbox.setFilter(tab.dataset.filter);
      };
    });
    Utils.el('btn-mark-read')?.addEventListener('click', () => Inbox.markAllRead());

    // ── Settings ──
    Utils.el('row-signout')?.addEventListener('click', () => Auth.signOut());
    Utils.el('row-change-pin')?.addEventListener('click', () => { Auth.initSetupPad(); this.showScreen('pin-setup'); });
    Utils.el('row-github')?.addEventListener('click', () => window.open('https://github.com', '_blank'));

    Utils.el('row-export')?.addEventListener('click', () => {
      const rows = Portfolio.holdings.map(h => {
        const p = StockAPI.getPrice(h.symbol, h.exchange);
        const { invested, current, pnl, pct } = p ? Portfolio.calcPnL(h, p.price) : { invested: h.buyPrice * h.quantity, current: 0, pnl: 0, pct: 0 };
        return [h.symbol, h.name || '', h.exchange, h.sector || '', h.buyPrice, h.quantity, h.buyDate, invested.toFixed(2), p ? p.price.toFixed(2) : '', current.toFixed(2), pnl.toFixed(2), pct.toFixed(2) + '%'];
      });
      if (rows.length === 0) { Utils.toast('No holdings to export', 'info'); return; }
      Utils.exportCSV(rows);
      Utils.toast('CSV downloaded', 'success');
    });

    Utils.el('bio-toggle')?.addEventListener('change', async e => {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      if (e.target.checked) { const ok = await Auth.setupBiometric(uid); if (!ok) e.target.checked = false; }
      else { localStorage.removeItem('artha_bio_' + uid); localStorage.removeItem('artha_cred_' + uid); Utils.toast('Biometric disabled', 'info'); }
    });

    Utils.el('refresh-interval')?.addEventListener('change', e => StockAPI.setInterval(parseInt(e.target.value)));

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(m => { m.classList.remove('open'); document.body.style.overflow = ''; });
    });

    // ── PWA install prompt ──
    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      deferredPrompt = e;
      setTimeout(() => { if (deferredPrompt) Utils.toast('Tip: Install Artha as an app for the best experience', 'info', 6000); }, 25000);
    });
  },
};

document.addEventListener('DOMContentLoaded', () => {
  if (typeof Chart !== 'undefined') {
    Chart.defaults.color = '#96a0b8';
    Chart.defaults.font.family = 'Inter, sans-serif';
    Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';
    Chart.defaults.plugins.tooltip.enabled = true;
  }
  App.init();
});
