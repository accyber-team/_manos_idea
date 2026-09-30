import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { changedSince, parseLstart, isLauncher } from './server-lib.mjs';

function project() {
  const root = mkdtempSync(join(tmpdir(), 'srv-'));
  for (const d of ['src/http', 'config', 'test', 'docs', 'node_modules/pkg']) mkdirSync(join(root, d), { recursive: true });
  const files = ['src/http/app.js', 'config/a.json', 'package.json', 'test/a.test.js', 'docs/SPEC.md', 'node_modules/pkg/i.js'];
  const old = new Date('2026-01-01T00:00:00Z');
  for (const f of files) { writeFileSync(join(root, f), 'x'); utimesSync(join(root, f), old, old); }
  return root;
}
const touch = (root, f) => { const now = new Date(); utimesSync(join(root, f), now, now); };

test('changedSince: nada mudou depois do início do servidor', () => {
  const root = project();
  assert.deepEqual(changedSince(root, Date.parse('2026-06-01T00:00:00Z')), []);
});

test('changedSince: detecta src, config e package.json', () => {
  const root = project();
  const since = Date.now() - 1000;
  for (const f of ['src/http/app.js', 'config/a.json', 'package.json']) touch(root, f);
  assert.deepEqual(changedSince(root, since).sort(), ['config/a.json', 'package.json', 'src/http/app.js']);
});

test('changedSince: ignora testes, docs e node_modules', () => {
  const root = project();
  const since = Date.now() - 1000;
  for (const f of ['test/a.test.js', 'docs/SPEC.md', 'node_modules/pkg/i.js']) touch(root, f);
  assert.deepEqual(changedSince(root, since), []);
});

test('parseLstart: data do ps (macOS/Linux) em ms', () => {
  const ms = parseLstart('Wed Sep 30 13:02:02 2026');
  assert.equal(new Date(ms).getFullYear(), 2026);
  assert.equal(new Date(ms).getHours(), 13);
  assert.ok(Number.isNaN(parseLstart('')));
});

test('isLauncher: npm start e node --watch são encerrados junto', () => {
  assert.equal(isLauncher('npm start'), true);
  assert.equal(isLauncher('npm run dev'), true);
  assert.equal(isLauncher('node --watch src/server.js'), true);
  assert.equal(isLauncher('/bin/zsh -c npm start'), false);
  assert.equal(isLauncher('node src/server.js'), false);
});
