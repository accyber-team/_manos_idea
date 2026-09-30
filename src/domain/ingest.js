// Abas cruas da planilha → snapshots (um por aba de período), oportunidades normalizadas e pendências de qualidade.
import { classifyFill, STATUS_SHORT } from './status.js';
import { parseSheetName } from './periods.js';
import { toCents, toUsdCents, formatMoney } from './money.js';
import { normalizeText, keyOf, torreOf } from './normalize.js';

/**
 * @typedef {{row:number, company:string, torre:string, partner:string, owner:string,
 *   value:number|null, valueError?:string, fill:string|null, currency:'USD'|'BRL'}} RawRow
 * @typedef {{name:string, rows:RawRow[], declared:{won?:number, lost?:number, delayed?:number}}} RawSheet
 * @typedef {{baseYear:number, statusColors:Record<string,string>, fxRates:Record<string,number>,
 *   sheetOverrides?:Record<string,{defaultStatus?:string, currency?:string}>, ignoreSheets?:string[]}} IngestConfig
 */

const issue = (level, sheet, code, message, row) => ({ level, sheet, code, message, ...(row ? { row } : {}) });
const DECLARED = ['won', 'lost', 'delayed'];

/** @param {RawSheet[]} sheets @param {IngestConfig} config */
export function ingest(sheets, config) {
  const issues = [];
  const snapshots = [];
  const deals = [];
  const ignored = new Set((config.ignoreSheets ?? []).map(normalizeText));
  const seen = new Map();

  for (const sheet of sheets) {
    const name = sheet.name.trim();
    if (ignored.has(normalizeText(name))) continue;
    const period = parseSheetName(name, config.baseYear);
    if (!period) {
      issues.push(issue('info', name, 'sheet-ignored', 'Aba ignorada: o nome não corresponde a um período (ex.: "Setembro", "Set26").'));
      continue;
    }
    const periodKey = `${period.year}-${period.months.join(',')}`;
    if (seen.has(periodKey)) {
      issues.push(issue('warning', name, 'duplicate-period', `Aba ignorada: o período já foi lido da aba "${seen.get(periodKey)}".`));
      continue;
    }
    seen.set(periodKey, name);

    const override = config.sheetOverrides?.[name] ?? {};
    const sheetDeals = [];
    const originalByStatus = { won: 0, lost: 0, delayed: 0, open: 0 };
    let converted = null;
    let defaulted = 0;
    const occurrences = new Map();

    for (const r of sheet.rows) {
      if (!normalizeText(r.company)) continue;
      if (r.valueError) {
        issues.push(issue('error', name, 'value-error', `Linha ${r.row} (${r.company}): fórmula com erro (${r.valueError}); linha ignorada.`, r.row));
        continue;
      }
      if (typeof r.value !== 'number' || !Number.isFinite(r.value)) {
        issues.push(issue('warning', name, 'missing-value', `Linha ${r.row} (${r.company}): sem VALOR; linha ignorada.`, r.row));
        continue;
      }
      let status = classifyFill(r.fill, config.statusColors);
      if (status === null) {
        issues.push(issue('warning', name, 'unknown-color', `Linha ${r.row} (${r.company}): cor ${r.fill} sem status definido; tratada como "em aberto".`, r.row));
        status = 'open';
      }
      if (status === 'open' && override.defaultStatus) {
        status = override.defaultStatus;
        defaulted++;
      }
      const currency = override.currency ?? r.currency ?? 'USD';
      const originalCents = toCents(r.value);
      const valueCents = toUsdCents(originalCents, currency, config.fxRates);
      if (currency !== 'USD') converted = currency;
      originalByStatus[status] += originalCents;

      const company = normalizeText(r.company);
      const partner = normalizeText(r.partner);
      const baseKey = `${keyOf(company)}|${keyOf(partner)}`;
      const n = (occurrences.get(baseKey) ?? 0) + 1;
      occurrences.set(baseKey, n);
      sheetDeals.push({
        id: `${name}#${r.row}`, sheet: name, row: r.row, year: period.year, months: period.months, month: period.months.at(-1),
        company, partner, torre: torreOf(r.torre), owner: normalizeText(r.owner) || '(sem responsável)',
        dealKey: n > 1 ? `${baseKey}#${n}` : baseKey, status, valueCents, originalCents, currency,
      });
    }

    if (converted) {
      issues.push(issue('info', name, 'converted', `Valores em ${converted} convertidos para US$ à taxa ${config.fxRates[converted]}.`));
    }
    if (defaulted) {
      issues.push(issue('info', name, 'default-status', `${defaulted} linha(s) sem cor tratadas como "${override.defaultStatus}" (ajuste da aba em config/pipeline.json).`));
    }
    for (const st of DECLARED) {
      const declared = sheet.declared?.[st];
      if (typeof declared !== 'number') continue;
      const diff = originalByStatus[st] - toCents(declared);
      if (Math.abs(diff) > Math.max(100, Math.abs(toCents(declared)) * 0.005)) {
        const cur = converted ?? 'USD';
        issues.push(issue('warning', name, 'declared-mismatch',
          `Total ${STATUS_SHORT[st]} da aba (${formatMoney(toCents(declared), cur)}) difere da soma pelas cores (${formatMoney(originalByStatus[st], cur)}). ` +
          'A análise usa as cores; revise a fórmula da aba.'));
      }
    }

    snapshots.push({
      sheet: name, year: period.year, months: period.months, month: period.months.at(-1),
      dealCount: sheetDeals.length, decided: sheetDeals.some((d) => d.status !== 'open'),
      ...(defaulted ? { note: `Aba "${name}": ${defaulted} linha(s) sem cor contadas como "${override.defaultStatus}"; os percentuais desse período não são comparáveis.` } : {}),
    });
    deals.push(...sheetDeals);
  }

  snapshots.sort((a, b) => a.year - b.year || a.month - b.month);
  return { snapshots, deals, issues };
}
