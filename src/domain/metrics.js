// Resumo de um conjunto de oportunidades: forecast, valores e percentuais por status.
import { STATUSES, isPending } from './status.js';

/**
 * @param {{status:string, valueCents:number}[]} deals
 * @returns {{count:number, totalCents:number, winRate:number|null} & Record<string,{cents:number,count:number,pct:number|null}>}
 */
export function summarize(deals) {
  const out = { count: deals.length, totalCents: 0 };
  for (const s of STATUSES) out[s] = { cents: 0, count: 0, pct: null };
  for (const d of deals) {
    out.totalCents += d.valueCents;
    out[d.status].cents += d.valueCents;
    out[d.status].count += 1;
  }
  for (const s of STATUSES) out[s].pct = out.totalCents > 0 ? out[s].cents / out.totalCents : null;
  const decided = out.won.cents + out.lost.cents;
  out.winRate = decided > 0 ? out.won.cents / decided : null;
  return out;
}

export const METHODS = { flow: 'Fluxo do período', snapshots: 'Soma das abas mensais' };

/**
 * Oportunidades que representam um período com várias abas.
 * - flow: vendidos e perdidos de todas as abas + DPD/abertos só da última aba (o que ficou pendente no fim do período),
 *   para não contar várias vezes a mesma oportunidade que foi sendo adiada mês a mês.
 * - snapshots: soma simples de todas as abas.
 */
export function periodDeals(deals, method) {
  if (method === 'snapshots') return deals;
  if (method !== 'flow') throw new Error(`Método inválido: ${method}`);
  const last = deals.reduce((acc, d) => (acc === null || d.year * 100 + d.month > acc ? d.year * 100 + d.month : acc), null);
  return deals.filter((d) => !isPending(d.status) || d.year * 100 + d.month === last);
}
