const Utils = {

  // ── Privacy mode (Groww/Dhan-style "eye" toggle) — hides rupee amounts,
  // leaves percentages visible since those don't reveal wealth scale.
  hideAmounts: localStorage.getItem('artha_hide_amounts') === 'true',
  togglePrivacy() {
    this.hideAmounts = !this.hideAmounts;
    localStorage.setItem('artha_hide_amounts', String(this.hideAmounts));
    return this.hideAmounts;
  },

  // ── Currency formatting ──
  fmtCurrency(n, decimals = 2) {
    if (this.hideAmounts) return '₹••••';
    if (n === null || n === undefined || isNaN(n)) return '₹–';
    const abs = Math.abs(n);
    let str;
    if (abs >= 1e7)      str = (n < 0 ? '-' : '') + '₹' + (abs / 1e7).toFixed(2) + ' Cr';
    else if (abs >= 1e5) str = (n < 0 ? '-' : '') + '₹' + (abs / 1e5).toFixed(2) + ' L';
    else                 str = (n < 0 ? '-₹' : '₹') + abs.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    return str;
  },

  fmtCurrencyFull(n) {
    if (this.hideAmounts) return '₹•••••';
    if (n === null || n === undefined || isNaN(n)) return '₹–';
    return (n < 0 ? '-₹' : '₹') + Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  fmtPctSigned(n) {
    if (n === null || n === undefined || isNaN(n)) return '–%';
    return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
  },

  fmtDate(dateStr) {
    if (!dateStr) return '–';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  },

  daysSince(dateStr) {
    if (!dateStr) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000));
  },

  daysLabel(days) {
    if (days === 0) return 'Today';
    if (days === 1) return '1 day';
    if (days < 30)  return days + ' days';
    if (days < 365) return Math.floor(days / 30) + ' months';
    const y = (days / 365).toFixed(1);
    return y + ' year' + (y === '1.0' ? '' : 's');
  },

  // Relative time for Inbox items ("2h ago", "3d ago")
  timeAgo(dateInput) {
    const d = typeof dateInput === 'number' ? new Date(dateInput) : new Date(dateInput);
    const diffMs = Date.now() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return mins + 'm ago';
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    const days = Math.floor(hrs / 24);
    if (days < 7) return days + 'd ago';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  },

  // MFapi.in dates come as "DD-MM-YYYY" — convert to a JS Date
  parseDDMMYYYY(str) {
    if (!str) return null;
    const [d, m, y] = str.split('-').map(Number);
    if (!d || !m || !y) return null;
    return new Date(y, m - 1, d);
  },

  // "HDFC Flexi Cap Fund - Direct Plan - Growth" -> "HDFC Flexi Cap Fund"
  // Full name still shown in the detail sheet; this is just for tight card rows.
  shortFundName(name) {
    if (!name) return '–';
    return name.split(' - ')[0].replace(/\s*\(.*?\)\s*$/, '').trim();
  },

  annualisedReturn(invested, current, days) {
    if (!invested || !days || days < 1) return 0;
    return (Math.pow(current / invested, 365 / days) - 1) * 100;
  },

  // ── SHA-256 (PIN hashing) ──
  async sha256(str) {
    const data = new TextEncoder().encode(str + PIN_SALT);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  },

  // ── DOM helpers ──
  el(id)   { return document.getElementById(id); },
  qs(sel)  { return document.querySelector(sel); },
  qsa(sel) { return document.querySelectorAll(sel); },
  setClass(el, cls, add) { if (typeof el === 'string') el = this.el(el); if (!el) return; add ? el.classList.add(cls) : el.classList.remove(cls); },
  setText(id, text) { const el = typeof id === 'string' ? this.el(id) : id; if (el) el.textContent = text; },

  // ── Sparkline SVG (watchlist rows + hero background) ──
  sparkline(data, color = null, width = 72, height = 32, strokeWidth = 1.8) {
    if (!data || data.length < 2) return `<svg width="${width}" height="${height}"></svg>`;
    const vals = data.filter(v => v !== null && !isNaN(v));
    if (vals.length < 2) return `<svg width="${width}" height="${height}"></svg>`;
    const min = Math.min(...vals), max = Math.max(...vals), range = max - min || 1;
    const pad = 2, w = width, h = height;
    const pts = vals.map((v, i) => {
      const x = pad + (i / (vals.length - 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / range) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const trend = color || (vals[vals.length - 1] >= vals[0] ? '#3ED68C' : '#F0525D');
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${pts}" fill="none" stroke="${trend}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  },

  // Full-width ambient area sparkline for the portfolio hero background
  ambientSparkline(data, isUp, width = 400, height = 140) {
    if (!data || data.length < 2) return '';
    const vals = data.filter(v => v !== null && !isNaN(v));
    if (vals.length < 2) return '';
    const min = Math.min(...vals), max = Math.max(...vals), range = max - min || 1;
    const w = width, h = height;
    const pts = vals.map((v, i) => {
      const x = (i / (vals.length - 1)) * w;
      const y = h - ((v - min) / range) * (h * 0.7) - h * 0.1;
      return [x, y];
    });
    const line = pts.map((p, i) => (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    const area = line + ` L${w},${h} L0,${h} Z`;
    const color = isUp ? '#3ED68C' : '#F0525D';
    const gradId = 'heroGrad' + (isUp ? 'Up' : 'Down');
    return `<svg width="100%" height="100%" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <defs><linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.2"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient></defs>
      <path d="${area}" fill="url(#${gradId})"/>
      <path d="${line}" fill="none" stroke="${color}" stroke-width="1.3" stroke-opacity="0.5"/>
    </svg>`;
  },

  sectorClass(sector) {
    const map = { 'Technology':'sec-tech','Finance':'sec-fin','Energy':'sec-energy','Auto':'sec-auto','Pharma':'sec-pharma','FMCG':'sec-fmcg','Metals':'sec-metals','Telecom':'sec-tech','Infrastructure':'sec-energy','Healthcare':'sec-pharma','Cement':'sec-metals','Chemicals':'sec-tech','Insurance':'sec-fin','Utilities':'sec-energy' };
    return map[sector] || 'sec-default';
  },

  // Muted earth-tone categorical palette — considered and harmonious rather
  // than saturated primaries, so a 10-slice donut still reads as one product.
  sectorColor(sector) {
    const map = {
      'Technology':'#9BADCF','Finance':'#E3A63E','Energy':'#E29679','Auto':'#B6A2BE',
      'Pharma':'#9EC2AC','FMCG':'#DAAABC','Metals':'#ABA49B','Telecom':'#8FA6B0',
      'Infrastructure':'#C2985F','Healthcare':'#8FBBA3','Cement':'#B0A797','Chemicals':'#A897B8',
      'Insurance':'#7FA8A0','Utilities':'#C4A46E','Real Estate':'#C08B76','Other':'#675F53',
    };
    return map[sector] || '#675F53';
  },

  initials(symbol) { return (symbol || '?').slice(0, 2).toUpperCase(); },

  flashPrice(el, up) {
    if (!el) return;
    el.classList.remove('flash-up', 'flash-down');
    void el.offsetWidth;
    el.classList.add(up ? 'flash-up' : 'flash-down');
  },

  toast(msg, type = 'info', dur = 3000) {
    const wrap = this.el('toasts');
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    const icons = { success: 'ti-check', error: 'ti-alert-circle', info: 'ti-info-circle' };
    t.innerHTML = `<i class="ti ${icons[type] || 'ti-info-circle'}"></i><span>${msg}</span>`;
    wrap.appendChild(t);
    setTimeout(() => { t.classList.add('leaving'); setTimeout(() => t.remove(), 300); }, dur);
  },

  showLoader() { this.setClass('load-overlay', 'show', true); },
  hideLoader() { this.setClass('load-overlay', 'show', false); },
  confirm(msg) { return window.confirm(msg); },

  exportCSV(rows, filename = 'artha-portfolio.csv') {
    const header = ['Symbol','Name','Exchange','Sector','Buy Price','Quantity','Buy Date','Invested','Current Price','Current Value','P&L','P&L %'];
    const lines = [header.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  },
};
