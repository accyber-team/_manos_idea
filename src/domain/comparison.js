// Comparativo entre anos por período (mês, trimestre, semestre, ano) e quebras por torre/parceiro/responsável.
import { buildBuckets } from './periods.js';
import { summarize, periodDeals } from './metrics.js';
import { STATUSES } from './status.js';
import { TORRE_LABELS } from './normalize.js';

/**
 * @typedef {{granularity:'month'|'quarter'|'semester'|'year', method:'flow'|'snapshots', years:[number,number], throughMonth:number}} CompareOptions
 */

function yearSummary(deals, snapshots, year, months, method) {
  const has = snapshots.some((s) => s.year === year && months.includes(s.month));
  if (!has) return null;
  return summarize(periodDeals(deals.filter((d) => d.year === year && months.includes(d.month)), method));
}

function delta(a, b) {
  if (!a || !b) return null;
  const pp = Object.fromEntries(STATUSES.map((s) => [s, a[s].pct == null || b[s].pct == null ? null : b[s].pct - a[s].pct]));
  return {
    wonCents: b.won.cents - a.won.cents,
    wonGrowth: a.won.cents > 0 ? (b.won.cents - a.won.cents) / a.won.cents : null,
    forecastGrowth: a.totalCents > 0 ? (b.totalCents - a.totalCents) / a.totalCents : null,
    pp,
  };
}

function row(deals, snapshots, bucket, years, method, extra = {}) {
  const byYear = Object.fromEntries(years.map((y) => [y, yearSummary(deals, snapshots, y, bucket.months, method)]));
  const notes = snapshots.filter((s) => s.note && years.includes(s.year) && bucket.months.includes(s.month)).map((s) => s.note);
  return { ...bucket, ...extra, byYear, delta: delta(byYear[years[0]], byYear[years[1]]), notes };
}

/** @param {CompareOptions} opts */
export function compareYears(deals, snapshots, { granularity, method, years, throughMonth }) {
  const buckets = buildBuckets(granularity, snapshots.map((s) => s.months))
    .map((b) => row(deals, snapshots, b, years, method, { beyondLimit: b.months.some((m) => m > throughMonth) }))
    .filter((b) => years.some((y) => b.byYear[y]));
  const months = Array.from({ length: throughMonth }, (_, i) => i + 1);
  const total = row(deals, snapshots, { key: 'total', label: 'Acumulado comparável', months }, years, method);
  return { granularity, method, years, throughMonth, buckets, total };
}

const DIMENSIONS = {
  torre: { get: (d) => d.torre, label: (k) => TORRE_LABELS[k] ?? k },
  partner: { get: (d) => d.partner || '(sem parceiro)', label: (k) => k },
  owner: { get: (d) => d.owner, label: (k) => k },
};

/** Quebra do acumulado comparável por uma dimensão, com os dois anos lado a lado. */
export function breakdown(deals, snapshots, { dimension, method, years, throughMonth, limit = 0 }) {
  const dim = DIMENSIONS[dimension];
  if (!dim) throw new Error(`Dimensão inválida: ${dimension}`);
  const inRange = (d) => years.includes(d.year) && d.month <= throughMonth;
  const perYear = Object.fromEntries(years.map((y) => [y, periodDeals(deals.filter((d) => d.year === y && inRange(d)), method)]));
  const keys = new Set(Object.values(perYear).flat().map(dim.get));
  const summaries = (pred) => Object.fromEntries(years.map((y) => [y, summarize(perYear[y].filter(pred))]));
  let rows = [...keys].map((k) => ({ key: k, label: dim.label(k), byYear: summaries((d) => dim.get(d) === k) }));
  const wonOf = (r) => years.reduce((s, y) => s + r.byYear[y].won.cents, 0);
  const totalOf = (r) => years.reduce((s, y) => s + r.byYear[y].totalCents, 0);
  rows.sort((a, b) => wonOf(b) - wonOf(a) || totalOf(b) - totalOf(a) || a.label.localeCompare(b.label));
  if (limit > 0 && rows.length > limit) {
    const top = new Set(rows.slice(0, limit).map((r) => r.key));
    rows = [...rows.slice(0, limit), { key: '__outros', label: 'Outros', byYear: summaries((d) => !top.has(dim.get(d))) }];
  }
  return rows.map((r) => ({ ...r, delta: delta(r.byYear[years[0]], r.byYear[years[1]]) }));
}
