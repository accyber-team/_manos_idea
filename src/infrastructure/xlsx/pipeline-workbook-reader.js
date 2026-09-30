// Adapter exceljs: lê a planilha de pipeline preservando a COR de preenchimento da célula VALOR
// (o status mora na cor) e os totais declarados nas próprias abas ("Total Fechado", "Total Perdido", "Total DPD").
import ExcelJS from 'exceljs';
import { normalizeText } from '../../domain/normalize.js';

const HEADERS = { EMPRESA: 'company', TORRE: 'torre', PARCEIRO: 'partner', VALOR: 'value', RESPONSAVEL: 'owner' };
const DECLARED = { 'TOTAL FECHADO': 'won', 'TOTAL PERDIDO': 'lost', 'TOTAL DPD': 'delayed' };

function plain(cell) {
  let v = cell.value;
  if (v && typeof v === 'object') {
    if (v.richText) v = v.richText.map((t) => t.text).join('');
    else if ('result' in v || 'formula' in v || 'sharedFormula' in v) v = v.result;
    else if (v.error) v = { error: v.error };
    else if (v.text) v = v.text;
  }
  return v;
}

function fillOf(cell) {
  const f = cell.fill;
  if (!f || f.type !== 'pattern' || f.pattern === 'none') return null;
  return f.fgColor?.argb ?? null; // cores de tema (sem ARGB) contam como sem cor
}

function readSheet(ws) {
  let header = null;
  for (let r = 1; r <= Math.min(10, ws.rowCount) && !header; r++) {
    const cols = {};
    ws.getRow(r).eachCell((c, col) => {
      const key = HEADERS[normalizeText(plain(c))];
      if (key && !cols[key]) cols[key] = col;
    });
    if (cols.company && cols.value) header = { row: r, cols };
  }

  const declared = {};
  ws.eachRow((row) => row.eachCell((c, col) => {
    const k = DECLARED[normalizeText(plain(c))];
    if (!k) return;
    const v = plain(row.getCell(col + 1));
    if (typeof v === 'number') declared[k] = v;
  }));
  if (!header) return { name: ws.name, rows: [], declared };

  const rows = [];
  const text = (row, key) => (header.cols[key] ? String(plain(row.getCell(header.cols[key])) ?? '').trim() : '');
  for (let r = header.row + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const company = text(row, 'company');
    if (/^TOTAL\b/.test(normalizeText(company))) break;
    if (!company) continue;
    const cell = row.getCell(header.cols.value);
    const v = plain(cell);
    const isError = v && typeof v === 'object' && 'error' in v;
    rows.push({
      row: r, company, torre: text(row, 'torre'), partner: text(row, 'partner'), owner: text(row, 'owner'),
      value: typeof v === 'number' ? v : null,
      ...(isError ? { valueError: String(v.error) } : {}),
      fill: fillOf(cell),
      currency: /R\$/.test(cell.numFmt ?? '') ? 'BRL' : 'USD',
    });
  }
  return { name: ws.name, rows, declared };
}

/** @returns {{ read(path:string): Promise<import('../../domain/ingest.js').RawSheet[]> }} */
export function createWorkbookReader() {
  return {
    async read(path) {
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.readFile(path);
      return wb.worksheets.filter((ws) => ws.state !== 'veryHidden').map(readSheet);
    },
  };
}
