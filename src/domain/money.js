// Dinheiro sempre em centavos inteiros de US$ (moeda-base da análise). Formatação só na borda, em pt-BR.

const SYMBOL = { USD: 'US$', BRL: 'R$' };

/** Número (unidades monetárias) → centavos inteiros, arredondando. */
export const toCents = (value) => Math.round(Number(value) * 100);

/** Centavos na moeda de origem → centavos de US$. rates: { BRL: 5.8 } (1 US$ = 5,8 R$). */
export function toUsdCents(cents, currency, rates) {
  if (currency === 'USD') return cents;
  const rate = rates?.[currency];
  if (!rate) throw new Error(`Câmbio não configurado para ${currency}`);
  return Math.round(cents / rate);
}

const NUM = (digits) => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });

/** 123456789 → "US$ 1.234.567,89" (espaço não separável). */
export function formatMoney(cents, currency = 'USD') {
  const sign = cents < 0 ? '-' : '';
  return `${sign}${SYMBOL[currency]} ${NUM(2).format(Math.abs(cents) / 100)}`;
}

/** Valor compacto para KPIs e eixos: US$ 727,3 mil · US$ 1,52 mi. */
export function formatCompact(cents, currency = 'USD') {
  const v = Math.abs(cents) / 100;
  const sign = cents < 0 ? '-' : '';
  const sym = `${sign}${SYMBOL[currency]} `;
  if (v >= 1e6) return `${sym}${NUM(2).format(v / 1e6)} mi`;
  if (v >= 1e3) return `${sym}${NUM(1).format(v / 1e3)} mil`;
  return `${sym}${NUM(0).format(v)}`;
}

/** Fração → "24,4%"; null/NaN → "—". */
export const formatPct = (x, digits = 1) => (x == null || Number.isNaN(x) ? '—' : `${NUM(digits).format(x * 100)}%`);

/** Diferença de frações em pontos percentuais: 0.052 → "+5,2 p.p." */
export function formatPp(x) {
  if (x == null || Number.isNaN(x)) return '—';
  const sign = x > 0 ? '+' : x < 0 ? '−' : '';
  return `${sign}${NUM(1).format(Math.abs(x) * 100)} p.p.`;
}
