import { describe, it, expect } from 'vitest';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWorkbookReader } from '../../src/infrastructure/xlsx/pipeline-workbook-reader.js';
import { createFolderSource } from '../../src/infrastructure/source/folder-source.js';
import { openPipelineDb, replaceAll, readDataset, createSqliteStore } from '../../src/infrastructure/sqlite/pipeline-db.js';
import { createWorkbookStore } from '../../src/application/workbook-store.js';
import { createAnalyticsService } from '../../src/application/analytics-service.js';
import { SourceUnavailableError } from '../../src/application/errors.js';
import { samplePipelineDir, makeRealService, TEST_CONFIG } from '../helpers.js';

const strip = (o) => JSON.parse(JSON.stringify(o, (k, v) => (k === 'id' ? undefined : v)));

async function importSample() {
  const dir = await samplePipelineDir();
  const xlsx = createWorkbookStore({ source: createFolderSource({ dir }), reader: createWorkbookReader(), config: TEST_CONFIG });
  const data = await xlsx.load();
  const path = join(mkdtempSync(join(tmpdir(), 'pipe-db-')), 'pipeline.db');
  const db = openPipelineDb(path);
  const counts = replaceAll(db, { ...data, source: xlsx.describe(), at: '2026-09-30T12:00:00.000Z' });
  db.close();
  return { dir, path, data, counts };
}

describe('SQLite (node:sqlite)', () => {
  it('replaceAll + readDataset devolvem o mesmo que a ingestão da planilha', async () => {
    const { path, data, counts } = await importSample();
    expect(counts).toEqual({ periods: 3, deals: 7, issues: data.issues.length });
    const db = openPipelineDb(path);
    const back = readDataset(db);
    db.close();
    expect(strip(back.deals)).toEqual(strip(data.deals));
    expect(back.snapshots).toEqual(data.snapshots);
    expect(back.issues).toEqual(data.issues);
    expect(back.imported).toMatchObject({ at: '2026-09-30T12:00:00.000Z', sourceName: 'pipeline.xlsx' });
  });

  it('reimportar substitui tudo e registra nova importação', async () => {
    const { path, data } = await importSample();
    const db = openPipelineDb(path);
    replaceAll(db, { ...data, deals: data.deals.slice(0, 2), snapshots: data.snapshots.slice(0, 1), issues: [] });
    expect(db.prepare('SELECT count(*) n FROM deals').get().n).toBe(2);
    expect(db.prepare('SELECT count(*) n FROM imports').get().n).toBe(2);
    expect(() => replaceAll(db, { deals: [{ sheet: 'Zzz' }], snapshots: [], issues: [] })).toThrow(/sem período/);
    expect(db.prepare('SELECT count(*) n FROM deals').get().n).toBe(2); // rollback
    db.close();
  });

  it('store: serviço sobre a base dá os mesmos resultados que sobre a planilha', async () => {
    const { dir, path } = await importSample();
    const viaDb = createAnalyticsService({ store: createSqliteStore({ path }), config: TEST_CONFIG, clock: { now: () => new Date('2026-09-30T12:00:00') } });
    const viaXlsx = makeRealService(dir);
    for (const [m, arg] of [['comparison', {}], ['breakdowns', { granularity: 'quarter' }], ['deals', {}], ['simulation', { target: 1000 }], ['issues']]) {
      expect(strip(await viaDb[m](arg))).toEqual(strip(await viaXlsx[m](arg)));
    }
    const ov = await viaDb.overview();
    expect(ov.source).toMatchObject({ kind: 'sqlite', name: 'pipeline.db', location: path });
    expect(ov.source.imported.sourceName).toBe('pipeline.xlsx');
    expect(ov.dealCount).toBe(7);
  });

  it('erros legíveis: base inexistente ou vazia', async () => {
    const missing = join(mkdtempSync(join(tmpdir(), 'pipe-db-')), 'nao.db');
    expect(() => createSqliteStore({ path: missing }).describe()).toThrow(SourceUnavailableError);
    const empty = join(mkdtempSync(join(tmpdir(), 'pipe-db-')), 'vazia.db');
    openPipelineDb(empty).close();
    await expect(createSqliteStore({ path: empty }).load()).rejects.toThrow(/vazia/);
  });
});
