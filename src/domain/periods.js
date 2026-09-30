// Períodos: nome da aba → {ano, meses}; agrupamento em buckets comparáveis entre anos.

const MONTHS = {
  JAN: 1, JANEIRO: 1, FEV: 2, FEB: 2, FEVEREIRO: 2, MAR: 3, MARCO: 3, ABR: 4, APR: 4, ABRIL: 4,
  MAI: 5, MAY: 5, MAIO: 5, JUN: 6, JUNHO: 6, JUL: 7, JULHO: 7, AGO: 8, AUG: 8, AGOSTO: 8,
  SET: 9, SEP: 9, SETEMBRO: 9, OUT: 10, OCT: 10, OUTUBRO: 10, NOV: 11, NOVEMBRO: 11, DEZ: 12, DEC: 12, DEZEMBRO: 12,
};
const SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

export const monthLabel = (m) => SHORT[m - 1];
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const clean = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[.]/g, '').trim();

/**
 * "Setembro" → {year: baseYear, months:[9]}; "Set26"/"May26" → {year: 2026, months:[..]};
 * "Até Fev" → {year: baseYear, months:[1,2]}; outras abas → null.
 */
export function parseSheetName(name, baseYear) {
  const s = clean(name);
  const upTo = /^ATE\s+([A-Z]+)(?:\s*(\d{2,4}))?$/.exec(s);
  if (upTo && MONTHS[upTo[1]]) return { year: toYear(upTo[2], baseYear), months: range(1, MONTHS[upTo[1]]) };
  const m = /^([A-Z]+)\s*(\d{2,4})?$/.exec(s);
  if (!m || !MONTHS[m[1]]) return null;
  return { year: toYear(m[2], baseYear), months: [MONTHS[m[1]]] };
}

function toYear(digits, baseYear) {
  if (!digits) return baseYear;
  const n = Number(digits);
  return n < 100 ? 2000 + n : n;
}

export const GRANULARITIES = { month: 'Mês', quarter: 'Trimestre', semester: 'Semestre', year: 'Ano' };

/**
 * Buckets de comparação. Em 'month', meses cobertos juntos por uma aba (ex.: "Até Fev" = [1,2])
 * se fundem num bucket só, para que os dois anos sejam comparados na mesma base.
 * @param {'month'|'quarter'|'semester'|'year'} granularity
 * @param {number[][]} covers listas de meses cobertas por cada aba
 */
export function buildBuckets(granularity, covers = []) {
  if (granularity === 'month') {
    const group = range(1, 12).map((m) => m); // union-find simples: group[m] = menor mês do grupo
    const find = (m) => (group[m - 1] === m ? m : find(group[m - 1]));
    for (const months of covers) {
      const root = Math.min(...months.map(find));
      for (const m of months) group[find(m) - 1] = root;
    }
    const byRoot = new Map();
    for (const m of range(1, 12)) {
      const r = find(m);
      if (!byRoot.has(r)) byRoot.set(r, []);
      byRoot.get(r).push(m);
    }
    return [...byRoot.values()].map((months) => {
      const first = months[0];
      const last = months.at(-1);
      const key = `m${String(first).padStart(2, '0')}${months.length > 1 ? `-${String(last).padStart(2, '0')}` : ''}`;
      const label = months.length > 1 ? `${monthLabel(first)}–${monthLabel(last)}` : monthLabel(first);
      return { key, label, months };
    });
  }
  if (granularity === 'quarter') return range(1, 4).map((q) => ({ key: `q${q}`, label: `${q}º tri`, months: range(q * 3 - 2, q * 3) }));
  if (granularity === 'semester') return range(1, 2).map((s) => ({ key: `s${s}`, label: `${s}º sem`, months: range(s * 6 - 5, s * 6) }));
  if (granularity === 'year') return [{ key: 'y', label: 'Ano', months: range(1, 12) }];
  throw new Error(`Granularidade inválida: ${granularity}`);
}
