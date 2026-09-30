// Transições entre abas mensais consecutivas: o que acontece com cada oportunidade de um mês para o outro.
// Base estatística da simulação (src/domain/simulation.js).
import { isPending } from './status.js';

const outcomeOf = (status) => (status === 'won' ? 'won' : status === 'lost' ? 'lost' : 'pending');
const consecutive = (a, b) => (b.year * 12 + b.month) - (a.year * 12 + a.month) === 1;
const empty = () => ({ won: 0, lost: 0, pending: 0, n: 0 });

/**
 * Para cada par de abas consecutivas (a próxima já decidida):
 * - carried: oportunidades pendentes (DPD/aberto) no mês anterior que reaparecem → desfecho no mês seguinte;
 * - dropped: pendentes que simplesmente somem da aba seguinte;
 * - new: oportunidades que aparecem sem estar pendentes antes → desfecho no mês;
 * - newWonByMonth: valor vendido de oportunidades novas em cada mês.
 */
export function transitionStats(deals, snapshots) {
  const bySheet = new Map();
  for (const d of deals) {
    if (!bySheet.has(d.sheet)) bySheet.set(d.sheet, []);
    bySheet.get(d.sheet).push(d);
  }
  const res = { pairs: 0, new: empty(), carried: empty(), dropped: { dropped: 0, n: 0 }, newWonByMonth: [] };
  for (let i = 0; i + 1 < snapshots.length; i++) {
    const [a, b] = [snapshots[i], snapshots[i + 1]];
    if (!consecutive(a, b) || !b.decided) continue;
    res.pairs++;
    const pending = new Map();
    for (const d of bySheet.get(a.sheet) ?? []) if (isPending(d.status)) pending.set(d.dealKey, d);
    const matched = new Set();
    let newWon = 0;
    for (const d of bySheet.get(b.sheet) ?? []) {
      const bucket = pending.has(d.dealKey) && !matched.has(d.dealKey) ? res.carried : res.new;
      if (bucket === res.carried) matched.add(d.dealKey);
      else if (d.status === 'won') newWon += d.valueCents;
      bucket[outcomeOf(d.status)]++;
      bucket.n++;
    }
    res.dropped.n += pending.size;
    res.dropped.dropped += pending.size - matched.size;
    res.newWonByMonth.push({ year: b.year, month: b.month, cents: newWon });
  }
  return res;
}

/**
 * Pipeline pendente (DPD/aberto) de uma aba, marcando o que já vinha pendente da aba anterior consecutiva
 * ("carried") — essas oportunidades seguem as taxas de oportunidades carregadas na simulação.
 */
export function pendingPipeline(deals, snapshots, sheet) {
  const idx = snapshots.findIndex((s) => s.sheet === sheet);
  if (idx < 0) return [];
  const prev = idx > 0 && consecutive(snapshots[idx - 1], snapshots[idx]) ? snapshots[idx - 1].sheet : null;
  const prevPending = new Set(deals.filter((d) => d.sheet === prev && isPending(d.status)).map((d) => d.dealKey));
  return deals.filter((d) => d.sheet === sheet && isPending(d.status))
    .map((d) => ({ ...d, carried: prevPending.has(d.dealKey) }));
}
