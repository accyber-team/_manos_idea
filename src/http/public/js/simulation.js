// Simulação: vendido acumulado (realizado × projeção com faixa P10–P90) e histograma dos totais simulados.
(function (C) {
  var d = C.data('simulation-data');
  if (!d) return;
  var MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  var ya = d.years[0], yb = d.years[1];
  var toUsd = function (c) { return c == null ? null : Math.round(c) / 100; };

  // Série realizada até o mês da aba mais recente; projeção começa no último ponto realizado.
  var realized = d.realizedByMonth.map(function (v, i) { return i + 1 <= d.latestMonth ? toUsd(v) : null; });
  var p10 = new Array(12).fill(null), p50 = new Array(12).fill(null), p90 = new Array(12).fill(null);
  var anchor = d.latestMonth - (d.current ? 1 : 0); // mês (1-12) do último realizado que fecha a projeção
  if (anchor >= 1 && anchor <= 12) { var a = toUsd(d.realizedByMonth[anchor - 1]); p10[anchor - 1] = a; p50[anchor - 1] = a; p90[anchor - 1] = a; }
  d.stepMonths.forEach(function (m, i) {
    var f = d.fan[i]; if (!f) return;
    p10[m - 1] = toUsd(f.p10); p50[m - 1] = toUsd(f.p50); p90[m - 1] = toUsd(f.p90);
  });
  var band = p90.map(function (v, i) { return v == null || p10[i] == null ? null : v - p10[i]; });

  C.make('chart-fan', {
    tooltip: { trigger: 'axis', axisPointer: { type: 'line' }, valueFormatter: function (v) { return v == null ? '—' : C.compact(v * 100); } },
    legend: { data: [String(ya), String(yb) + ' realizado', String(yb) + ' P50', 'Faixa P10–P90'] },
    xAxis: { data: MONTHS, boundaryGap: false },
    yAxis: { axisLabel: { formatter: function (v) { return C.compact(v * 100); } } },
    series: [
      { name: String(ya), type: 'line', data: d.baselineByMonth.map(toUsd), showSymbol: false, lineStyle: { width: 2, color: C.COLORS.years[0] }, itemStyle: { color: C.COLORS.years[0] } },
      { name: String(yb) + ' realizado', type: 'line', data: realized, symbolSize: 8, lineStyle: { width: 2, color: C.COLORS.years[1] }, itemStyle: { color: C.COLORS.years[1] } },
      { name: 'P10', type: 'line', data: p10, stack: 'band', showSymbol: false, lineStyle: { opacity: 0 }, tooltip: { show: false } },
      { name: 'Faixa P10–P90', type: 'line', data: band, stack: 'band', showSymbol: false, lineStyle: { opacity: 0 },
        areaStyle: { color: C.COLORS.years[1], opacity: 0.15 }, itemStyle: { color: C.COLORS.years[1], opacity: 0.3 },
        tooltip: { valueFormatter: function (v, idx) { return v == null ? '—' : C.compact(p10[idx] * 100) + ' – ' + C.compact(p90[idx] * 100); } } },
      { name: String(yb) + ' P50', type: 'line', data: p50, showSymbol: false, lineStyle: { width: 2, type: 'dashed', color: C.COLORS.years[1] }, itemStyle: { color: C.COLORS.years[1] } },
    ],
  });

  var bins = d.histogram;
  var marks = [];
  var binIndex = function (cents) {
    for (var i = 0; i < bins.length; i++) if (cents >= bins[i].from && (cents < bins[i].to || i === bins.length - 1)) return i;
    return cents < bins[0].from ? 0 : bins.length - 1;
  };
  marks.push({ xAxis: binIndex(d.baselineCents), name: 'Total ' + ya, lineStyle: { color: C.COLORS.years[0] }, label: { formatter: 'Total ' + ya, color: C.COLORS.years[0] } });
  if (d.targetCents) marks.push({ xAxis: binIndex(d.targetCents), name: 'Meta', lineStyle: { color: C.COLORS.text }, label: { formatter: 'Meta', color: C.COLORS.text } });

  C.make('chart-hist', {
    legend: { show: false },
    tooltip: { formatter: function (ps) { var p = ps[0]; var b = bins[p.dataIndex]; return C.compact(b.from) + ' – ' + C.compact(b.to) + '<br>' + p.value + ' cenário(s)'; } },
    xAxis: { data: bins.map(function (b) { return C.compact(b.from); }), axisLabel: { interval: Math.ceil(bins.length / 6) - 1, fontSize: 11 } },
    yAxis: { axisLabel: { formatter: '{value}' } },
    series: [{ name: 'Cenários', type: 'bar', barCategoryGap: '15%', itemStyle: { color: C.COLORS.years[1], borderRadius: [3, 3, 0, 0] },
      data: bins.map(function (b) { return b.count; }),
      markLine: { symbol: 'none', silent: true, lineStyle: { type: 'dashed', width: 2 }, label: { position: 'insideEndTop', fontSize: 11 }, data: marks } }],
  });
})(window.Charts);
