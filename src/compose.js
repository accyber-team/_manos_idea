// Composição das dependências reais a partir do ambiente (usada por src/server.js e scripts/*.mjs).
//   PIPELINE_SOURCE sqlite (padrão) lê a base data/pipeline.db; xlsx lê a planilha diretamente
//   PIPELINE_DB     caminho do arquivo SQLite; padrão: data/pipeline.db
//   PIPELINE_FILE   caminho fixo de um .xlsx (tem prioridade sobre PIPELINE_DIR)
//   PIPELINE_DIR    pasta onde fica a planilha (pega o .xlsx mais recente); padrão: raiz do projeto
//   PIPELINE_CONFIG caminho do JSON de configuração; padrão: config/pipeline.json
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePipelineConfig } from './domain/config-schema.js';
import { createFolderSource } from './infrastructure/source/folder-source.js';
import { createWorkbookReader } from './infrastructure/xlsx/pipeline-workbook-reader.js';
import { createXlsxReportWriter } from './infrastructure/export/xlsx-report-writer.js';
import { createSqliteStore } from './infrastructure/sqlite/pipeline-db.js';
import { createWorkbookStore } from './application/workbook-store.js';
import { createAnalyticsService } from './application/analytics-service.js';

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function loadConfig(env = process.env) {
  const path = resolve(env.PIPELINE_CONFIG || join(projectRoot, 'config', 'pipeline.json'));
  return parsePipelineConfig(JSON.parse(readFileSync(path, 'utf8')));
}

export const dbPath = (env = process.env) => resolve(env.PIPELINE_DB || join(projectRoot, 'data', 'pipeline.db'));

/** Store sobre a planilha (.xlsx): usado no modo xlsx e pelo script de importação. */
export function composeWorkbookStore(env = process.env, config = loadConfig(env)) {
  const source = createFolderSource({
    file: env.PIPELINE_FILE ? resolve(env.PIPELINE_FILE) : null,
    dir: resolve(env.PIPELINE_DIR || projectRoot),
  });
  return createWorkbookStore({ source, reader: createWorkbookReader(), config });
}

export function composeStore(env = process.env, config = loadConfig(env)) {
  const mode = (env.PIPELINE_SOURCE || 'sqlite').toLowerCase();
  if (mode === 'sqlite') return createSqliteStore({ path: dbPath(env) });
  if (mode === 'xlsx') return composeWorkbookStore(env, config);
  throw new Error(`PIPELINE_SOURCE inválido: "${env.PIPELINE_SOURCE}" (use sqlite ou xlsx)`);
}

export function composeService(env = process.env) {
  const config = loadConfig(env);
  return createAnalyticsService({
    store: composeStore(env, config), writer: createXlsxReportWriter(), config, clock: { now: () => new Date() },
  });
}
