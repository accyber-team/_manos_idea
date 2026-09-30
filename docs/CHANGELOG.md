# Changelog

## 2026-09-30

- Projeto iniciado a partir do repositório `accyber-team/_manos_idea` (primeiro commit continha domínio, serviço, HTTP e testes).
- Adicionados os arquivos que faltavam para executar a aplicação:
  - `src/compose.js` (composição pelas variáveis de ambiente) e `src/server.js` (ponto de entrada, `PORT`/`HOST`).
  - `src/http/public/` — `css/app.css`, `js/common.js`, `js/charts.js`, `js/dashboard.js`, `js/simulation.js`.
  - `scripts/report.mjs` (`npm run report`).
  - `README.md`, `CLAUDE.md`, `docs/SPEC.md`, `docs/ARCHITECTURE.md`, este changelog e `docs/generated/` (via `npm run docs:generate`).
- Padrão de fonte: `.xlsx` mais recente da raiz do projeto quando `PIPELINE_DIR`/`PIPELINE_FILE` não são definidos.
- Porta HTTP padrão alterada de `3000` para `3737` (`src/server.js`, hook `server-restart`, README e CLAUDE.md), evitando
  conflito com outros servidores locais na 3000. `PORT` continua sobrescrevendo.
- **Base de dados SQLite como fonte primária** (`data/pipeline.db`, via `node:sqlite` embutido — Node ≥ 22.13):
  - `src/infrastructure/sqlite/pipeline-db.js`: schema (`periods`, `deals`, `issues`, `imports`), `replaceAll`, `readDataset`
    e `createSqliteStore` (port `store`).
  - `src/application/workbook-store.js`: a leitura da planilha (source + reader + ingest) vira um adaptador do mesmo port.
  - `analytics-service` passa a receber `store` (mantém `source`+`reader` por compatibilidade); `overview.source` ganha
    `kind` e `imported` (data/origem da última importação), exibidos no cabeçalho.
  - `scripts/db-import.mjs` / `npm run db:import`: importa a planilha para a base (substitui tudo, em transação).
  - `src/compose.js`: `PIPELINE_SOURCE=sqlite` (padrão) ou `xlsx`; `PIPELINE_DB` (padrão `data/pipeline.db`).
  - Scripts `npm` e o hook `server-restart` rodam o Node com `--disable-warning=ExperimentalWarning`.
  - Testes: `test/integration/sqlite-store.test.js` (ida e volta, reimportação com rollback, equivalência com a planilha).
- Massa de dados fora do git: `data/` (base SQLite) e `*.xlsx` (planilha) entram no `.gitignore`; a planilha original
  deixa de ser rastreada (permanece no disco). A base é criada localmente com `npm run db:import`.
