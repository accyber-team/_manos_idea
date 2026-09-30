// Planilha de pipeline sintética (exceljs) e dependências reais com arquivo temporário.
import ExcelJS from 'exceljs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWorkbookReader } from '../src/infrastructure/xlsx/pipeline-workbook-reader.js';
import { createFolderSource } from '../src/infrastructure/source/folder-source.js';
import { createXlsxReportWriter } from '../src/infrastructure/export/xlsx-report-writer.js';
import { createAnalyticsService } from '../src/application/analytics-service.js';
import { CONFIG } from './fixtures/raw-sheets.js';

const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

/** Escreve um .xlsx no formato da planilha real: título, cabeçalho na linha 2, VALOR colorido, bloco de totais. */
export async function writePipelineXlsx(path, sheets) {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet('Consolidado').getCell('B2').value = 'R$';
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name);
    ws.getCell('A1').value = `PIPELINE ACCYBER PRO ${s.name.toUpperCase()}`;
    ws.getRow(2).values = ['EMPRESA', 'TORRE', 'PARCEIRO', 'VALOR', 'RESPONSAVEL'];
    s.rows.forEach((r, i) => {
      const row = ws.getRow(3 + i);
      row.values = [r.company, r.torre, r.partner, null, r.owner];
      const c = row.getCell(4);
      c.value = r.formula ? { formula: r.formula, result: r.value } : r.value;
      c.numFmt = r.currency === 'BRL' ? '[$R$ -416]#,##0.00' : '[$$]#,##0.00';
      if (r.fill) c.fill = fill(r.fill);
    });
    const totalRow = 3 + s.rows.length + 1;
    ws.getCell(`A${totalRow}`).value = 'TOTAL';
    ws.getCell(`D${totalRow}`).value = { formula: `SUM(D3:D${totalRow - 2})`, result: 0 };
    Object.entries(s.declared ?? {}).forEach(([label, v], i) => {
      ws.getCell(`G${4 + i}`).value = label;
      ws.getCell(`H${4 + i}`).value = v;
    });
  }
  await wb.xlsx.writeFile(path);
}

export const SAMPLE = [
  { name: 'Setembro', declared: { 'Total Fechado': 100, 'Total Perdido': 50 }, rows: [
    { company: 'ACME', torre: 'SOLUÇÃO', partner: 'FIGMA', value: 100, fill: 'FF00FF00', owner: 'ANA' },
    { company: 'Beta S.A.', torre: 'SERVICO', partner: 'MSS', value: 50, fill: 'FFFF0000', owner: 'BIA', formula: '250/5' },
    { company: 'GAMA', torre: 'SOLUCAO', partner: 'CHECK POINT', value: 70, fill: 'FFFFFF00', owner: 'ANA' },
    { company: 'DELTA', torre: 'SOLUCAO', partner: 'DROPBOX', value: 5, owner: 'ANA' },
  ] },
  { name: 'Set26', rows: [
    { company: 'GAMA', torre: 'SOLUCAO', partner: 'CHECKPOINT', value: 70, fill: 'FF00FF00', owner: 'ANA' },
    { company: 'OMEGA', torre: 'SERVICO', partner: 'MSS', value: 580, fill: 'FFFFFF00', owner: 'CAIO', currency: 'BRL' },
  ] },
  { name: 'Out26', rows: [
    { company: 'OMEGA', torre: 'SERVICO', partner: 'MSS', value: 100, owner: 'CAIO' },
  ] },
];

export async function samplePipelineDir(sheets = SAMPLE) {
  const dir = mkdtempSync(join(tmpdir(), 'pipeline-'));
  await writePipelineXlsx(join(dir, 'pipeline.xlsx'), sheets);
  return dir;
}

export const TEST_CONFIG = { ...CONFIG, fxRates: { BRL: 5.8 }, compareYears: [2025, 2026], simulation: { runs: 300, seed: 7 } };

export function makeRealService(dir, { now = '2026-09-30T12:00:00' } = {}) {
  return createAnalyticsService({
    source: createFolderSource({ dir }), reader: createWorkbookReader(), writer: createXlsxReportWriter(),
    config: TEST_CONFIG, clock: { now: () => new Date(now) },
  });
}
