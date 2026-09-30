// Aleatoriedade determinística (semente) para a simulação: PRNG mulberry32, gamma e Dirichlet.

/** PRNG de 32 bits rápido e reprodutível; retorna função () → [0,1). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(rnd) {
  const u = 1 - rnd();
  const v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Gamma(shape, 1) — Marsaglia & Tsang; shape < 1 via boost. */
export function gamma(rnd, shape) {
  if (shape < 1) return gamma(rnd, shape + 1) * rnd() ** (1 / shape);
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x;
    let v;
    do {
      x = normal(rnd);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rnd();
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/** Amostra de uma Dirichlet(alphas): vetor de probabilidades que soma 1. */
export function dirichlet(rnd, alphas) {
  const g = alphas.map((a) => gamma(rnd, a));
  const sum = g.reduce((s, x) => s + x, 0);
  return g.map((x) => x / sum);
}
