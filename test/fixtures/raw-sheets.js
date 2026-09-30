// Abas "cruas" como o leitor de XLSX as entrega (sem exceljs), para testes de domínio/aplicação.
const G = 'FF00FF00'; const Y = 'FFFFFF00'; const R = 'FFFF0000';
const row = (row, company, torre, partner, value, fill, owner = 'ANA', currency = 'USD') =>
  ({ row, company, torre, partner, owner, value, fill, currency });

export const CONFIG = {
  baseYear: 2025,
  statusColors: { [G]: 'won', [Y]: 'delayed', [R]: 'lost' },
  fxRates: { BRL: 5 },
  sheetOverrides: { 'Até Fev': { defaultStatus: 'won' } },
  ignoreSheets: ['Consolidado'],
};

export const rawSheets = () => [
  { name: 'Consolidado', rows: [], declared: {} },
  { name: 'Até Fev', declared: { won: 1500 }, rows: [
    row(3, 'ALFA', 'SOLUÇÃO', 'DROPBOX', 1000, null, 'ANA', 'BRL'),
    row(4, 'BETA', 'SERVIÇO', 'MSS', 500, 'FFFFFFFF', 'BIA', 'BRL'),
  ] },
  { name: 'Março', declared: { won: 100, lost: 50, delayed: 999 }, rows: [
    row(3, 'GAMA', 'SOLUCAO', 'FIGMA', 100, G),
    row(4, 'DELTA', 'SERVICO', 'MSS', 50, R),
    row(5, 'EPS', 'SOLUCAO', 'CHECK POINT', 200, Y),
    row(6, 'ZETA', 'SOLUCAO', 'FIGMA', 40, Y),
  ] },
  { name: 'Abril', declared: {}, rows: [
    row(3, 'EPS', 'SOLUCAO', 'CHECKPOINT', 200, G), // DPD de março vendido em abril
    row(4, 'ETA', 'SOLUCAO', 'FIGMA', 30, Y),
    row(5, 'TETA', 'SERVICO', 'MSS', 20, 'FF0000FF'), // cor desconhecida
    row(6, 'IOTA', 'SERVICO', 'MSS', null, G, 'ANA', 'USD'),
  ] },
  { name: 'Jan26', declared: {}, rows: [
    row(3, 'ALFA', 'SOLUCAO', 'DROPBOX', 300, G),
    row(4, 'KAPA', 'SERVICO', 'MSS', 100, Y),
  ] },
  { name: 'Fev26', declared: {}, rows: [
    row(3, 'KAPA', 'SERVICO', 'MSS', 100, R),
    row(4, 'LAMBDA', 'SOLUCAO', 'FIGMA', 60, G),
  ] },
  { name: 'Mar26', declared: {}, rows: [
    row(3, 'MI', 'SOLUCAO', 'FIGMA', 80, G),
    row(4, 'NI', 'SOLUCAO', 'FIGMA', 70, Y),
    row(5, 'XI', 'SERVICO', 'MSS', 10, R),
  ] },
  { name: 'Abr26', declared: {}, rows: [
    row(3, 'NI', 'SOLUCAO', 'FIGMA', 70, null),
    row(4, 'OMI', 'SOLUCAO', 'DROPBOX', 25, null),
  ] },
];
