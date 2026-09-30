#!/usr/bin/env node
// Importa a planilha de pipeline para a base SQLite (substitui todo o conteúdo) e imprime um resumo JSON.
// Uso: npm run db:import [-- --file caminho.xlsx] [--db caminho.db]
//   (também aceita PIPELINE_FILE / PIPELINE_DIR / PIPELINE_DB / PIPELINE_CONFIG)
import { resolve } from 'node:path';
import { composeWorkbookStore, dbPath, loadConfig } from '../src/compose.js';
import { openPipelineDb, replaceAll } from '../src/infrastructure/sqlite/pipeline-db.js';

const arg = (name) => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : undefined; };
const env = { ...process.env };
if (arg('--file')) env.PIPELINE_FILE = resolve(arg('--file'));
if (arg('--db')) env.PIPELINE_DB = resolve(arg('--db'));

const store = composeWorkbookStore(env, loadConfig(env));
const source = store.describe();
const data = await store.load();
const path = dbPath(env);
const db = openPipelineDb(path);
let counts;
try {
  counts = replaceAll(db, { ...data, source });
} finally {
  db.close();
}
const levels = { error: 0, warning: 0, info: 0 };
for (const i of data.issues) levels[i.level]++;
console.log(JSON.stringify({ db: path, source: source.path, ...counts, issueLevels: levels }, null, 2));
