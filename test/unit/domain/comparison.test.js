import { describe, it, expect } from 'vitest';
import { ingest } from '../../../src/domain/ingest.js';
import { compareYears, breakdown } from '../../../src/domain/comparison.js';
import { rawSheets, CONFIG } from '../../fixtures/raw-sheets.js';

const { deals, snapshots } = ingest(rawSheets(), CONFIG);

describe('compareYears', () => {
  it('mês: Jan–Fev fundido, variação do vendido e diferença em p.p.', () => {
    const r = compareYears(deals, snapshots, { granularity: 'month', method: 'flow', years: [2025, 2026], throughMonth: 3 });
    const jf = r.buckets.find((b) => b.key === 'm01-02');
    expect(jf.byYear[2025].won.cents).toBe(30000); // 1500 R$ / 5
    expect(jf.byYear[2026].won.cents).toBe(36000); // 300 + 60
    expect(jf.delta.wonGrowth).toBeCloseTo(0.2);
    expect(jf.notes[0]).toMatch(/Até Fev.*não são comparáveis/);
    expect(r.buckets.find((b) => b.key === 'm03').notes).toEqual([]);
    const mar = r.buckets.find((b) => b.key === 'm03');
    expect(mar.byYear[2025].won.pct).toBeCloseTo(100 / 390);
    expect(mar.delta.pp.won).toBeCloseTo(80 / 160 - 100 / 390);
    expect(r.buckets.find((b) => b.key === 'm12')).toBeUndefined(); // sem dados em nenhum ano
    expect(r.buckets.find((b) => b.key === 'm04').beyondLimit).toBe(true);
  });

  it('acumulado comparável respeita o mês-limite nos dois anos', () => {
    const r = compareYears(deals, snapshots, { granularity: 'quarter', method: 'flow', years: [2025, 2026], throughMonth: 3 });
    expect(r.total.months).toEqual([1, 2, 3]);
    expect(r.total.byYear[2025].won.cents).toBe(30000 + 10000);
    expect(r.total.byYear[2026].won.cents).toBe(36000 + 8000);
    const q2 = r.buckets.find((b) => b.key === 'q2');
    expect(q2.beyondLimit).toBe(true);
  });

  it('fluxo no trimestre: KAPA DPD em jan e perdido em fev conta uma vez (perdido)', () => {
    const r = compareYears(deals, snapshots, { granularity: 'quarter', method: 'flow', years: [2025, 2026], throughMonth: 12 });
    const q1 = r.buckets.find((b) => b.key === 'q1').byYear[2026];
    expect(q1.delayed.cents).toBe(7000); // só o NI pendente em março (última aba do tri)
    expect(q1.lost.cents).toBe(11000);
    const snap = compareYears(deals, snapshots, { granularity: 'quarter', method: 'snapshots', years: [2025, 2026], throughMonth: 12 });
    expect(snap.buckets[0].byYear[2026].delayed.cents).toBe(17000);
  });
});

describe('breakdown', () => {
  it('por torre com os dois anos, ordenado pelo vendido', () => {
    const rows = breakdown(deals, snapshots, { dimension: 'torre', method: 'flow', years: [2025, 2026], throughMonth: 12 });
    expect(rows[0].key).toBe('solucao');
    expect(rows[0].label).toBe('Solução');
    expect(rows[0].byYear[2026].won.cents).toBe(44000);
  });
  it('limite agrupa o restante em "Outros"', () => {
    const rows = breakdown(deals, snapshots, { dimension: 'partner', method: 'flow', years: [2025, 2026], throughMonth: 12, limit: 2 });
    expect(rows).toHaveLength(3);
    expect(rows.at(-1).label).toBe('Outros');
  });
  it('dimensão inválida', () => {
    expect(() => breakdown(deals, snapshots, { dimension: 'x', method: 'flow', years: [2025, 2026], throughMonth: 12 })).toThrow(/Dimensão/);
  });
});
