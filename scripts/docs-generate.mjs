#!/usr/bin/env node
// Gera docs/generated/ROUTES.md (rotas Express) e STATUS.md (legenda de cores/câmbio de config/pipeline.json).
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

const HEADER = '<!-- GERADO AUTOMATICAMENTE por scripts/docs-generate.mjs — NÃO EDITAR -->\n\n';
const ROUTE_RE = /\b(?:router|app|r)\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g;
const MOUNT_RE = /@mount\s+(\S+)/;
const joinPath = (mount, path) => (mount + (path === '/' ? '' : path)) || '/';

function walk(dir, ext) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p, ext) : p.endsWith(ext) ? [p] : [];
  }).sort();
}

export function extractRoutes(root) {
  return walk(join(root, 'src/http/routes'), '.js').flatMap((file) => {
    const src = readFileSync(file, 'utf8');
    const rel = relative(root, file).split('\\').join('/');
    const mount = (MOUNT_RE.exec(src)?.[1] ?? '').replace(/\/$/, '');
    return [...src.matchAll(ROUTE_RE)].map(([, method, path]) => ({ method: method.toUpperCase(), path: joinPath(mount, path), file: rel }));
  });
}

function routesMd(routes) {
  if (!routes.length) return `${HEADER}# Rotas HTTP\n\nNenhuma rota encontrada em \`src/http/routes/\`.\n`;
  const rows = routes.map((r) => `| ${r.method} | \`${r.path}\` | \`${r.file}\` |`).join('\n');
  return `${HEADER}# Rotas HTTP\n\n| Método | Rota | Arquivo |\n|---|---|---|\n${rows}\n`;
}

function statusMd(root) {
  const file = join(root, 'config/pipeline.json');
  if (!existsSync(file)) return `${HEADER}# Legenda de status\n\nNenhuma configuração encontrada em \`config/pipeline.json\`.\n`;
  const cfg = JSON.parse(readFileSync(file, 'utf8'));
  const colors = Object.entries(cfg.statusColors ?? {}).map(([argb, st]) => `| \`${argb}\` | ${st} |`).join('\n');
  const fx = Object.entries(cfg.fxRates ?? {}).map(([cur, rate]) => `| ${cur} | ${rate} |`).join('\n');
  const sheets = Object.entries(cfg.sheetOverrides ?? {}).map(([name, o]) => `| ${name} | \`${JSON.stringify(o)}\` |`).join('\n');
  return `${HEADER}# Legenda de status\n\nCor de preenchimento (ARGB) da célula **VALOR** → status. Cores fora da lista são ` +
    `classificadas pelo matiz (ver \`src/domain/status.js\`); sem preenchimento = \`open\`.\n\n` +
    `| Cor | Status |\n|---|---|\n${colors}\n\n## Câmbio para US$\n\n| Moeda | Taxa (1 US$ =) |\n|---|---|\n${fx}\n\n` +
    `## Ajustes por aba\n\n| Aba | Ajuste |\n|---|---|\n${sheets}\n`;
}

export function generate(root = process.cwd()) {
  const out = join(root, 'docs/generated');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'ROUTES.md'), routesMd(extractRoutes(root)));
  writeFileSync(join(out, 'STATUS.md'), statusMd(root));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) generate(process.cwd());
