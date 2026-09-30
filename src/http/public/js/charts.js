// Utilidades ECharts compartilhadas: paleta (anos e status), formatação e montagem com redimensionamento.
window.Charts = (function () {
  var COLORS = {
    years: ['#c26a1b', '#1f6fd0'],
    status: { won: '#0ca30c', delayed: '#fab219', lost: '#d03b3b', open: '#9aa0a6' },
    text: '#374151', muted: '#6b7280', grid: '#e5e7eb',
  };
  var STATUS_LABEL = { won: 'Vendido', delayed: 'DPD', lost: 'Perdido', open: 'Aberto' };
  var NUM = function (d) { return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }); };

  function compact(cents) {
    var v = Math.abs(cents) / 100, sign = cents < 0 ? '-' : '';
    if (v >= 1e6) return sign + 'US$ ' + NUM(2).format(v / 1e6) + ' mi';
    if (v >= 1e3) return sign + 'US$ ' + NUM(1).format(v / 1e3) + ' mil';
    return sign + 'US$ ' + NUM(0).format(v);
  }
  function money(cents) { return 'US$ ' + NUM(2).format(cents / 100); }
  function pct(x, d) { return x == null ? '—' : NUM(d == null ? 1 : d).format(x * 100) + '%'; }

  var base = {
    textStyle: { fontFamily: 'Lato, "Helvetica Neue", Arial, sans-serif', color: COLORS.text },
    grid: { left: 8, right: 16, top: 36, bottom: 8, containLabel: true },
    legend: { top: 0, left: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 8, textStyle: { color: COLORS.muted } },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, backgroundColor: '#fff', borderColor: COLORS.grid, textStyle: { color: COLORS.text } },
    xAxis: { type: 'category', axisLine: { lineStyle: { color: COLORS.grid } }, axisTick: { show: false }, axisLabel: { color: COLORS.muted } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: COLORS.grid } }, axisLabel: { color: COLORS.muted } },
  };

  function merge(a, b) {
    var out = {};
    Object.keys(a).forEach(function (k) { out[k] = a[k]; });
    Object.keys(b).forEach(function (k) {
      out[k] = (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) ? merge(a[k], b[k]) : b[k];
    });
    return out;
  }

  function make(id, option) {
    var el = document.getElementById(id);
    if (!el || !window.echarts) return null;
    var chart = window.echarts.init(el, null, { renderer: 'canvas' });
    chart.setOption(merge(base, option));
    window.addEventListener('resize', function () { chart.resize(); });
    return chart;
  }

  function data(id) {
    var el = document.getElementById(id);
    return el ? JSON.parse(el.textContent) : null;
  }

  return { COLORS: COLORS, STATUS_LABEL: STATUS_LABEL, compact: compact, money: money, pct: pct, make: make, data: data };
})();
