const Lynch = {

  /**
   * Peter Lynch's Fair Value check, from "One Up On Wall Street":
   *
   *   Result = (Future EPS Growth % + Dividend Yield %) / P/E Ratio
   *
   *   < 1.0        → Overvalued
   *   1.0 – 1.5    → Fairly valued
   *   > 1.5        → Undervalued
   *
   *   Fair price = Current price × Result   (rough "what it should cost" line)
   */
  calc({ epsGrowthPct, dividendYieldPct, pe, currentPrice }) {
    if (epsGrowthPct == null || !pe || pe <= 0) return null;

    const result = (epsGrowthPct + (dividendYieldPct || 0)) / pe;
    let verdict, verdictClass;
    if (result < 1) { verdict = 'Overvalued'; verdictClass = 'over'; }
    else if (result <= 1.5) { verdict = 'Fairly Valued'; verdictClass = 'fair'; }
    else { verdict = 'Undervalued'; verdictClass = 'under'; }

    const fairPrice = currentPrice != null ? currentPrice * result : null;

    // Needle position on a 0 → 2.0+ gauge (clamped)
    const clamped = Math.max(0, Math.min(result, 2));
    const needlePct = (clamped / 2) * 100;

    return { result, verdict, verdictClass, fairPrice, needlePct, epsGrowthPct, dividendYieldPct: dividendYieldPct || 0, pe };
  },

  async renderForStock(symbol, exchange, currentPrice) {
    const container = Utils.el('lynch-container');
    if (!container) return;

    container.innerHTML = `
      <div class="lynch-card">
        <div class="lynch-hdr"><i class="ti ti-scale"></i><span>Fair Value Check</span></div>
        <div class="lynch-sub">Fetching fundamentals…</div>
        <div class="skeleton" style="height:60px;border-radius:10px;"></div>
      </div>`;

    const fund = await StockAPI.fetchFundamentals(symbol, exchange);

    if (!fund || fund.epsGrowthPct == null || !fund.trailingPE) {
      container.innerHTML = `
        <div class="lynch-card">
          <div class="lynch-hdr"><i class="ti ti-scale"></i><span>Fair Value Check</span><i class="ti ti-info-circle lynch-info-btn" id="lynch-info-trigger"></i></div>
          <div class="lynch-unavailable">
            <i class="ti ti-chart-line" style="font-size:26px;color:var(--t3);display:block;margin-bottom:8px;"></i>
            Not enough analyst data available for ${symbol} right now to run this check. This is common for smaller or recently-listed companies.
          </div>
        </div>`;
      this._bindInfoTrigger();
      return;
    }

    const r = this.calc({
      epsGrowthPct: fund.epsGrowthPct,
      dividendYieldPct: fund.dividendYieldPct,
      pe: fund.trailingPE,
      currentPrice,
    });

    if (!r) {
      container.innerHTML = `<div class="lynch-card"><div class="lynch-unavailable">Couldn't compute a valuation for ${symbol} — missing P/E data.</div></div>`;
      return;
    }

    container.innerHTML = `
      <div class="lynch-card">
        <div class="lynch-hdr">
          <i class="ti ti-scale"></i><span>Fair Value Check</span>
          <i class="ti ti-info-circle lynch-info-btn" id="lynch-info-trigger"></i>
        </div>
        <div class="lynch-sub">Peter Lynch's method, from One Up On Wall Street</div>

        <div class="lynch-verdict-badge ${r.verdictClass}">
          <i class="ti ti-${r.verdictClass === 'over' ? 'trending-down' : r.verdictClass === 'under' ? 'trending-up' : 'minus'}"></i>
          ${r.verdict}
        </div>

        <div class="lynch-gauge">
          <div class="lynch-gauge-track">
            <div class="lynch-gauge-needle" style="left:calc(${r.needlePct}% - 1.5px);"></div>
          </div>
          <div class="lynch-gauge-labels"><span>Overvalued</span><span>Fair</span><span>Undervalued</span></div>
        </div>

        <div class="lynch-formula">
          <div class="lynch-formula-row"><span class="lynch-formula-label">Future EPS growth</span><span class="lynch-formula-val">${r.epsGrowthPct.toFixed(2)}%</span></div>
          <div class="lynch-formula-row"><span class="lynch-formula-label">Dividend yield</span><span class="lynch-formula-val">${r.dividendYieldPct.toFixed(2)}%</span></div>
          <div class="lynch-formula-row"><span class="lynch-formula-label">P/E ratio</span><span class="lynch-formula-val">${r.pe.toFixed(2)}</span></div>
          <div class="lynch-formula-row result"><span class="lynch-formula-label">Result</span><span class="lynch-formula-val">${r.result.toFixed(2)}</span></div>
        </div>

        ${r.fairPrice != null ? `
        <div class="lynch-fair-price">
          <div class="lynch-fair-price-lbl">Rough fair price</div>
          <div class="lynch-fair-price-val">${Utils.fmtCurrencyFull(r.fairPrice)}</div>
        </div>` : ''}
      </div>`;

    this._bindInfoTrigger();
  },

  _bindInfoTrigger() {
    Utils.el('lynch-info-trigger')?.addEventListener('click', () => App.openModal('modal-lynch-info'));
  },
};
