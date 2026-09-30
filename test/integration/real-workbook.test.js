// Contrato com a planilha real do projeto (pulado se ela não estiver na pasta).
// Os números conferem com os totais "Total Fechado/Perdido/DPD" das próprias abas.
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { createWorkbookReader } from '../../src/infrastructure/xlsx/pipeline-workbook-reader.js';
import { ingest } from '../../src/domain/ingest.js';
import { summarize } from '../../src/domain/metrics.js';
import { parsePipelineConfig } from '../../src/domain/config-schema.js';

const FILE = fileURLToPath(new URL('../../1. Pipeline ACCyber Pro.xlsx', import.meta.url));
const config = parsePipelineConfig(JSON.parse(readFileSync(new URL('../../config/pipeline.json', import.meta.url))));

describe.skipIf(!existsSync(FILE))('planilha real "1. Pipeline ACCyber Pro.xlsx"', async () => {
  const { deals, snapshots, issues } = existsSync(FILE) ? ingest(await createWorkbookReader().read(FILE), config) : {};
  const sheet = (name) => summarize(deals.filter((d) => d.sheet === name));
  const usd = (cents) => Math.round(cents) / 100;

  it('lê as 21 abas de período (2025: Até Fev..Dezembro; 2026: Jan26..Out26)', () => {
    expect(snapshots).toHaveLength(21);
    expect(snapshots[0]).toMatchObject({ sheet: 'Até Fev', year: 2025, months: [1, 2] });
    expect(snapshots.at(-1)).toMatchObject({ sheet: 'Out26', year: 2026, month: 10, decided: false });
  });

  it('totais por cor batem com os totais da própria aba', () => {
    expect(usd(sheet('Julho').won.cents)).toBeCloseTo(34691.07, 1);
    expect(usd(sheet('Julho').lost.cents)).toBeCloseTo(509032.5, 1);
    expect(usd(sheet('Julho').delayed.cents)).toBeCloseTo(320790.57, 1);
    expect(usd(sheet('Setembro').delayed.cents)).toBeCloseTo(443406.74, 0); // aba declara 422.294,38 (fórmula omite linhas)
    expect(usd(sheet('Set26').won.cents)).toBeCloseTo(234406.74, 1);
    expect(usd(sheet('Até Fev').won.cents)).toBeCloseTo(76829.79, 0); // R$ 445.612,79 / 5,8
  });

  it('aponta a fórmula divergente de Abril/2025 (soma D18 duas vezes e inclui DPD)', () => {
    expect(issues.some((i) => i.sheet === 'Abril' && i.code === 'declared-mismatch' && /Vendido/.test(i.message))).toBe(true);
  });
});
