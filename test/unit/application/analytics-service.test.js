import { describe, it, expect, beforeEach } from 'vitest';
import { createAnalyticsService } from '../../../src/application/analytics-service.js';
import { ValidationError } from '../../../src/application/errors.js';
import { rawSheets, CONFIG } from '../../fixtures/raw-sheets.js';

const config = { ...CONFIG, compareYears: [2025, 2026], simulation: { runs: 500, seed: 1 } };

function makeService({ mtimeMs = 1, now = '2026-03-31T12:00:00Z' } = {}) {
  const file = { path: '/x/pipeline.xlsx', name: 'pipeline.xlsx', mtimeMs };
  const reads = [];
  const source = { location: '/x', current: () => file };
  const reader = { read: async (p) => { reads.push(p); return rawSheets(); } };
  const writer = { write: async (report) => Buffer.from(JSON.stringify(Object.keys(report))) };
  const svc = createAnalyticsService({ source, reader, writer, config, clock: { now: () => new Date(now) } });
  return { svc, reads, file };
}

describe('AnalyticsService', () => {
  let ctx;
  beforeEach(() => { ctx = makeService(); });

  it('overview: abas, pendências e mês-limite padrão (último mês decidido de 2026)', async () => {
    const ov = await ctx.svc.overview();
    expect(ov.years).toEqual([2025, 2026]);
    expect(ov.defaultThrough).toBe(3);
    expect(ov.snapshots.at(-1)).toMatchObject({ sheet: 'Abr26', label: 'Abr/26', inProgress: true });
    expect(ov.snapshots[0].label).toBe('Jan–Fev/25');
    expect(ov.issueCounts.warning).toBeGreaterThan(0);
  });

  it('cache: relê a planilha só quando o arquivo muda ou no recarregar', async () => {
    await ctx.svc.overview();
    await ctx.svc.comparison({});
    expect(ctx.reads).toHaveLength(1);
    ctx.file.mtimeMs = 2;
    await ctx.svc.overview();
    expect(ctx.reads).toHaveLength(2);
    await ctx.svc.reload();
    expect(ctx.reads).toHaveLength(3);
  });

  it('comparison: padrões e validação dos parâmetros', async () => {
    const r = await ctx.svc.comparison({ granularity: 'quarter' });
    expect(r).toMatchObject({ granularity: 'quarter', method: 'flow', throughMonth: 3 });
    await expect(ctx.svc.comparison({ granularity: 'dia' })).rejects.toBeInstanceOf(ValidationError);
    await expect(ctx.svc.comparison({ through: '13' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('breakdowns: torre, parceiro e responsável', async () => {
    const b = await ctx.svc.breakdowns({ through: '12' });
    expect(b.torre.map((r) => r.key)).toContain('servico');
    expect(b.partner.length).toBeGreaterThan(0);
    expect(b.owner.length).toBeGreaterThan(0);
  });

  it('deals: filtros por ano, status e busca', async () => {
    const r = await ctx.svc.deals({ year: '2026', status: 'won' });
    expect(r.deals.every((d) => d.year === 2026 && d.status === 'won')).toBe(true);
    expect(r.summary.won.cents).toBe(30000 + 6000 + 8000);
    expect((await ctx.svc.deals({ q: 'kap' })).deals).toHaveLength(2);
    expect((await ctx.svc.deals({ month: '2', year: '2025' })).deals).toHaveLength(2); // "Até Fev" cobre fev
    expect((await ctx.svc.deals({ status: '' })).deals.length).toBeGreaterThan(10);
  });

  it('simulation: pipeline da última aba, realizado e base de comparação', async () => {
    const s = await ctx.svc.simulation({ target: '1000' });
    expect(s.latest.sheet).toBe('Abr26');
    expect(s.current).toBe(true);
    expect(s.stepMonths).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(s.pipeline).toMatchObject({ count: 2, cents: 9500, carried: 1 });
    expect(s.realizedCents).toBe(44000);
    expect(s.baselineCents).toBe(30000 + 10000 + 20000); // Até Fev + GAMA + EPS
    expect(s.baselineByMonth[11]).toBe(s.baselineCents);
    expect(s.result.runs).toBe(500);
    expect(s.result.probTarget).not.toBeNull();
    const only26 = await ctx.svc.simulation({ history: '2026', runs: '200' });
    expect(only26.stats.historyYears).toEqual([2026]);
    await expect(ctx.svc.simulation({ history: 'x' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('simulation: aba mais recente já fechada começa no mês seguinte', async () => {
    const { svc } = makeService({ now: '2026-06-15T12:00:00Z' });
    const s = await svc.simulation({});
    expect(s.stepMonths[0]).toBe(4); // Abr26 ainda sem decisão → em andamento
  });

  it('exportWorkbook entrega o relatório ao writer', async () => {
    const buf = await ctx.svc.exportWorkbook({});
    expect(JSON.parse(buf.toString())).toEqual(['overview', 'comparison', 'breakdowns', 'simulation', 'deals', 'issues']);
  });
});
