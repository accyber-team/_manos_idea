# Análise de Pipeline de Vendas — AC CyberPro

Dashboard gerencial que lê a planilha de pipeline (`.xlsx`, uma aba por mês) e compara os ciclos de vendas
de 2025 × 2026: vendido, DPD, perdido e em aberto por período, quebras por torre/parceiro/responsável,
simulação Monte Carlo do fechamento do ano, conferência de qualidade dos dados e exportação em XLSX.

## Requisitos

- Node.js ≥ 22.13 (`node -v`) — usa o SQLite embutido (`node:sqlite`), sem dependência nativa
- Para (re)importar: a planilha `1. Pipeline ACCyber Pro.xlsx` (ou qualquer `.xlsx` no mesmo formato)

## Rodando

```bash
npm install
npm run db:import    # carrega a planilha na base data/pipeline.db (primeira vez ou quando a planilha mudar)
npm start            # http://127.0.0.1:3737
npm run dev          # idem, reinicia ao salvar arquivos de src/
```

O servidor lê a **base de dados SQLite** `data/pipeline.db`. A planilha é apenas a origem da importação.
Nem a base nem a planilha são versionadas (`.gitignore`): em cada máquina, coloque o `.xlsx` na raiz do projeto
(ou aponte `PIPELINE_DIR`/`PIPELINE_FILE`) e gere a base:

```bash
npm run db:import                                    # .xlsx mais recente da raiz do projeto
npm run db:import -- --file "/caminho/pipeline.xlsx" # planilha específica
```

Cada importação substitui todo o conteúdo da base (períodos, oportunidades e pendências de qualidade) e fica
registrada na tabela `imports`; o cabeçalho das páginas mostra a data e a planilha de origem. O botão **Recarregar**
relê a base (ela também é relida automaticamente quando o arquivo muda).

| Variável          | Efeito                                                                              |
|-------------------|-------------------------------------------------------------------------------------|
| `PIPELINE_SOURCE` | `sqlite` (padrão) lê a base; `xlsx` lê a planilha diretamente                       |
| `PIPELINE_DB`     | Caminho do arquivo SQLite (padrão: `data/pipeline.db`)                              |
| `PIPELINE_DIR`    | Pasta onde fica a planilha (pega o `.xlsx` mais recente) — importação / modo `xlsx` |
| `PIPELINE_FILE`   | Caminho fixo de uma planilha (tem prioridade sobre a pasta)                         |
| `PIPELINE_CONFIG` | JSON de configuração (padrão: `config/pipeline.json`)                               |
| `PORT` / `HOST`   | Porta e interface HTTP (padrão `3737` / `127.0.0.1`)                                |

### Google Drive

Instale o *Google Drive para desktop*, deixe a pasta do pipeline disponível offline e aponte `PIPELINE_DIR` para ela
ao importar, ex.:

```bash
PIPELINE_DIR="$HOME/Library/CloudStorage/GoogleDrive-conta@empresa/Meu Drive/Comercial/Pipeline" npm run db:import
```

### Esquema da base (`data/pipeline.db`)

| Tabela    | Conteúdo |
|-----------|----------|
| `periods` | Uma linha por aba mensal: `sheet`, `year`, `months` (ex.: `1,2` para "Até Fev"), `note` |
| `deals`   | Oportunidades: `period_id`, `company`, `torre`, `partner`, `owner`, `status` (`won`/`delayed`/`lost`/`open`), `value_cents` (US$), `original_cents`, `currency`, `deal_key` (identidade entre meses), `source_row` |
| `issues`  | Pendências de qualidade detectadas na importação (`level`, `sheet`, `code`, `message`, `source_row`) |
| `imports` | Histórico: `imported_at`, planilha de origem, contagens |

## Relatório automatizado

```bash
npm run report                          # gera reports/analise-pipeline-AAAA-MM-DD.xlsx e imprime um resumo JSON
npm run report -- --out /caminho/x.xlsx
```

## Páginas e API

| Página            | JSON equivalente        |
|-------------------|-------------------------|
| `/` comparativo   | `/api/comparativo`, `/api/quebras`, `/api/visao-geral` |
| `/oportunidades`  | `/api/oportunidades`    |
| `/simulacao`      | `/api/simulacao`        |
| `/qualidade`      | `/api/qualidade`        |
| `/exportar.xlsx`  | —                       |
| `/health`         | estado da fonte         |

Parâmetros aceitos estão em `docs/SPEC.md`; a lista de rotas é gerada em `docs/generated/ROUTES.md` (`npm run docs:generate`).

## Configuração (`config/pipeline.json`)

- `compareYears`: os dois anos comparados; `baseYear`: ano das abas sem sufixo (ex.: "Setembro").
- `statusColors`: cor ARGB da célula **VALOR** → status (`won`, `delayed`, `lost`, `open`). Tons próximos caem na classificação por matiz.
- `fxRates`: conversão para US$ (ex.: `"BRL": 5.8`).
- `sheetOverrides`: ajustes por aba (status padrão, moeda). `ignoreSheets`: abas ignoradas.
- `simulation`: número de cenários e semente padrão.

## Desenvolvimento

```bash
npm test             # unitários + integração (vitest) e testes dos hooks
npm run test:cov     # cobertura
npm run lint
```

Veja `CLAUDE.md` (convenções) e `docs/ARCHITECTURE.md` (camadas e decisões).
