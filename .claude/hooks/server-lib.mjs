// Lógica do hook de reinício do servidor local (ver docs/ARCHITECTURE.md §8).
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// O que o servidor carrega em runtime: código, views e configuração (a planilha é relida sozinha pelo mtime).
const WATCHED_DIRS = ['src', 'config'];
const WATCHED_FILES = ['package.json'];

/** Arquivos (relativos) observados com mtime posterior a `since` (ms). */
export function changedSince(root, since) {
  const out = [];
  const walk = (rel) => {
    const abs = join(root, rel);
    for (const e of readdirSync(abs, { withFileTypes: true })) {
      const child = `${rel}/${e.name}`;
      if (e.isDirectory()) walk(child);
      else if (statSync(join(root, child)).mtimeMs > since) out.push(child);
    }
  };
  for (const d of WATCHED_DIRS) if (existsSync(join(root, d))) walk(d);
  for (const f of WATCHED_FILES) {
    const abs = join(root, f);
    if (existsSync(abs) && statSync(abs).mtimeMs > since) out.push(f);
  }
  return out;
}

/** `ps -o lstart=` → ms (NaN se vazio/inválido). */
export const parseLstart = (s) => (s && s.trim() ? Date.parse(s.trim()) : NaN);

/** Processo pai que também precisa sair (senão o `--watch` ou o npm ficam órfãos/disputam a porta). */
export const isLauncher = (cmd) => /^(npm (start|run dev)|node --watch)\b/.test(String(cmd).trim());
