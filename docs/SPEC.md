# Especificação funcional

## Objetivo

Relatórios gerenciais automatizados a partir da planilha de pipeline de vendas mantida na pasta do Google Drive,
comparando o ciclo de vendas do ano corrente com o anterior e projetando o fechamento do ano.

## Fonte de dados

A fonte primária é a **base SQLite** `data/pipeline.db` (tabelas `periods`, `deals`, `issues`, `imports`; ver README).
Ela é alimentada pela planilha via `npm run db:import`, que substitui todo o conteúdo e registra a importação.
`PIPELINE_SOURCE=xlsx` faz o servidor ler a planilha diretamente (mesmo resultado, sem base).

Regras de leitura da planilha (aplicadas na importação):

- Um arquivo `.xlsx`; uma aba por mês (`Setembro` = mês do `baseYear`; `Set26` = setembro/2026; `Até Fev` = acumulado Jan–Fev).
- Cabeçalho na linha 2: `EMPRESA, TORRE, PARCEIRO, VALOR, RESPONSAVEL`; linhas até `TOTAL`.
- Status = cor de preenchimento da célula VALOR (`config/pipeline.json → statusColors`); sem cor = em aberto.
  Na base, o status fica explícito na coluna `deals.status`.
- Moeda pelo formato numérico da célula (R$ → convertido para US$ com `fxRates`); a base guarda `value_cents` (US$),
  `original_cents` e `currency`.
- Abas em `ignoreSheets` (ex.: Consolidado) não entram na análise.
- As pendências de qualidade são calculadas na importação e guardadas em `issues`.

## Variáveis de ambiente

`PORT`, `HOST`, `PIPELINE_SOURCE`, `PIPELINE_DB`, `PIPELINE_DIR`, `PIPELINE_FILE`, `PIPELINE_CONFIG` (ver README).

## Telas

| Rota             | Conteúdo |
|------------------|----------|
| `/`              | KPIs do acumulado comparável, gráficos (vendido por período; composição por status), tabela por período e quebras por torre / parceiro / responsável. Parâmetros: `granularity` (`month|quarter|semester|year`), `method` (`flow|snapshots`), `through` (1–12). |
| `/oportunidades` | Lista filtrável: `year`, `month`, `status`, `torre`, `partner`, `owner`, `q`. |
| `/simulacao`     | Monte Carlo do fechamento do ano: `target` (US$), `history` (`all|AAAA`), `runs` (100–50000), `seed`. |
| `/qualidade`     | Pendências detectadas na leitura (erro / aviso / informação). |
| `/exportar.xlsx` | Relatório XLSX com os mesmos parâmetros do comparativo. |
| `POST /recarregar` | Força a releitura da fonte (base ou planilha) e volta para `back`. |

A API JSON em `/api/*` espelha as telas (`docs/generated/ROUTES.md`). Erros: 422 (parâmetro inválido), 503 (fonte indisponível — base inexistente/vazia ou planilha não encontrada).

## Regras principais

- **Fluxo do período**: vendidos e perdidos de todas as abas do período + pendentes só da última aba (oportunidade adiada conta uma vez).
- **Soma das abas**: soma simples dos snapshots mensais.
- Acumulado comparável: Jan até o último mês fechado do ano corrente, nos dois anos.
- Simulação: taxas de desfecho (novo / carregado / sumiu da aba seguinte) estimadas do histórico com incerteza
  Dirichlet; novas vendas por bootstrap do histórico mensal; saída P10/P50/P90, probabilidade de superar o ano
  anterior e de atingir a meta.
