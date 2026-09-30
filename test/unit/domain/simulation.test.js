import { describe, it, expect } from 'vitest';
import { simulate } from '../../../src/domain/simulation.js';
import { mulberry32, gamma, dirichlet } from '../../../src/domain/random.js';

const STATS = {
  new: { won: 30, lost: 30, pending: 40, n: 100 },
  carried: { won: 20, lost: 20, pending: 60, n: 100 },
  dropped: { dropped: 10, n: 100 },
};

describe('random', () => {
  it('mulberry32 é determinístico', () => {
    const a = mulberry32(7); const b = mulberry32(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('gamma e dirichlet com médias coerentes', () => {
    const rnd = mulberry32(1);
    let s = 0; for (let i = 0; i < 4000; i++) s += gamma(rnd, 3);
    expect(s / 4000).toBeCloseTo(3, 0);
    const p = dirichlet(rnd, [1, 2, 3]);
    expect(p.reduce((a, b) => a + b)).toBeCloseTo(1);
    expect(gamma(rnd, 0.5)).toBeGreaterThan(0);
  });
});

describe('simulate', () => {
  const base = {
    pipeline: [{ valueCents: 100000, carried: false }, { valueCents: 50000, carried: true }],
    stats: STATS, newWonSamples: [10000, 20000, 0], steps: 3, realizedCents: 1000000,
    baselineCents: 1100000, targetCents: 1300000, runs: 2000, seed: 42,
  };

  it('reprodutível pela semente e com quantis ordenados', () => {
    const a = simulate(base); const b = simulate(base);
    expect(a.p50).toBe(b.p50);
    expect(a.p10).toBeLessThanOrEqual(a.p50);
    expect(a.p50).toBeLessThanOrEqual(a.p90);
    expect(a.min).toBeGreaterThanOrEqual(1000000);
    expect(a.max).toBeLessThanOrEqual(1000000 + 150000 + 2 * 20000);
  });

  it('probabilidades de superar a base e a meta', () => {
    const r = simulate(base);
    expect(r.probBeatBaseline).toBeGreaterThan(0);
    expect(r.probBeatBaseline).toBeLessThan(1);
    expect(r.probTarget).toBe(0);
    expect(simulate({ ...base, targetCents: null }).probTarget).toBeNull();
  });

  it('histograma e leque mensal', () => {
    const r = simulate(base);
    expect(r.histogram.reduce((s, h) => s + h.count, 0)).toBe(2000);
    expect(r.fan).toHaveLength(3);
    expect(r.fan[2].p50).toBeGreaterThanOrEqual(r.fan[0].p50);
    expect(r.meanPipelineCents + r.meanNewCents + 1000000).toBeCloseTo(r.mean, -1);
  });

  it('sem pipeline e sem histórico de novas vendas = realizado', () => {
    const r = simulate({ ...base, pipeline: [], newWonSamples: [] });
    expect(r.p90).toBe(1000000);
  });

  it('validações', () => {
    expect(() => simulate({ ...base, runs: 0 })).toThrow(/runs/);
    expect(() => simulate({ ...base, steps: 0 })).toThrow(/steps/);
  });
});
