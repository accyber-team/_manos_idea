#!/usr/bin/env node
// Relatório automatizado: gera reports/analise-pipeline-<data>.xlsx e imprime um resumo JSON no stdout.
// Uso: npm run report [-- --out caminho.xlsx]   (variáveis de ambiente iguais às do servidor)
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { composeService, projectRoot } from '../src/compose.js';

const argOut = process.argv.indexOf('--out');
const stamp = new Date().toISOString().slice(0, 10);
const out = argOut > -1 ? resolve(process.argv[argOut + 1]) : join(projectRoot, 'reports', `analise-pipeline-${stamp}.xlsx`);

const service = composeService(process.env);
const [overview, comparison] = await Promise.all([service.overview(), service.comparison({})]);
const buf = await service.exportWorkbook({});
mkdirSync(resolve(out, '..'), { recursive: true });
writeFileSync(out, buf);

const [ya, yb] = comparison.years;
const t = comparison.total.byYear;
console.log(JSON.stringify({
  file: out, source: overview.source.name, throughMonth: comparison.throughMonth,
  won: { [ya]: t[ya]?.won.cents ?? null, [yb]: t[yb]?.won.cents ?? null }, delta: comparison.total.delta ?? null,
  issues: overview.issueCounts,
}, null, 2));
