import { describe, it, expect } from 'vitest';
import { ingest } from '../../../src/domain/ingest.js';
import { transitionStats, pendingPipeline } from '../../../src/domain/flow.js';
import { rawSheets, CONFIG } from '../../fixtures/raw-sheets.js';

describe('transitionStats', () => {
  const { deals, snapshots } = ingest(rawSheets(), CONFIG);
  const st = transitionStats(deals, snapshots);

  it('conta desfechos de oportunidades novas e carregadas entre abas consecutivas decididas', () => {
    // Pares: AtéFev→Março, Março→Abril, Jan26→Fev26, Fev26→Mar26 (Mar26→Abr26 não: Abr26 não decidida;
    // Abril→Jan26 não: não consecutivos)
    expect(st.pairs).toBe(4);
    expect(st.carried).toEqual({ won: 1, lost: 1, pending: 0, n: 2 }); // EPS vendido, KAPA perdido
    expect(st.dropped).toEqual({ dropped: 1, n: 3 }); // ZETA sumiu
    expect(st.new.n).toBe(4 + 2 + 1 + 3); // Março, Abril (ETA, TETA), Fev26 (LAMBDA), Mar26
  });

  it('vendas novas por mês (bootstrap da simulação)', () => {
    expect(st.newWonByMonth.map((x) => `${x.year}-${x.month}:${x.cents}`)).toEqual(['2025-3:10000', '2025-4:0', '2026-2:6000', '2026-3:8000']);
  });
});

describe('pendingPipeline', () => {
  const { deals, snapshots } = ingest(rawSheets(), CONFIG);
  it('pendentes da aba, marcando os que vieram da aba anterior', () => {
    const p = pendingPipeline(deals, snapshots, 'Abr26');
    expect(p.map((d) => `${d.company}:${d.carried}`)).toEqual(['NI:true', 'OMI:false']);
  });
  it('aba desconhecida ou primeira aba', () => {
    expect(pendingPipeline(deals, snapshots, 'X')).toEqual([]);
    expect(pendingPipeline(deals, snapshots, 'Até Fev')).toEqual([]);
  });
});
