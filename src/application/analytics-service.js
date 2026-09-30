// Casos de uso da análise gerencial. Ports injetados: store (base SQLite ou planilha → deals/snapshots/issues),
// writer (relatório XLSX), clock. Por compatibilidade, `source` + `reader` (planilha) montam um store XLSX.
// A fonte é relida automaticamente quando o arquivo muda (mtime) ou no recarregar.
import { z } from 'zod';
import { createWorkbookStore } from './workbook-store.js';
import { compareYears, breakdown } from '../domain/comparison.js';
import { summarize, periodDeals, METHODS } from '../domain/metrics.js';
import { transitionStats, pendingPipeline } from '../domain/flow.js';
import { simulate } from '../domain/simulation.js';
import { GRANULARITIES, monthLabel } from '../domain/periods.js';
import { STATUSES } from '../domain/status.js';
import { ValidationError } from './errors.js';

const monthIndex = (y, m) => y * 12 + m;

function parse(schema, input) {
  const r = schema.safeParse(input ?? {});
  if (!r.success) throw new ValidationError(r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  return r.data;
}

const optionalInt = (min, max) => z.preprocess((v) => (v === '' || v == null ? undefined : v), z.coerce.number().int().min(min).max(max).optional());
const optionalStr = z.preprocess((v) => (v === '' || v == null ? undefined : v), z.string().optional());

const compareSchema = z.object({
  granularity: z.enum(Object.keys(GRANULARITIES)).default('month'),
  method: z.enum(Object.keys(METHODS)).default('flow'),
  through: optionalInt(1, 12),
});

const dealsSchema = z.object({
  year: optionalInt(2000, 2100), month: optionalInt(1, 12),
  status: z.preprocess((v) => (v === '' ? undefined : v), z.enum(STATUSES).optional()),
  torre: optionalStr, partner: optionalStr, owner: optionalStr, q: optionalStr,
});

const simSchema = z.object({
  runs: optionalInt(100, 50000),
  seed: optionalInt(0, 2 ** 31 - 1),
  target: z.preprocess((v) => (v === '' || v == null ? undefined : v), z.coerce.number().positive().optional()),
  history: z.preprocess((v) => (v === '' || v == null ? undefined : v), z.string().regex(/^(all|\d{4})$/).default('all')),
});

/**
 * @typedef {{kind:string, location:string, describe():{path:string,name:string,mtimeMs:number},
 *   load():Promise<{deals:object[], snapshots:object[], issues:object[], imported?:object|null}>}} Store
 * @param {{store?:Store, source?:object, reader?:object, writer?:{write(report:object):Promise<Buffer>},
 *   config:object, clock:{now():Date}}} deps
 */
export function createAnalyticsService({ store, source, reader, writer, config, clock }) {
  store ??= createWorkbookStore({ source, reader, config });
  const [yearA, yearB] = config.compareYears;
  let cache = null;

  async function dataset({ force = false } = {}) {
    const file = store.describe();
    if (!force && cache && cache.file.path === file.path && cache.file.mtimeMs === file.mtimeMs) return cache;
    const { deals, snapshots, issues, imported = null } = await store.load();
    cache = { file: { ...file }, loadedAt: clock.now().toISOString(), deals, snapshots, issues, imported };
    return cache;
  }

  const now = () => {
    const d = clock.now();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  };

  /** Último mês fechado do ano mais recente: aba já decidida e não futura. */
  function defaultThrough(snapshots) {
    const t = now();
    const ok = snapshots.filter((s) => s.year === yearB && s.decided && monthIndex(s.year, s.month) <= monthIndex(t.year, t.month));
    return ok.length ? Math.max(...ok.map((s) => s.month)) : 12;
  }

  function snapshotInfo(s) {
    const t = now();
    return { ...s, label: `${s.months.length > 1 ? `${monthLabel(s.months[0])}–` : ''}${monthLabel(s.month)}/${String(s.year).slice(2)}`,
      inProgress: !s.decided || monthIndex(s.year, s.month) > monthIndex(t.year, t.month) };
  }

  async function overview() {
    const ds = await dataset();
    const levels = { error: 0, warning: 0, info: 0 };
    for (const i of ds.issues) levels[i.level]++;
    return {
      source: { kind: store.kind, ...ds.file, location: store.location, imported: ds.imported }, loadedAt: ds.loadedAt, years: [yearA, yearB],
      snapshots: ds.snapshots.map(snapshotInfo), dealCount: ds.deals.length, issueCounts: levels,
      defaultThrough: defaultThrough(ds.snapshots),
    };
  }

  async function comparison(input) {
    const p = parse(compareSchema, input);
    const ds = await dataset();
    const throughMonth = p.through ?? defaultThrough(ds.snapshots);
    return compareYears(ds.deals, ds.snapshots, { granularity: p.granularity, method: p.method, years: [yearA, yearB], throughMonth });
  }

  async function breakdowns(input) {
    const p = parse(compareSchema, input);
    const ds = await dataset();
    const opts = { method: p.method, years: [yearA, yearB], throughMonth: p.through ?? defaultThrough(ds.snapshots) };
    return {
      ...opts,
      torre: breakdown(ds.deals, ds.snapshots, { ...opts, dimension: 'torre' }),
      partner: breakdown(ds.deals, ds.snapshots, { ...opts, dimension: 'partner', limit: 10 }),
      owner: breakdown(ds.deals, ds.snapshots, { ...opts, dimension: 'owner', limit: 10 }),
    };
  }

  async function deals(input) {
    const f = parse(dealsSchema, input);
    const ds = await dataset();
    const q = f.q?.toUpperCase();
    const list = ds.deals.filter((d) => (!f.year || d.year === f.year) && (!f.month || d.months.includes(f.month))
      && (!f.status || d.status === f.status) && (!f.torre || d.torre === f.torre)
      && (!f.partner || d.partner === f.partner) && (!f.owner || d.owner === f.owner)
      && (!q || d.company.includes(q) || d.partner.includes(q) || d.owner.includes(q)))
      .sort((a, b) => monthIndex(b.year, b.month) - monthIndex(a.year, a.month) || b.valueCents - a.valueCents);
    const uniq = (k) => [...new Set(ds.deals.map((d) => d[k]))].sort();
    return { filter: f, deals: list, summary: summarize(list), options: { partners: uniq('partner'), owners: uniq('owner') } };
  }

  async function simulation(input) {
    const p = parse(simSchema, input);
    const ds = await dataset();
    const yearSnaps = ds.snapshots.filter((s) => s.year === yearB);
    if (!yearSnaps.length) throw new ValidationError([{ path: 'year', message: `Sem abas de ${yearB}` }], `Sem abas de ${yearB} para simular`);
    const latest = yearSnaps.at(-1);
    const t = now();
    const current = monthIndex(latest.year, latest.month) >= monthIndex(t.year, t.month) || !latest.decided;
    const steps = 12 - latest.month + (current ? 1 : 0);
    if (steps < 1) throw new ValidationError([{ path: 'steps', message: 'Ano encerrado' }], `Não há meses de ${yearB} a simular`);

    const histYears = p.history === 'all' ? [yearA, yearB] : [Number(p.history)];
    const histDeals = ds.deals.filter((d) => histYears.includes(d.year));
    const stats = transitionStats(histDeals, ds.snapshots.filter((s) => histYears.includes(s.year)));
    const pipeline = pendingPipeline(ds.deals, ds.snapshots, latest.sheet);
    const realizedCents = summarize(periodDeals(ds.deals.filter((d) => d.year === yearB), 'flow')).won.cents;
    const wonByMonth = (year) => Array.from({ length: 12 }, (_, i) =>
      ds.deals.filter((d) => d.year === year && d.status === 'won' && d.month === i + 1).reduce((s, d) => s + d.valueCents, 0));
    const cumulative = (arr) => arr.reduce((acc, v) => [...acc, (acc.at(-1) ?? 0) + v], []);
    const baselineByMonth = cumulative(wonByMonth(yearA));
    const realizedByMonth = cumulative(wonByMonth(yearB));
    const firstMonth = current ? latest.month : latest.month + 1;
    const runs = p.runs ?? config.simulation.runs;
    const seed = p.seed ?? config.simulation.seed;
    const targetCents = p.target ? Math.round(p.target * 100) : null;

    const result = simulate({
      pipeline, stats, newWonSamples: stats.newWonByMonth.map((x) => x.cents), steps, firstStepIsCurrent: current,
      realizedCents, baselineCents: baselineByMonth[11], targetCents, runs, seed,
    });
    return {
      params: { runs, seed, target: p.target ?? null, history: p.history },
      years: [yearA, yearB], latest: snapshotInfo(latest), current,
      stepMonths: Array.from({ length: steps }, (_, i) => firstMonth + i),
      realizedCents, realizedByMonth, baselineCents: baselineByMonth[11], baselineByMonth,
      pipeline: { count: pipeline.length, cents: pipeline.reduce((s, d) => s + d.valueCents, 0),
        carried: pipeline.filter((d) => d.carried).length, deals: pipeline },
      stats: { ...stats, historyYears: histYears }, result,
    };
  }

  async function issues() {
    const ds = await dataset();
    return ds.issues;
  }

  async function exportWorkbook(input) {
    if (!writer) throw new Error('Exportação indisponível');
    const [ov, cmp, brk, sim, all] = await Promise.all([overview(), comparison(input), breakdowns(input),
      simulation({}).catch(() => null), deals({})]);
    return writer.write({ overview: ov, comparison: cmp, breakdowns: brk, simulation: sim, deals: all.deals, issues: await issues() });
  }

  return { overview, comparison, breakdowns, deals, simulation, issues, exportWorkbook,
    reload: () => dataset({ force: true }).then(() => overview()) };
}
