// Adapter exceljs: relatório gerencial em XLSX com percentuais coloridos por status
// (Vendido = verde, DPD = amarelo, Perdido/negado = vermelho, Em aberto = cinza).
import ExcelJS from 'exceljs';
import { STATUSES, STATUS_SHORT, STATUS_LABELS, STATUS_HEX } from '../../domain/status.js';
import { TORRE_LABELS } from '../../domain/normalize.js';
import { GRANULARITIES, monthLabel } from '../../domain/periods.js';
import { METHODS } from '../../domain/metrics.js';

const argb = (hex) => `FF${hex.slice(1).toUpperCase()}`;
const FILL = Object.fromEntries(STATUSES.map((s) => [s, { type: 'pattern', pattern: 'solid', fgColor: { argb: argb(STATUS_HEX[s]) } }]));
const INK = { won: 'FFFFFFFF', delayed: 'FF1A1A1A', lost: 'FFFFFFFF', open: 'FF1A1A1A' };
const HEAD = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF152C5B' } };
const USD = '"US$" #,##0.00';
const PCT = '0.0%';
const PP = '+0.0" p.p.";-0.0" p.p.";0.0" p.p."';

function header(ws, values) {
  const row = ws.addRow(values);
  row.eachCell((c) => { c.fill = HEAD; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.alignment = { vertical: 'middle', wrapText: true }; });
  row.height = 30;
  return row;
}

function statusCell(cell, status) {
  cell.fill = FILL[status];
  cell.font = { bold: true, color: { argb: INK[status] } };
}

function yearCols(summary) {
  if (!summary) return [null, null, ...STATUSES.map(() => null)];
  return [summary.totalCents / 100, summary.won.cents / 100, ...STATUSES.map((s) => summary[s].pct)];
}

function comparisonSheet(wb, cmp) {
  const ws = wb.addWorksheet('Comparativo', { views: [{ state: 'frozen', xSplit: 1, ySplit: 3 }] });
  const [a, b] = cmp.years;
  ws.addRow([`Comparativo ${a} × ${b} — ${GRANULARITIES[cmp.granularity]} · ${METHODS[cmp.method]} · acumulado até ${monthLabel(cmp.throughMonth)}`]).font = { bold: true, size: 13 };
  ws.addRow([]);
  const cols = (y) => [`${y} Forecast`, `${y} Vendido`, ...STATUSES.map((s) => `${y} % ${STATUS_SHORT[s]}`)];
  header(ws, ['Período', ...cols(a), ...cols(b), 'Δ Vendido %', ...STATUSES.map((s) => `Δ ${STATUS_SHORT[s]} (p.p.)`)]);
  for (const r of [...cmp.buckets, cmp.total]) {
    const row = ws.addRow([r.label + (r.beyondLimit ? ' *' : ''), ...yearCols(r.byYear[a]), ...yearCols(r.byYear[b]),
      r.delta?.wonGrowth ?? null, ...STATUSES.map((s) => r.delta?.pp[s] ?? null)]);
    if (r.key === 'total') row.font = { bold: true };
    [2, 8].forEach((start) => {
      row.getCell(start).numFmt = USD; row.getCell(start + 1).numFmt = USD;
      STATUSES.forEach((s, i) => {
        const c = row.getCell(start + 2 + i);
        c.numFmt = PCT;
        if (c.value != null) statusCell(c, s);
      });
    });
    row.getCell(14).numFmt = PCT;
    STATUSES.forEach((s, i) => { row.getCell(15 + i).numFmt = PP; });
  }
  ws.addRow([]);
  ws.addRow(['* período além do mês-limite do comparativo (dados parciais ou ainda sem o ano seguinte).']).font = { italic: true, color: { argb: 'FF666666' } };
  ws.addRow(['Legenda:', ...STATUSES.map((s) => STATUS_LABELS[s])]).eachCell((c, i) => { if (i > 1) statusCell(c, STATUSES[i - 2]); });
  ws.columns.forEach((c, i) => { c.width = i === 0 ? 24 : 14; });
}

