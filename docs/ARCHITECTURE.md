# Arquitetura

## §1 Stack

Node ≥ 22.13 (ESM), Express 5, EJS, Fomantic-UI + jQuery, ECharts, exceljs, simple-statistics, zod, SQLite embutido
(`node:sqlite`). Sem etapa de build: os assets de `node_modules` são servidos em `/vendor/*` e os próprios em
`/static/*` (`src/http/public`). Os scripts `npm` rodam o Node com `--disable-warning=ExperimentalWarning` (aviso do `node:sqlite`).

## §2 Camadas

```
src/domain        regras puras (períodos, status por cor, ingestão, métricas, comparação, fluxo, simulação)
src/application   analytics-service: casos de uso sobre o port `store`; cache por mtime; validação de entrada (zod)
                  workbook-store: adaptador do port `store` sobre a planilha (source + reader + ingest)
src/infrastructure  sqlite (base de dados: schema, replaceAll, readDataset, store), xlsx (reader/writer via exceljs),
                  source (arquivo fixo ou pasta → .xlsx mais recente)
src/http          Express: createApp(deps), rotas, views EJS, helpers, assets
src/compose.js    composição a partir do ambiente (PIPELINE_SOURCE=sqlite|xlsx); src/server.js ponto de entrada
scripts/          db-import.mjs (planilha → base), report.mjs (relatório XLSX), docs-generate.mjs (docs geradas)
```

Dependências apontam para dentro: http → application → domain; infrastructure implementa os ports da application.
`createApp({ service })` e `createAnalyticsService({ store, writer, config, clock })` recebem tudo injetado
(`source` + `reader` ainda são aceitos e viram um `workbook-store`), o que permite testar com planilhas sintéticas
e bases temporárias (`test/helpers.js`, `test/integration/sqlite-store.test.js`).

Port `store`: `{ kind, location, describe() → {path, name, mtimeMs}, load() → {deals, snapshots, issues, imported} }`.

## §3 Dados

- `ingest(raw, config)` → `{ deals, snapshots, issues }`. Cada deal tem `year`, `month(s)`, `status`, `valueCents` (US$),
  `originalCents`/`currency`, `sheet`, `row`, `dealKey`. Snapshots descrevem cada aba (mês, meses cobertos, `decided`).
- Base SQLite (`data/pipeline.db`): `periods` (1 por aba), `deals` (status explícito, centavos, `deal_key`),
  `issues` (pendências da importação) e `imports` (histórico). `readDataset` devolve exatamente as estruturas de
  `ingest`, então o domínio não sabe de onde os dados vieram. `replaceAll` substitui tudo em uma transação.
- Valores em centavos inteiros; percentuais como frações.
- Cache em memória invalidado por `path`/`mtimeMs` da fonte (arquivo `.db` ou `.xlsx`); a conexão SQLite é aberta
  a cada leitura para enxergar importações feitas por outro processo.

## §4 Front-end

- EJS renderiza tudo no servidor; os gráficos recebem JSON em `<script type="application/json">` e são montados
  por `public/js/dashboard.js` e `public/js/simulation.js` sobre `public/js/charts.js` (paleta, formatação, resize).
- Paleta: anos `#c26a1b` (base) / `#1f6fd0` (atual), validada para daltonismo; status reservados (`src/domain/status.js`) com ícone + rótulo.

## §5 Decisões (ADRs resumidos)

1. **Status pela cor da célula** — é a convenção usada na planilha; tons fora do mapa caem na classificação por matiz e viram pendência de qualidade.
2. **Planilha lida da pasta sincronizada do Drive** — evita OAuth/API; `PIPELINE_DIR` pega o `.xlsx` mais recente.
3. **Sem build de front** — libs servidas de `node_modules`; simplicidade de deploy.
4. **Monte Carlo com posterior Dirichlet** — incorpora a incerteza das taxas com pouco histórico.
5. **Base SQLite como fonte primária, planilha como origem de importação** — `node:sqlite` embutido (zero dependência
   nativa, um arquivo em `data/`); a base guarda o resultado da ingestão (status explícito, sem depender de cores),
   o que abre caminho para manutenção direta dos dados sem a planilha. Importação substitui tudo (não há merge), pois
   a planilha ainda é a fonte de verdade enquanto existir.

## §8 Hooks do Claude Code (`.claude/hooks`)

- `docs-track` (PostToolUse) registra arquivos de código/doc editados; `docs-guard` (Stop) bloqueia o turno se
  houve código sem documentação atualizada.
- `server-restart` (Stop) reinicia `node src/server.js` se ele estiver no ar e `src/`, `config/` ou `package.json`
  mudaram depois que subiu; log em `.claude/state/server.log`.
