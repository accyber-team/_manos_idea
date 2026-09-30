// Base de dados SQLite (node:sqlite, embutido no Node ≥ 22.13): fonte primária do dashboard.
// Guarda o resultado da ingestão (períodos, oportunidades com status explícito, pendências) e o histórico de
// importações. `createSqliteStore` implementa o port `store` do analytics-service; `replaceAll` é usado por
// scripts/db-import.mjs para (re)carregar a base a partir da planilha.
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { SourceUnavailableError } from '../../application/errors.js';

export const SCHEMA_VERSION = 1;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS periods (
  id INTEGER PRIMARY KEY,
  sheet TEXT NOT NULL UNIQUE,
  year INTEGER NOT NULL,
  months TEXT NOT NULL,
  note TEXT
);
CREATE TABLE IF NOT EXISTS deals (
  id INTEGER PRIMARY KEY,
  period_id INTEGER NOT NULL REFERENCES periods(id) ON DELETE CASCADE,
  source_row INTEGER,
  deal_key TEXT NOT NULL,
  company TEXT NOT NULL,
  torre TEXT NOT NULL,
  partner TEXT NOT NULL,
  owner TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('won', 'delayed', 'lost', 'open')),
  value_cents INTEGER NOT NULL,
  original_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD'
);
CREATE INDEX IF NOT EXISTS deals_period ON deals(period_id);
CREATE TABLE IF NOT EXISTS issues (
  id INTEGER PRIMARY KEY,
  level TEXT NOT NULL CHECK (level IN ('error', 'warning', 'info')),
  sheet TEXT NOT NULL,
  code TEXT NOT NULL,
  message TEXT NOT NULL,
  source_row INTEGER
);
CREATE TABLE IF NOT EXISTS imports (
  id INTEGER PRIMARY KEY,
  imported_at TEXT NOT NULL,
  source_path TEXT,
  source_name TEXT,
  source_mtime_ms REAL,
  period_count INTEGER NOT NULL,
  deal_count INTEGER NOT NULL,
  issue_count INTEGER NOT NULL
);
`;

/** Abre (criando pasta e schema se preciso) e devolve a conexão. Chame `close()` ao terminar. */
export function openPipelineDb(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(SCHEMA);
  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  return db;
}

const monthsOf = (text) => text.split(',').map(Number);

/** Linhas do banco → mesmas estruturas que `ingest()` produz (deals, snapshots, issues). */
export function readDataset(db) {
  const periods = db.prepare('SELECT id, sheet, year, months, note FROM periods').all()
    .map((p) => ({ ...p, months: monthsOf(p.months), month: monthsOf(p.months).at(-1) }))
    .sort((a, b) => a.year - b.year || a.month - b.month);
  const byId = new Map(periods.map((p) => [p.id, p]));
  const deals = db.prepare(`SELECT id, period_id, source_row, deal_key, company, torre, partner, owner, status,
      value_cents, original_cents, currency FROM deals ORDER BY period_id, id`).all().map((r) => {
    const p = byId.get(r.period_id);
    return {
      id: r.id, sheet: p.sheet, row: r.source_row, year: p.year, months: p.months, month: p.month,
      company: r.company, partner: r.partner, torre: r.torre, owner: r.owner, dealKey: r.deal_key,
      status: r.status, valueCents: r.value_cents, originalCents: r.original_cents, currency: r.currency,
    };
  });
  const snapshots = periods.map((p) => {
    const mine = deals.filter((d) => d.sheet === p.sheet);
    return { sheet: p.sheet, year: p.year, months: p.months, month: p.month, dealCount: mine.length,
      decided: mine.some((d) => d.status !== 'open'), ...(p.note ? { note: p.note } : {}) };
  });
  const issues = db.prepare('SELECT level, sheet, code, message, source_row FROM issues ORDER BY id').all()
    .map(({ source_row, ...i }) => ({ ...i, ...(source_row ? { row: source_row } : {}) }));
  const last = db.prepare('SELECT imported_at, source_path, source_name, source_mtime_ms FROM imports ORDER BY id DESC LIMIT 1').get();
  const imported = last ? { at: last.imported_at, sourcePath: last.source_path, sourceName: last.source_name, sourceMtimeMs: last.source_mtime_ms } : null;
  return { deals, snapshots, issues, imported };
}

/**
 * Substitui todo o conteúdo pelo resultado de uma ingestão (transação única) e registra a importação.
 * @param {import('node:sqlite').DatabaseSync} db
 * @param {{deals:object[], snapshots:object[], issues:object[], source?:{path?:string,name?:string,mtimeMs?:number}, at?:string}} data
 */
export function replaceAll(db, { deals, snapshots, issues, source = {}, at = new Date().toISOString() }) {
  const insPeriod = db.prepare('INSERT INTO periods (sheet, year, months, note) VALUES (?, ?, ?, ?)');
  const insDeal = db.prepare(`INSERT INTO deals (period_id, source_row, deal_key, company, torre, partner, owner, status,
    value_cents, original_cents, currency) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insIssue = db.prepare('INSERT INTO issues (level, sheet, code, message, source_row) VALUES (?, ?, ?, ?, ?)');
  const insImport = db.prepare(`INSERT INTO imports (imported_at, source_path, source_name, source_mtime_ms, period_count, deal_count, issue_count)
    VALUES (?, ?, ?, ?, ?, ?, ?)`);
  db.exec('BEGIN');
  try {
    db.exec('DELETE FROM deals; DELETE FROM periods; DELETE FROM issues;');
    const periodId = new Map();
    for (const s of snapshots) {
      const r = insPeriod.run(s.sheet, s.year, s.months.join(','), s.note ?? null);
      periodId.set(s.sheet, Number(r.lastInsertRowid));
    }
    for (const d of deals) {
      const pid = periodId.get(d.sheet);
      if (pid == null) throw new Error(`Oportunidade sem período correspondente: ${d.sheet}`);
      insDeal.run(pid, d.row ?? null, d.dealKey, d.company, d.torre, d.partner, d.owner, d.status,
        d.valueCents, d.originalCents, d.currency ?? 'USD');
    }
    for (const i of issues) insIssue.run(i.level, i.sheet, i.code, i.message, i.row ?? null);
    insImport.run(at, source.path ?? null, source.name ?? null, source.mtimeMs ?? null, snapshots.length, deals.length, issues.length);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return { periods: snapshots.length, deals: deals.length, issues: issues.length };
}

/**
 * Port `store` sobre um arquivo SQLite. A conexão é aberta a cada leitura (barata) para enxergar
 * importações feitas por outro processo; o cache do serviço usa o mtime do arquivo.
 * @param {{path:string}} opts
 */
export function createSqliteStore({ path }) {
  const missing = () => new SourceUnavailableError(`Base de dados não encontrada: ${path} (rode "npm run db:import" para criá-la a partir da planilha)`);
  return {
    kind: 'sqlite',
    location: path,
    describe() {
      if (!existsSync(path)) throw missing();
      const st = statSync(path);
      return { kind: 'sqlite', path, name: basename(path), mtimeMs: st.mtimeMs, size: st.size };
    },
    async load() {
      if (!existsSync(path)) throw missing();
      const db = openPipelineDb(path);
      try {
        const data = readDataset(db);
        if (!data.snapshots.length) throw new SourceUnavailableError(`Base de dados vazia: ${path} (rode "npm run db:import")`);
        return data;
      } finally {
        db.close();
      }
    },
  };
}
