// Fonte da planilha: arquivo fixo (PIPELINE_FILE) ou o .xlsx mais recente de uma pasta (PIPELINE_DIR).
// A pasta pode ser a sincronizada pelo Google Drive para desktop (ver README → "Google Drive").
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { SourceUnavailableError } from '../../application/errors.js';

const isWorkbook = (name) => /\.xlsx$/i.test(name) && !name.startsWith('~$') && !name.startsWith('.');

/** @param {{file?:string|null, dir:string}} opts */
export function createFolderSource({ file = null, dir }) {
  const describe = (path) => {
    const st = statSync(path);
    return { path, name: basename(path), mtimeMs: st.mtimeMs, size: st.size };
  };
  return {
    location: file ?? dir,
    current() {
      if (file) {
        if (!existsSync(file)) throw new SourceUnavailableError(`Planilha não encontrada: ${file}`);
        return describe(file);
      }
      if (!existsSync(dir)) throw new SourceUnavailableError(`Pasta da planilha não encontrada: ${dir}`);
      const candidates = readdirSync(dir).filter(isWorkbook).map((n) => describe(join(dir, n)));
      if (!candidates.length) throw new SourceUnavailableError(`Nenhuma planilha .xlsx em ${dir}`);
      return candidates.sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
    },
  };
}
