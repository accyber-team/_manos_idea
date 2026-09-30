import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { utimesSync } from 'node:fs';
import { classify, evaluate, needsRegeneration, recordChange, loadState, resetState, docsModifiedSince } from './docs-lib.mjs';
import { generate } from '../../scripts/docs-generate.mjs';

test('classify: código-fonte', () => {
  for (const p of ['src/domain/money.js', 'config/pipeline.json', 'scripts/report.mjs', 'package.json']) {
    assert.equal(classify(p), 'code', p);
  }
});

test('classify: documentação escrita à mão', () => {
  for (const p of ['docs/SPEC.md', 'docs/ARCHITECTURE.md', 'docs/CHANGELOG.md', 'CLAUDE.md', 'README.md']) {
    assert.equal(classify(p), 'doc', p);
  }
});

test('classify: docs gerados, testes e fora do projeto não contam', () => {
  for (const p of ['docs/generated/ROUTES.md', 'test/unit/money.test.js', '.claude/hooks/x.mjs', '../fora.js', null]) {
    assert.equal(classify(p), 'other', String(p));
  }
});

test('evaluate: código sem docs bloqueia com a lista de arquivos', () => {
  const r = evaluate({ code: ['src/a.js'], docs: [] });
  assert.equal(r.block, true);
  assert.match(r.reason, /src\/a\.js/);
});

test('evaluate: código com docs ou sem código libera', () => {
  assert.equal(evaluate({ code: ['src/a.js'], docs: ['docs/CHANGELOG.md'] }).block, false);
  assert.equal(evaluate({ code: [], docs: [] }).block, false);
});

test('needsRegeneration: apenas rotas http e a configuração da planilha', () => {
  assert.equal(needsRegeneration('src/http/routes/dashboard.js'), true);
  assert.equal(needsRegeneration('config/pipeline.json'), true);
  assert.equal(needsRegeneration('config/outro.json'), false);
  assert.equal(needsRegeneration('src/domain/money.js'), false);
});

test('estado: registra sem duplicar e reseta', () => {
  const root = mkdtempSync(join(tmpdir(), 'docs-hook-'));
  recordChange(root, 's1', 'code', 'src/a.js');
  recordChange(root, 's1', 'code', 'src/a.js');
  recordChange(root, 's1', 'doc', 'docs/SPEC.md');
  const st = loadState(root, 's1');
  assert.deepEqual({ code: st.code, docs: st.docs }, { code: ['src/a.js'], docs: ['docs/SPEC.md'] });
  assert.equal(typeof st.since, 'number');
  resetState(root, 's1');
  assert.deepEqual(loadState(root, 's1'), { code: [], docs: [] });
});

test('generate: sem código ainda, cria docs vazios sem falhar', () => {
  const root = mkdtempSync(join(tmpdir(), 'docs-gen-'));
  generate(root);
  assert.match(readFileSync(join(root, 'docs/generated/ROUTES.md'), 'utf8'), /Nenhuma rota/);
  assert.match(readFileSync(join(root, 'docs/generated/STATUS.md'), 'utf8'), /Nenhuma configuração/);
});

test('generate: extrai rotas Express e a legenda de status da configuração', () => {
  const root = mkdtempSync(join(tmpdir(), 'docs-gen-'));
  mkdirSync(join(root, 'src/http/routes'), { recursive: true });
  mkdirSync(join(root, 'config'), { recursive: true });
  writeFileSync(join(root, 'src/http/routes/dashboard.js'),
    "router.get('/comparativo', list);\nrouter.post(\"/recarregar\", reload);\n");
  writeFileSync(join(root, 'config/pipeline.json'), JSON.stringify({
    statusColors: { FF00FF00: 'won', FFFFFF00: 'delayed' },
    fxRates: { BRL: 5.8 },
    sheetOverrides: { 'Até Fev': { defaultStatus: 'won' } },
  }));
  generate(root);
  const routes = readFileSync(join(root, 'docs/generated/ROUTES.md'), 'utf8');
  assert.match(routes, /\| GET \| `\/comparativo` \| `src\/http\/routes\/dashboard\.js` \|/);
  assert.match(routes, /\| POST \| `\/recarregar` \|/);
  const st = readFileSync(join(root, 'docs/generated/STATUS.md'), 'utf8');
  assert.match(st, /\| `FF00FF00` \| won \|/);
  assert.match(st, /\| BRL \| 5\.8 \|/);
  assert.match(st, /\| Até Fev \| .*won/);
  assert.ok(existsSync(join(root, 'docs/generated/STATUS.md')));
});

test('docsModifiedSince: detecta docs editados fora do Edit/Write (ex.: via Bash)', () => {
  const root = mkdtempSync(join(tmpdir(), 'docs-mtime-'));
  mkdirSync(join(root, 'docs/generated'), { recursive: true });
  writeFileSync(join(root, 'docs/SPEC.md'), 'x');
  writeFileSync(join(root, 'docs/generated/ROUTES.md'), 'x');
  writeFileSync(join(root, 'CLAUDE.md'), 'x');
  const old = new Date(Date.now() - 60_000);
  for (const f of ['docs/SPEC.md', 'docs/generated/ROUTES.md', 'CLAUDE.md']) utimesSync(join(root, f), old, old);
  const since = Date.now() - 30_000;
  assert.deepEqual(docsModifiedSince(root, since), []);
  utimesSync(join(root, 'docs/generated/ROUTES.md'), new Date(), new Date()); // gerado não conta
  assert.deepEqual(docsModifiedSince(root, since), []);
  utimesSync(join(root, 'docs/SPEC.md'), new Date(), new Date());
  assert.deepEqual(docsModifiedSince(root, since), ['docs/SPEC.md']);
  assert.deepEqual(docsModifiedSince(root, undefined), []);
});

test('generate: rotas com r.get e prefixo @mount', () => {
  const root = mkdtempSync(join(tmpdir(), 'docs-mount-'));
  mkdirSync(join(root, 'src/http/routes'), { recursive: true });
  writeFileSync(join(root, 'src/http/routes/api.js'), "// @mount /api\nr.get('/clientes', f);\nr.post('/', g);\n");
  generate(root);
  const routes = readFileSync(join(root, 'docs/generated/ROUTES.md'), 'utf8');
  assert.match(routes, /\| GET \| `\/api\/clientes` \|/);
  assert.match(routes, /\| POST \| `\/api` \|/);
});
