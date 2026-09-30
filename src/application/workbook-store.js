// Port `store` implementado sobre a planilha: source (qual .xlsx) + reader (abas cruas) + ingest (domínio).
// Usado pelo modo PIPELINE_SOURCE=xlsx e pelo script de importação para a base SQLite.
import { ingest } from '../domain/ingest.js';

/**
 * @param {{source:{current():{path:string,name:string,mtimeMs:number}, location:string},
 *   reader:{read(path:string):Promise<any[]>}, config:object}} deps
 */
export function createWorkbookStore({ source, reader, config }) {
  return {
    kind: 'xlsx',
    location: source.location,
    describe: () => ({ kind: 'xlsx', ...source.current() }),
    async load() {
      const file = source.current();
      const { deals, snapshots, issues } = ingest(await reader.read(file.path), config);
      return { deals, snapshots, issues, imported: null };
    },
  };
}
