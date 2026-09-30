// Lógica pura + estado dos hooks de documentação viva (ver docs/ARCHITECTURE.md §8).
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, isAbsolute } from 'node:path';

const CODE = /^(src\/|config\/|scripts\/|package\.json$)/;
const DOC = /^(docs\/(?!generated\/)[^/]+\.md|docs\/adr\/.+\.md|CLAUDE\.md|README\.md)$/;
const REGEN = /^(src\/http\/routes\/|config\/pipeline\.json$)/;

export function toRelative(root, filePath) {
  if (!filePath) return null;
  const rel = isAbsolute(filePath) ? relative(root, filePath) : filePath;
  return rel.split('\\').join('/');
}

export function classify(rel) {
  if (!rel || rel.startsWith('..')) return 'other';
  if (DOC.test(rel)) return 'doc';
  if (CODE.test(rel)) return 'code';
  return 'other';
}

export const needsRegeneration = (rel) => !!rel && REGEN.test(rel);

export function evaluate({ code, docs }) {
  if (code.length === 0 || docs.length > 0) return { block: false };
  const list = code.slice(0, 20).map((f) => `  - ${f}`).join('\n');
  return {
    block: true,
    reason:
      `Código alterado nesta sessão sem atualização da documentação:\n${list}\n` +
      'Antes de encerrar, atualize conforme o impacto: docs/SPEC.md (requisitos, variáveis, rotas, telas), ' +
      'docs/ARCHITECTURE.md (camadas, dependências, dados, ADRs), CLAUDE.md (comandos/convenções) e ' +
      'SEMPRE docs/CHANGELOG.md. Se não houver impacto em requisitos/arquitetura, registre isso no CHANGELOG.',
  };
}

const stateFile = (root, session) =>
  join(root, '.claude', 'state', `docs-${String(session || 'default').replace(/[^\w-]/g, '_')}.json`);

export function loadState(root, session) {
  try {
    return JSON.parse(readFileSync(stateFile(root, session), 'utf8'));
  } catch {
    return { code: [], docs: [] };
  }
}

export function recordChange(root, session, kind, rel) {
  const state = loadState(root, session);
  if (kind === 'code' && state.code.length === 0) state.since = Date.now();
  const key = kind === 'doc' ? 'docs' : 'code';
  if (!state[key].includes(rel)) state[key].push(rel);
  mkdirSync(join(root, '.claude', 'state'), { recursive: true });
  writeFileSync(stateFile(root, session), JSON.stringify(state, null, 2));
}

/**
 * Docs escritos à mão modificados em disco desde `since` (ms). Cobre edições feitas fora do
 * Edit/Write (Bash, sed, scripts), que o PostToolUse não enxerga.
 */
export function docsModifiedSince(root, since) {
  if (!since) return [];
  const candidates = ['CLAUDE.md', 'README.md'];
  const docsDir = join(root, 'docs');
  const walk = (dir) => readdirSync(dir).forEach((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else candidates.push(relative(root, p).split('\\').join('/'));
  });
  if (existsSync(docsDir)) walk(docsDir);
  return candidates.filter((rel) => classify(rel) === 'doc'
    && existsSync(join(root, rel)) && statSync(join(root, rel)).mtimeMs >= since);
}

export function resetState(root, session) {
  rmSync(stateFile(root, session), { force: true });
}

export async function readHookInput() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

export const projectRoot = (input) => process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
