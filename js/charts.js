const Charts = {
  _sectorChart: null,
  _anSectorChart: null,
  _anPnlChart: null,
  _stockChart: null,
  _stockSeries: null,

  // ─── Hero ambient sparkline (signature element) ───
  renderHeroSparkline(currentValue) {
    const el = Utils.el('hero-sparkline-bg');
    if (!el) return;

    // Track a rolling session history of portfolio value for a live-feeling trend line
    StockAPI.history.push(currentValue);
    if (StockAPI.history.length > 40) StockAPI.history.shift();
    if (StockAPI.history.length < 2) { el.innerHTML = ''; return; }

    const isUp = StockAPI.history[StockAPI.history.length - 1] >= StockAPI.history[0];
    el.innerHTML = Utils.ambientSparkline(StockAPI.history, isUp);
  },

  // ─── Dashboard sector donut ───
  initSectorDonut(data) {
    const canvas = Utils.el('sector-donut');
    if (!canvas) return;
    if (this._sectorChart) { this._sectorChart.destroy(); this._sectorChart = null; }
    Utils.setText('sector-count', data?.length || 0);

    if (!data || data.length === 0) {
      Utils.el('sector-legend').innerHTML = '<div style="font-size:12.5px;color:var(--t3);">Add stocks to see breakdown</div>';
      return;
    }

    this._sectorChart = new Chart(canvas, {
      type: 'doughnut',
      data: { labels: data.map(d => d.sector), datasets: [{ data: data.map(d => d.pct), backgroundColor: data.map(d => Utils.sectorColor(d.sector)), borderWidth: 0, hoverOffset: 6 }] },
      options: {
        responsive: false, cutout: '74%', animation: { duration: 500, easing: 'easeOutQuart' },
        plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(22,19,15,0.96)', borderColor: 'rgba(255,250,240,0.1)', borderWidth: 1, callbacks: { label: c => `  ${c.label}: ${c.parsed.toFixed(1)}%` } } },
      },
    });

    Utils.el('sector-legend').innerHTML = data.slice(0, 6).map(d => `
      <div class="sector-legend-item">
        <div class="sector-legend-left"><div class="sector-dot" style="background:${Utils.sectorColor(d.sector)}"></div><span class="sector-name">${d.sector}</span></div>
        <span class="sector-pct">${d.pct.toFixed(1)}%</span>
      </div>`).join('') + (data.length > 6 ? `<div style="font-size:10.5px;color:var(--t3);margin-top:4px;">+${data.length - 6} more</div>` : '');
  },

  refreshSectorDonut() { this.initSectorDonut(Portfolio.getSectorBreakdown()); },

  initAnalyticsCharts(holdings) {
    this._initAnSectorChart();
    this._initAnPnlChart(holdings);
  },

  _initAnSectorChart() {
    const ctx = Utils.el('an-sector-chart');
    if (!ctx) return;
    if (this._anSectorChart) { this._anSectorChart.destroy(); this._anSectorChart = null; }
    const data = Portfolio.getSectorBreakdown();
    if (!data || data.length === 0) return;

    this._anSectorChart = new Chart(ctx, {
      type: 'doughnut',
      data: { labels: data.map(d => d.sector), datasets: [{ data: data.map(d => d.pct), backgroundColor: data.map(d => Utils.sectorColor(d.sector)), borderWidth: 0, hoverOffset: 6 }] },
      options: {
        responsive: true, cutout: '60%',
        plugins: {
          legend: { display: true, position: 'right', labels: { color: '#A39C90', font: { size: 11, family: 'Inter' }, boxWidth: 10, padding: 12 } },
          tooltip: { backgroundColor: 'rgba(22,19,15,0.96)', borderColor: 'rgba(255,250,240,0.1)', borderWidth: 1, callbacks: { label: c => `  ${c.label}: ${c.parsed.toFixed(1)}%` } },
        },
      },
    });
  },

  _initAnPnlChart(holdings) {
    const ctx = Utils.el('an-pnl-chart');
    if (!ctx) return;
    if (this._anPnlChart) { this._anPnlChart.destroy(); this._anPnlChart = null; }

    const items = holdings.map(h => { const p = StockAPI.getPrice(h.symbol, h.exchange); return p ? { sym: h.symbol, pnl: (p.price - h.buyPrice) * h.quantity } : null; }).filter(Boolean).sort((a, b) => b.pnl - a.pnl);
    if (items.length === 0) return;

    this._anPnlChart = new Chart(ctx, {
      type: 'bar',
      data: { labels: items.map(i => i.sym), datasets: [{ data: items.map(i => i.pnl), backgroundColor: items.map(i => i.pnl >= 0 ? 'rgba(62,214,140,0.65)' : 'rgba(240,82,93,0.65)'), borderRadius: 5, borderSkipped: false }] },
      options: {
        responsive: true, indexAxis: 'y',
        plugins: { legend: { display: false }, tooltip: { backgroundColor: 'rgba(22,19,15,0.96)', borderColor: 'rgba(255,250,240,0.1)', borderWidth: 1, callbacks: { label: c => `  ${Utils.fmtCurrencyFull(c.parsed.x)}` } } },
        scales: {
          x: { grid: { color: 'rgba(255,250,240,0.04)' }, ticks: { color: '#A39C90', font: { size: 10 }, callback: v => Utils.fmtCurrency(v) } },
          y: { grid: { display: false }, ticks: { color: '#F4F0E8', font: { size: 11, family: 'JetBrains Mono' } } },
        },
      },
    });
  },

  // NOTE on the fix: the old version left a placeholder <div> spinner sitting
  // inside the container via innerHTML, then called createChart() on the same
  // container — which APPENDS its own canvas rather than replacing existing
  // content. With a fixed-height, overflow:hidden container, that leftover
  // spinner div silently sat on top forever, hiding the real chart underneath
  // even once data arrived. Fix: clear the container fully before creating the
  // chart, and use a separate absolutely-positioned overlay for loading state
  // that every code path (success, empty, error) explicitly removes.
  initStockChart() {
    const container = Utils.el('stock-chart-container');
    if (!container) return;
    if (this._stockChart) { this._stockChart.remove(); this._stockChart = null; this._stockSeries = null; }
    container.innerHTML = '';
    container.style.position = 'relative';

    try {
      this._stockChart = LightweightCharts.createChart(container, {
        width: container.clientWidth || 320, height: 175,
        layout: { background: { color: 'transparent' }, textColor: '#A39C90', fontFamily: 'JetBrains Mono, monospace' },
        grid: { vertLines: { color: 'rgba(255,250,240,0.04)' }, horzLines: { color: 'rgba(255,250,240,0.04)' } },
        crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
        rightPriceScale: { borderColor: 'rgba(255,250,240,0.08)' },
        timeScale: { borderColor: 'rgba(255,250,240,0.08)', timeVisible: true, secondsVisible: false },
        handleScroll: { mouseWheel: false }, handleScale: { mouseWheel: false },
      });
      this._stockSeries = this._stockChart.addAreaSeries({
        lineColor: '#3ED68C', topColor: 'rgba(62,214,140,0.18)', bottomColor: 'rgba(62,214,140,0.0)',
        lineWidth: 2, crosshairMarkerVisible: true, crosshairMarkerRadius: 4,
        priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
      });
      this._setChartOverlay(container, 'loading');
    } catch (e) {
      this._setChartOverlay(container, 'error', 'Chart unavailable on this device');
    }
  },

  // Overlay states live in a sibling element, never inside the chart's own DOM —
  // so the chart and the "is it loading / empty / broken" message can never fight
  // over the same space again.
  _setChartOverlay(container, state, message = '') {
    const overlayId = (container.id || 'chart') + '-overlay';
    Utils.el(overlayId)?.remove();
    if (state === 'ready') return;
    const overlay = document.createElement('div');
    overlay.id = overlayId;
    overlay.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:var(--surface);z-index:5;';
    if (state === 'loading') {
      overlay.innerHTML = '<div class="load-spinner" style="width:22px;height:22px;border-width:2px;"></div>';
    } else {
      overlay.innerHTML = `<i class="ti ti-wifi-off" style="font-size:20px;color:var(--t3);"></i><span style="font-size:12px;color:var(--t3);text-align:center;padding:0 20px;">${message}</span>`;
    }
    container.appendChild(overlay);
  },

  async loadStockChart(symbol, exchange, range = '1mo') {
    const container = Utils.el('stock-chart-container');
    if (!this._stockSeries || !container) return;
    this._setChartOverlay(container, 'loading');

    let raw;
    try {
      raw = await StockAPI.fetchHistory(symbol, exchange, range);
    } catch (e) {
      this._setChartOverlay(container, 'error', "Couldn't load chart — check your connection and try again");
      return;
    }

    if (!raw || raw.length === 0) {
      this._setChartOverlay(container, 'error', 'No chart data available for this range');
      return;
    }

    try {
      const seen = new Set();
      const data = raw.filter(d => d.value != null && !isNaN(d.value))
        .filter(d => { if (seen.has(d.time)) return false; seen.add(d.time); return true; })
        .sort((a, b) => a.time - b.time)
        .map(d => ({ time: d.time, value: parseFloat(d.value.toFixed(2)) }));

      if (data.length === 0) { this._setChartOverlay(container, 'error', 'No chart data available for this range'); return; }

      const isUp = data[data.length - 1].value >= data[0].value;
      this._stockSeries.applyOptions({
        lineColor: isUp ? '#3ED68C' : '#F0525D',
        topColor: isUp ? 'rgba(62,214,140,0.18)' : 'rgba(240,82,93,0.15)',
        bottomColor: 'rgba(0,0,0,0)',
      });
      this._stockSeries.setData(data);
      this._stockChart.timeScale().fitContent();
      this._setChartOverlay(container, 'ready'); // success — remove the loading overlay, chart is now visible
    } catch (_) {
      this._setChartOverlay(container, 'error', 'Something went wrong rendering this chart');
    }
  },

  renderSparklines(items, idPrefix = 'spark-') {
    items.forEach(item => {
      const el = Utils.el(idPrefix + item.id);
      if (!el) return;
      const p = StockAPI.getPrice(item.symbol, item.exchange || 'NSE');
      if (!p) return;
      const prev = p.prevClose || p.price;
      const step = (p.price - prev) / 7;
      const pts = Array.from({ length: 8 }, (_, i) => prev + step * i + (Math.random() - 0.5) * step * 0.3);
      pts[pts.length - 1] = p.price;
      el.innerHTML = Utils.sparkline(pts, p.changePct >= 0 ? '#3ED68C' : '#F0525D', 56, 26);
    });
  },

  // ─── Mutual fund NAV chart (detail sheet) ───
  _mfChart: null,
  _mfSeries: null,

  initMfChart() {
    const container = Utils.el('mf-chart-container');
    if (!container) return;
    if (this._mfChart) { this._mfChart.remove(); this._mfChart = null; this._mfSeries = null; }
    container.innerHTML = '';
    container.style.position = 'relative';

    try {
      this._mfChart = LightweightCharts.createChart(container, {
        width: container.clientWidth || 320, height: 175,
        layout: { background: { color: 'transparent' }, textColor: '#A39C90', fontFamily: 'JetBrains Mono, monospace' },
        grid: { vertLines: { color: 'rgba(255,250,240,0.04)' }, horzLines: { color: 'rgba(255,250,240,0.04)' } },
        crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
        rightPriceScale: { borderColor: 'rgba(255,250,240,0.08)' },
        timeScale: { borderColor: 'rgba(255,250,240,0.08)', timeVisible: false, secondsVisible: false },
        handleScroll: { mouseWheel: false }, handleScale: { mouseWheel: false },
      });
      this._mfSeries = this._mfChart.addAreaSeries({
        lineColor: '#3ED68C', topColor: 'rgba(62,214,140,0.18)', bottomColor: 'rgba(62,214,140,0.0)',
        lineWidth: 2, crosshairMarkerVisible: true, crosshairMarkerRadius: 4,
        priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
      });
      this._setChartOverlay(container, 'loading');
    } catch (e) {
      this._setChartOverlay(container, 'error', 'Chart unavailable on this device');
    }
  },

  async loadMfChart(schemeCode) {
    const container = Utils.el('mf-chart-container');
    if (!this._mfSeries || !container) return;
    this._setChartOverlay(container, 'loading');

    const scheme = await MfAPI.fetchScheme(schemeCode);
    if (!scheme || !scheme.history || scheme.history.length === 0) {
      this._setChartOverlay(container, 'error', "Couldn't load NAV history — check your connection");
      return;
    }

    try {
      // MFapi.in gives daily NAVs newest-first, often years of history — take the
      // most recent ~180 points (roughly 6 months) so the chart stays readable.
      const recent = scheme.history.slice(0, 180).slice().reverse();
      const seen = new Set();
      const data = recent.map(d => {
        const dt = Utils.parseDDMMYYYY(d.date);
        return dt ? { time: Math.floor(dt.getTime() / 1000), value: parseFloat(d.nav) } : null;
      }).filter(d => d && !isNaN(d.value))
        .filter(d => { if (seen.has(d.time)) return false; seen.add(d.time); return true; })
        .sort((a, b) => a.time - b.time);

      if (data.length === 0) { this._setChartOverlay(container, 'error', 'No NAV history available'); return; }

      const isUp = data[data.length - 1].value >= data[0].value;
      this._mfSeries.applyOptions({
        lineColor: isUp ? '#3ED68C' : '#F0525D',
        topColor: isUp ? 'rgba(62,214,140,0.18)' : 'rgba(240,82,93,0.15)',
        bottomColor: 'rgba(0,0,0,0)',
      });
      this._mfSeries.setData(data);
      this._mfChart.timeScale().fitContent();
      this._setChartOverlay(container, 'ready');
    } catch (_) {
      this._setChartOverlay(container, 'error', 'Something went wrong rendering this chart');
    }
  },

  // ─── Mutual fund category allocation donut ───
  _mfCategoryChart: null,

  refreshMfCategoryChart() {
    const ctx = Utils.el('mfan-category-chart');
    if (!ctx) return;
    if (this._mfCategoryChart) { this._mfCategoryChart.destroy(); this._mfCategoryChart = null; }
    const data = MutualFunds.getCategoryBreakdown();
    if (!data || data.length === 0) return;

    this._mfCategoryChart = new Chart(ctx, {
      type: 'doughnut',
      data: { labels: data.map(d => d.group), datasets: [{ data: data.map(d => d.pct), backgroundColor: data.map(d => MfAPI.categoryColor(d.group)), borderWidth: 0, hoverOffset: 6 }] },
      options: {
        responsive: true, cutout: '60%',
        plugins: {
          legend: { display: true, position: 'right', labels: { color: '#A39C90', font: { size: 11, family: 'Inter' }, boxWidth: 10, padding: 12 } },
          tooltip: { backgroundColor: 'rgba(22,19,15,0.96)', borderColor: 'rgba(255,250,240,0.1)', borderWidth: 1, callbacks: { label: c => `  ${c.label}: ${c.parsed.toFixed(1)}%` } },
        },
      },
    });
  },
};
