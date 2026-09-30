// Comparativo: vendido por período (colunas por ano) e composição do forecast por status (100% empilhado).
(function (C) {
  var d = C.data('dashboard-data');
  if (!d) return;
  var years = d.years;
  var labels = d.buckets.map(function (b) { return b.label + (b.beyondLimit ? ' *' : ''); });

  C.make('chart-won', {
    tooltip: { valueFormatter: function (v) { return v == null ? '—' : C.compact(v * 100); } },
    xAxis: { data: labels },
    yAxis: { axisLabel: { formatter: function (v) { return C.compact(v * 100); } } },
    series: years.map(function (y, i) {
      return {
        name: String(y), type: 'bar', barGap: '10%', barMaxWidth: 36, itemStyle: { color: C.COLORS.years[i] }, emphasis: { focus: 'series' },
        data: d.buckets.map(function (b) { var s = b.byYear[y]; return s ? s.won.cents / 100 : null; }),
        label: { show: d.buckets.length <= 6, position: 'top', color: C.COLORS.muted, fontSize: 11, formatter: function (p) { return p.value == null ? '' : C.compact(p.value * 100); } },
      };
    }),
  });

  // Uma categoria por (período, ano) para que a barra empilhada identifique o ano no rótulo, não só pela cor.
  var cats = [], cells = [];
  d.buckets.forEach(function (b) {
    years.forEach(function (y) { cats.push(b.label + ' ' + String(y).slice(2)); cells.push(b.byYear[y]); });
  });
  var statuses = ['won', 'delayed', 'lost', 'open'];
  C.make('chart-mix', {
    tooltip: { valueFormatter: function (v) { return v == null ? '—' : C.pct(v / 100); } },
    xAxis: { data: cats, axisLabel: { interval: 0, rotate: cats.length > 12 ? 45 : 0, fontSize: 11 } },
    yAxis: { max: 100, axisLabel: { formatter: '{value}%' } },
    series: statuses.map(function (s) {
      return {
        name: C.STATUS_LABEL[s], type: 'bar', stack: 'mix', barMaxWidth: 28, barCategoryGap: '35%',
        itemStyle: { color: C.COLORS.status[s], borderColor: '#fff', borderWidth: 1 },
        emphasis: { focus: 'series' },
        data: cells.map(function (c) { return c && c[s].pct != null ? Math.round(c[s].pct * 1000) / 10 : null; }),
      };
    }),
  });
})(window.Charts);
