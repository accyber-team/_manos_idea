import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { createWorkbookReader } from '../../src/infrastructure/xlsx/pipeline-workbook-reader.js';
import { createFolderSource } from '../../src/infrastructure/source/folder-source.js';
import { SourceUnavailableError } from '../../src/application/errors.js';
import { samplePipelineDir, makeRealService } from '../helpers.js';

describe('WorkbookReader (exceljs)', () => {
  it('lê linhas até TOTAL, cor do VALOR, resultado de fórmula, moeda e totais declarados', async () => {
    const dir = await samplePipelineDir();
    const sheets = await createWorkbookReader().read(join(dir, 'pipeline.xlsx'));
    expect(sheets.map((s) => s.name)).toEqual(['Consolidado', 'Setembro', 'Set26', 'Out26']);
    expect(sheets[0].rows).toEqual([]);
    const set = sheets[1];
    expect(set.rows).toHaveLength(4);
    expect(set.rows[0]).toMatchObject({ row: 3, company: 'ACME', torre: 'SOLUÇÃO', partner: 'FIGMA', owner: 'ANA', value: 100, fill: 'FF00FF00', currency: 'USD' });
    expect(set.rows[1]).toMatchObject({ value: 50, fill: 'FFFF0000' });
    expect(set.rows[3].fill).toBeNull();
    expect(set.declared).toEqual({ won: 100, lost: 50 });
    expect(sheets[2].rows[1].currency).toBe('BRL');
  });

  it('erro de fórmula no VALOR vira valueError', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pipe-err-'));
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Jan26');
    ws.getRow(2).values = ['EMPRESA', 'TORRE', 'PARCEIRO', 'VALOR', 'RESPONSAVEL'];
    ws.getRow(3).values = ['X', 'SOLUCAO', 'FIGMA', { formula: 'A1/0', result: { error: '#DIV/0!' } }, 'ANA'];
    await wb.xlsx.writeFile(join(dir, 'p.xlsx'));
    const [sheet] = await createWorkbookReader().read(join(dir, 'p.xlsx'));
    expect(sheet.rows[0]).toMatchObject({ value: null, valueError: '#DIV/0!' });
  });
});

describe('FolderSource', () => {
  it('pega o .xlsx mais recente, ignorando temporários do Excel', () => {
    const dir = mkdtempSync(join(tmpdir(), 'src-'));
    for (const n of ['a.xlsx', 'b.xlsx', '~$b.xlsx', 'c.csv']) writeFileSync(join(dir, n), 'x');
    utimesSync(join(dir, 'a.xlsx'), new Date('2026-01-01'), new Date('2026-01-01'));
    expect(createFolderSource({ dir }).current().name).toBe('b.xlsx');
    expect(createFolderSource({ dir, file: join(dir, 'a.xlsx') }).current().name).toBe('a.xlsx');
  });
  it('erros legíveis sem pasta, sem planilha ou arquivo inexistente', () => {
    const empty = mkdtempSync(join(tmpdir(), 'src-'));
    expect(() => createFolderSource({ dir: empty }).current()).toThrow(SourceUnavailableError);
    expect(() => createFolderSource({ dir: join(empty, 'nao') }).current()).toThrow(/Pasta/);
    expect(() => createFolderSource({ dir: empty, file: join(empty, 'x.xlsx') }).current()).toThrow(/não encontrada/);
  });
});

describe('ponta a ponta com XLSX real em disco', () => {
  it('comparativo, pendências e exportação colorida', async () => {
    const svc = makeRealService(await samplePipelineDir());
    const cmp = await svc.comparison({ granularity: 'month' });
    expect(cmp.throughMonth).toBe(9);
    const set = cmp.buckets.find((b) => b.key === 'm09');
    expect(set.byYear[2025]).toMatchObject({ totalCents: 22500, won: { cents: 10000, count: 1 } });
    expect(set.byYear[2026].won.cents).toBe(7000);
    expect(set.byYear[2026].delayed.cents).toBe(10000); // R$ 580 / 5,8
    const issues = await svc.issues();
    expect(issues.map((i) => i.code)).toEqual(expect.arrayContaining(['converted']));
    expect(issues.some((i) => i.code === 'declared-mismatch')).toBe(false);

    const buf = await svc.exportWorkbook({ granularity: 'quarter' });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Comparativo', 'Torre', 'Parceiro', 'Responsável', 'Simulação', 'Oportunidades', 'Qualidade dos dados']);
    const cmpWs = wb.getWorksheet('Comparativo');
    const wonPct = cmpWs.getRow(4).getCell(4); // 1º tri? não: 3º tri é a 1ª linha com dados
    expect(cmpWs.getRow(3).getCell(4).value).toBe('2025 % Vendido');
    expect(wonPct.fill.fgColor.argb).toBe('FF0CA30C');
    expect(cmpWs.getRow(3).getCell(6).value).toBe('2025 % Perdido');
    expect(cmpWs.getRow(4).getCell(6).fill.fgColor.argb).toBe('FFD03B3B');
    expect(cmpWs.getRow(4).getCell(5).fill.fgColor.argb).toBe('FFFAB219');
  });
});