function breakdownSheet(wb, title, rows, years) {
  const ws = wb.addWorksheet(title, { views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }] });
  const cols = (y) => [`${y} Forecast`, `${y} Vendido`, ...STATUSES.map((s) => `${y} % ${STATUS_SHORT[s]}`)];
  header(ws, [title, ...cols(years[0]), ...cols(years[1]), 'Δ Vendido %']);
  for (const r of rows) {
    const row = ws.addRow([r.label, ...yearCols(r.byYear[years[0]]), ...yearCols(r.byYear[years[1]]), r.delta?.wonGrowth ?? null]);
    [2, 8].forEach((start) => {
      row.getCell(start).numFmt = USD; row.getCell(start + 1).numFmt = USD;
      STATUSES.forEach((s, i) => { const c = row.getCell(start + 2 + i); c.numFmt = PCT; if (c.value != null) statusCell(c, s); });
    });
    row.getCell(14).numFmt = PCT;
  }
  ws.columns.forEach((c, i) => { c.width = i === 0 ? 30 : 14; });
}

function dealsSheet(wb, deals) {
  const ws = wb.addWorksheet('Oportunidades', { views: [{ state: 'frozen', ySplit: 1 }] });
  header(ws, ['Ano', 'Mês', 'Aba', 'Empresa', 'Torre', 'Parceiro', 'Responsável', 'Status', 'Valor (US$)', 'Moeda original', 'Valor original']);
  for (const d of deals) {
    const row = ws.addRow([d.year, monthLabel(d.month), d.sheet, d.company, TORRE_LABELS[d.torre], d.partner, d.owner,
      STATUS_LABELS[d.status], d.valueCents / 100, d.currency, d.originalCents / 100]);
    statusCell(row.getCell(8), d.status);
    row.getCell(9).numFmt = USD;
  }
  ws.autoFilter = { from: 'A1', to: 'K1' };
  ws.columns.forEach((c, i) => { c.width = [6, 6, 10, 34, 10, 18, 16, 22, 16, 10, 16][i]; });
}

function simulationSheet(wb, sim) {
  const ws = wb.addWorksheet('Simulação');
  const r = sim.result;
  const [a, b] = sim.years;
  const rows = [
    [`Simulação Monte Carlo — fechamento de ${b}`, null],
    ['Rodadas / semente', `${r.runs} / ${r.seed}`],
    [`Vendido realizado ${b}`, sim.realizedCents / 100],
    [`Vendido total ${a} (base)`, sim.baselineCents / 100],
    [`Pipeline pendente (${sim.latest.label})`, sim.pipeline.cents / 100],
    ['P10 (cenário pessimista)', r.p10 / 100], ['P50 (mediana)', r.p50 / 100], ['P90 (cenário otimista)', r.p90 / 100],
    [`Probabilidade de superar ${a}`, r.probBeatBaseline],
    ...(r.probTarget == null ? [] : [[`Probabilidade de atingir a meta (US$ ${sim.params.target})`, r.probTarget]]),
  ];
  for (const v of rows) {
    const row = ws.addRow(v);
    if (typeof v[1] === 'number') row.getCell(2).numFmt = v[0].startsWith('Probabilidade') ? PCT : USD;
  }
  ws.getRow(1).font = { bold: true, size: 13 };
  ws.getColumn(1).width = 46; ws.getColumn(2).width = 20;
}

function issuesSheet(wb, issues) {
  const ws = wb.addWorksheet('Qualidade dos dados');
  header(ws, ['Nível', 'Aba', 'Linha', 'Código', 'Mensagem']);
  for (const i of issues) ws.addRow([i.level, i.sheet, i.row ?? null, i.code, i.message]);
  ws.columns.forEach((c, i) => { c.width = [10, 12, 8, 20, 110][i]; });
}

export function createXlsxReportWriter() {
  return {
    async write({ overview, comparison, breakdowns, simulation, deals, issues }) {
      const wb = new ExcelJS.Workbook();
      wb.creator = 'Análise de Pipeline AC CyberPro';
      wb.created = new Date(overview.loadedAt);
      comparisonSheet(wb, comparison);
      breakdownSheet(wb, 'Torre', breakdowns.torre, comparison.years);
      breakdownSheet(wb, 'Parceiro', breakdowns.partner, comparison.years);
      breakdownSheet(wb, 'Responsável', breakdowns.owner, comparison.years);
      if (simulation) simulationSheet(wb, simulation);
      dealsSheet(wb, deals);
      issuesSheet(wb, issues);
      return Buffer.from(await wb.xlsx.writeBuffer());
    },
  };
}
