// Simulação Monte Carlo do fechamento do ano: pipeline pendente + novas vendas, com incerteza nas taxas.
import { quantileSorted, mean } from 'simple-statistics';
import { mulberry32, dirichlet, gamma } from './random.js';

/**
 * @param {object} p
 * @param {{valueCents:number, carried:boolean}[]} p.pipeline oportunidades pendentes na aba mais recente
 * @param {{new:{won:number,lost:number,pending:number}, carried:{won:number,lost:number,pending:number},
 *   dropped:{dropped:number,n:number}}} p.stats resultado de transitionStats
 * @param {number[]} p.newWonSamples vendas novas por mês (centavos) para bootstrap
 * @param {number} p.steps meses simulados (o 1º é o da aba mais recente se ela estiver em andamento)
 * @param {boolean} [p.firstStepIsCurrent=true] 1º passo = mês da aba atual (sem saída do pipeline nem bootstrap)
 * @param {number} p.realizedCents vendido já realizado no ano
 * @param {number} p.baselineCents vendido do ano de comparação (ex.: 2025 inteiro)
 * @param {number|null} [p.targetCents] meta opcional
 * @param {number} [p.runs=5000] @param {number} [p.seed=42]
 */
export function simulate({ pipeline, stats, newWonSamples, steps, firstStepIsCurrent = true, realizedCents,
  baselineCents, targetCents = null, runs = 5000, seed = 42 }) {
  if (!(runs >= 1)) throw new Error('runs deve ser ≥ 1');
  if (!(steps >= 1)) throw new Error('steps deve ser ≥ 1');
  const rnd = mulberry32(seed);
  const alpha = (s) => [s.won + 1, s.lost + 1, s.pending + 1];
  const totals = new Float64Array(runs);
  const cumulative = Array.from({ length: steps }, () => new Float64Array(runs));
  let sumPipeline = 0;
  let sumNew = 0;

  for (let r = 0; r < runs; r++) {
    // Incerteza nas taxas: cada rodada sorteia as probabilidades da posterior Dirichlet/Beta.
    const pNew = dirichlet(rnd, alpha(stats.new));
    const pCar = dirichlet(rnd, alpha(stats.carried));
    const gd = gamma(rnd, stats.dropped.dropped + 1);
    const pDrop = gd / (gd + gamma(rnd, stats.dropped.n - stats.dropped.dropped + 1));
    let open = pipeline.map((d) => ({ v: d.valueCents, carried: d.carried }));
    let won = 0;
    let fromPipeline = 0;
    let fromNew = 0;
    for (let s = 0; s < steps; s++) {
      const current = s === 0 && firstStepIsCurrent;
      if (!current) open = open.filter(() => rnd() >= pDrop);
      const next = [];
      for (const d of open) {
        const [pw, pl] = d.carried || !current ? pCar : pNew;
        const u = rnd();
        if (u < pw) fromPipeline += d.v;
        else if (u >= pw + pl) next.push({ v: d.v, carried: true });
      }
      open = next;
      if (!current && newWonSamples.length) fromNew += newWonSamples[Math.floor(rnd() * newWonSamples.length)];
      won = fromPipeline + fromNew;
      cumulative[s][r] = realizedCents + won;
    }
    totals[r] = realizedCents + won;
    sumPipeline += fromPipeline;
    sumNew += fromNew;
  }

  const sorted = Array.from(totals).sort((a, b) => a - b);
  const q = (arr, p) => Math.round(quantileSorted(arr, p));
  const share = (pred) => sorted.filter(pred).length / runs;
  return {
    runs, seed, steps,
    mean: Math.round(mean(sorted)), min: sorted[0], max: sorted.at(-1),
    p10: q(sorted, 0.1), p50: q(sorted, 0.5), p90: q(sorted, 0.9),
    meanPipelineCents: Math.round(sumPipeline / runs), meanNewCents: Math.round(sumNew / runs),
    probBeatBaseline: share((x) => x > baselineCents),
    probTarget: targetCents == null ? null : share((x) => x >= targetCents),
    histogram: histogram(sorted, 24),
    fan: cumulative.map((arr) => {
      const s = Array.from(arr).sort((a, b) => a - b);
      return { p10: q(s, 0.1), p50: q(s, 0.5), p90: q(s, 0.9) };
    }),
  };
}

function histogram(sorted, bins) {
  const min = sorted[0];
  const max = sorted.at(-1);
  if (max === min) return [{ from: min, to: max, count: sorted.length }];
  const width = (max - min) / bins;
  const out = Array.from({ length: bins }, (_, i) => ({ from: Math.round(min + i * width), to: Math.round(min + (i + 1) * width), count: 0 }));
  for (const x of sorted) out[Math.min(bins - 1, Math.floor((x - min) / width))].count++;
  return out;
}
