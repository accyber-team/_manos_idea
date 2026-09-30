# Análise de Pipeline de Vendas

Node ≥ 22.13, ESM, sem transpilação. Express 5 + EJS + Fomantic-UI + ECharts (servidos de `node_modules`, sem build).
Base de dados SQLite embutida (`node:sqlite`) em `data/pipeline.db`, alimentada pela planilha.

## Comandos

- `npm run db:import` — importa a planilha (.xlsx) para `data/pipeline.db` (substitui tudo; `-- --file x.xlsx`)
- `npm start` / `npm run dev` — servidor em `http://127.0.0.1:3737` (`PORT`, `PIPELINE_SOURCE=sqlite|xlsx`, `PIPELINE_DB`, `PIPELINE_DIR`, `PIPELINE_FILE`)
- `npm test` — vitest (unit + integration) e `node --test .claude/hooks/`
- `npm run lint` — eslint
- `npm run report` — relatório XLSX em `reports/`
- `npm run docs:generate` — regenera `docs/generated/` (rotas e legenda de status)

## Estrutura

- `src/domain/` — regras puras (períodos, status por cor, ingestão, comparação, simulação). Sem I/O.
- `src/application/analytics-service.js` — casos de uso; ports injetados (`store`, `writer`, `clock`);
  `workbook-store.js` adapta planilha (source + reader + ingest) ao port `store`.
- `src/infrastructure/` — `sqlite/` (base: schema, `replaceAll`, `readDataset`, `createSqliteStore`), exceljs
  (leitura/escrita) e fonte de arquivo/pasta.
- `src/http/` — Express: `app.js` (createApp), `routes/`, `views/` (EJS), `public/` (CSS/JS).
- `src/compose.js` — monta as dependências reais a partir do ambiente; `src/server.js` sobe o HTTP.
- `config/pipeline.json` — validado por `src/domain/config-schema.js` (zod).

## Convenções

- Valores monetários em **centavos inteiros** (US$); conversão de BRL na ingestão via `fxRates`.
- Status vem da **cor** da célula VALOR na importação e fica explícito em `deals.status` na base; cores de status
  são reservadas e sempre acompanham ícone + rótulo.
- A base guarda exatamente o que `ingest` produz; o domínio nunca depende de onde os dados vieram.
- Cores dos anos nos gráficos: `y0` (ano base) laranja `#c26a1b`, `y1` (ano atual) azul `#1f6fd0`.
- Textos de interface em português; código e identificadores em inglês.
- Testes: unitários por módulo de domínio em `test/unit/`, ponta a ponta com XLSX real em `test/integration/`.
- Documentação viva: alterações em `src/`, `config/`, `scripts/` ou `package.json` exigem atualizar
  `docs/CHANGELOG.md` (sempre) e, conforme o impacto, `docs/SPEC.md`, `docs/ARCHITECTURE.md` e este arquivo
  (hook `docs-guard` bloqueia o fim do turno caso contrário).
- Rotas em `src/http/routes/*.js` levam o comentário `// @mount /caminho` para o gerador de docs.
