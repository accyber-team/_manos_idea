import { describe, it, expect } from 'vitest';
import { parseSheetName, buildBuckets, monthLabel } from '../../../src/domain/periods.js';

describe('parseSheetName', () => {
  it('meses por extenso usam o ano-base (2025)', () => {
    expect(parseSheetName('Setembro', 2025)).toEqual({ year: 2025, months: [9] });
    expect(parseSheetName('Março', 2025)).toEqual({ year: 2025, months: [3] });
    expect(parseSheetName('marco', 2025)).toEqual({ year: 2025, months: [3] });
  });
  it('abreviação + ano (pt e en)', () => {
    expect(parseSheetName('Set26', 2025)).toEqual({ year: 2026, months: [9] });
    expect(parseSheetName('May26', 2025)).toEqual({ year: 2026, months: [5] });
    expect(parseSheetName('Apr26', 2025)).toEqual({ year: 2026, months: [4] });
    expect(parseSheetName('Out26', 2025)).toEqual({ year: 2026, months: [10] });
    expect(parseSheetName('Dez 2026', 2025)).toEqual({ year: 2026, months: [12] });
  });
  it('"Até Fev" acumula do início do ano', () => {
    expect(parseSheetName('Até Fev', 2025)).toEqual({ year: 2025, months: [1, 2] });
  });
  it('abas que não são período retornam null', () => {
    expect(parseSheetName('Consolidado', 2025)).toBeNull();
    expect(parseSheetName('Planilha1', 2025)).toBeNull();
  });
});

describe('buildBuckets', () => {
  const covers = [[1, 2], [1], [2], [3], [9]];
  it('mês: meses cobertos por uma mesma aba se fundem (Jan–Fev)', () => {
    const b = buildBuckets('month', covers);
    expect(b.map((x) => x.key)).toEqual(['m01-02', 'm03', 'm04', 'm05', 'm06', 'm07', 'm08', 'm09', 'm10', 'm11', 'm12']);
    expect(b[0]).toMatchObject({ label: 'Jan–Fev', months: [1, 2] });
  });
  it('trimestre, semestre e ano', () => {
    expect(buildBuckets('quarter', covers).map((x) => x.label)).toEqual(['1º tri', '2º tri', '3º tri', '4º tri']);
    expect(buildBuckets('semester', covers)[1]).toMatchObject({ label: '2º sem', months: [7, 8, 9, 10, 11, 12] });
    expect(buildBuckets('year', covers)).toHaveLength(1);
  });
  it('granularidade inválida', () => {
    expect(() => buildBuckets('week', covers)).toThrow(/Granularidade/);
  });
  it('monthLabel', () => {
    expect(monthLabel(9)).toBe('Set');
  });
});
