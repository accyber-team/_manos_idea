import { describe, it, expect } from 'vitest';
import { summarize, periodDeals } from '../../../src/domain/metrics.js';

const d = (status, valueCents, sheet = 'A', month = 1) => ({ status, valueCents, sheet, month, year: 2025 });

describe('summarize', () => {
  it('totais, percentuais sobre o forecast e taxa de conversão', () => {
    const s = summarize([d('won', 600), d('lost', 200), d('delayed', 100), d('open', 100)]);
    expect(s.totalCents).toBe(1000);
    expect(s.count).toBe(4);
    expect(s.won).toEqual({ cents: 600, count: 1, pct: 0.6 });
    expect(s.delayed.pct).toBe(0.1);
    expect(s.winRate).toBe(0.75);
  });
  it('vazio: percentuais nulos', () => {
    const s = summarize([]);
    expect(s.won.pct).toBeNull();
    expect(s.winRate).toBeNull();
  });
});

describe('periodDeals', () => {
  const deals = [d('won', 1, 'A', 1), d('delayed', 2, 'A', 1), d('lost', 3, 'B', 2), d('delayed', 4, 'B', 2), d('open', 5, 'B', 2)];
  it('fluxo: decididos de todas as abas + pendentes só da última', () => {
    expect(periodDeals(deals, 'flow').map((x) => x.valueCents)).toEqual([1, 3, 4, 5]);
  });
  it('snapshots: soma de tudo', () => {
    expect(periodDeals(deals, 'snapshots')).toHaveLength(5);
  });
  it('método inválido', () => {
    expect(() => periodDeals(deals, 'x')).toThrow(/Método/);
  });
});
