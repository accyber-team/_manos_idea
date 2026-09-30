import { describe, it, expect } from 'vitest';
import { ingest } from '../../../src/domain/ingest.js';
import { rawSheets, CONFIG } from '../../fixtures/raw-sheets.js';

describe('ingest', () => {
  const { deals, snapshots, issues } = ingest(rawSheets(), CONFIG);

  it('abas de período viram snapshots em ordem cronológica; Consolidado é ignorado', () => {
    expect(snapshots.map((s) => s.sheet)).toEqual(['Até Fev', 'Março', 'Abril', 'Jan26', 'Fev26', 'Mar26', 'Abr26']);
    expect(snapshots[0]).toMatchObject({ year: 2025, months: [1, 2], month: 2 });
    expect(snapshots.at(-1)).toMatchObject({ year: 2026, month: 4, decided: false });
    expect(snapshots[1].decided).toBe(true);
  });

  it('status pela cor e override por aba ("Até Fev" sem cor = vendido)', () => {
    const byId = Object.fromEntries(deals.map((d) => [d.id, d]));
    expect(byId['Até Fev#3'].status).toBe('won');
    expect(byId['Março#5'].status).toBe('delayed');
    expect(byId['Março#4'].status).toBe('lost');
    expect(byId['Abr26#4'].status).toBe('open');
    expect(byId['Abril#5'].status).toBe('open'); // cor desconhecida → aberto + pendência
  });

  it('converte R$ para US$ pela taxa e guarda o original', () => {
    const alfa = deals.find((d) => d.id === 'Até Fev#3');
    expect(alfa).toMatchObject({ valueCents: 20000, originalCents: 100000, currency: 'BRL', torre: 'solucao', partner: 'DROPBOX' });
  });

  it('normaliza chaves de parceiro e empresa', () => {
    const eps = deals.filter((d) => d.company === 'EPS');
    expect(new Set(eps.map((d) => d.dealKey)).size).toBe(1);
  });

  it('pendências de qualidade: cor desconhecida, valor ausente, total declarado divergente, conversão', () => {
    const codes = issues.map((i) => `${i.sheet}:${i.code}`);
    expect(codes).toContain('Abril:unknown-color');
    expect(codes).toContain('Abril:missing-value');
    expect(codes).toContain('Março:declared-mismatch');
    expect(codes).toContain('Até Fev:converted');
    expect(codes).toContain('Até Fev:default-status');
    expect(codes).not.toContain('Até Fev:declared-mismatch');
    const mismatch = issues.find((i) => i.code === 'declared-mismatch');
    expect(mismatch.message).toMatch(/DPD/);
  });

  it('abas duplicadas para o mesmo período geram pendência e a segunda é ignorada', () => {
    const r = ingest([...rawSheets(), { name: 'Abril ', rows: [], declared: {} }], CONFIG);
    expect(r.issues.some((i) => i.code === 'duplicate-period')).toBe(true);
    expect(r.snapshots.filter((s) => s.year === 2025 && s.month === 4)).toHaveLength(1);
  });

  it('abas sem período reconhecível viram pendência informativa', () => {
    const r = ingest([{ name: 'Rascunho', rows: [], declared: {} }], CONFIG);
    expect(r.issues[0]).toMatchObject({ code: 'sheet-ignored', level: 'info' });
  });
});
