# Design

## Context

O monorepo já existe (mudança `setup-monorepo`): `apps/tickets-api` tem `buildApp()` separado do
`listen`, `/health`, 404 em JSON e `env.ts` com `parseEnv` puro; `packages/shared` exporta TypeScript
direto (`./src/index.ts`), sem build, e não pode depender de outros pacotes do repo. TypeScript usa
`moduleResolution: Bundler`, Vitest roda por projeto a partir da raiz, o build de produção do
`tickets-api` é um bundle `tsup` (`dist/server.js`) e o Node é 24. Motivação em `proposal.md`;
comportamento nas specs desta mudança.

## Goals / Non-Goals

**Goals:**
- Regras de prazo e o cliente HTTP prontos para o agent e o web importarem de `@nexo/shared` sem
  conhecer o `tickets-api`.
- Testes determinísticos: relógio, aleatoriedade e espera injetáveis; banco em memória por teste.
- Nada de build nativo no `pnpm install`.

**Non-Goals:**
- Rotas de analista (assumir, resolver, fechar chamados) e listagem de chamados de todos os
  funcionários: entram com o console.
- Busca semântica, paginação, feriados, chave de idempotência.

## Decisions

### 1. Onde fica cada coisa
```
packages/shared/src/
  schemas/      employee.ts article.ts ticket.ts errors.ts  (zod + tipos + rótulos pt-BR)
  rules/        business-hours.ts sla.ts reopen.ts          (puras, sem I/O)
  client/       tickets-client.ts errors.ts
  index.ts      reexporta tudo
apps/tickets-api/src/
  db/           schema.ts client.ts (Drizzle)               drizzle/ (migrações SQL versionadas)
  plugins/      errors.ts service-auth.ts instability.ts employee-context.ts
  routes/       employees.ts kb.ts tickets.ts
  tickets/      repository.ts service.ts                    (efeitos de banco + orquestração)
  search/       keywords.ts                                  (normalização e pontuação, pura)
  seed/         data.ts (buildSeed(now), puro) apply.ts cli.ts
  app.ts env.ts server.ts paths.ts
```
As regras saem do `packages/agent/src/rules/` previsto no `CLAUDE.md` para `packages/shared/src/rules/`,
porque o `tickets-api` calcula `dueAt`/`isOverdue` e não pode importar o agent; o `CLAUDE.md` é
atualizado. A busca por palavra-chave fica no `tickets-api` porque só ele a usa.

### 2. Valores de domínio em inglês, rótulos em português
`category` usa códigos (`access`, `network_vpn`, `hardware`, `software`, `email`, `other`), assim como
`priority` e `status`; `@nexo/shared` exporta mapas de rótulo (`TICKET_CATEGORY_LABELS` etc.) para a UI.
`affected` é enum `me | team | company` (Só eu, Minha equipe, A empresa toda), porque alimenta a regra de
prioridade (impacto) que o agent aplica.
- *Alternativa*: guardar "Rede e VPN" como valor. Rejeitada: acentos e espaços em enum e em filtros, e a
  convenção do repo é código em inglês.

### 3. Horas úteis com fuso explícito
`addBusinessHours(start, hours)` usa `TZDate` de `@date-fns/tz` em `America/Sao_Paulo`: avança o cursor
para o próximo instante útil (seg–sex, [8h, 18h)), consome `min(restante, 18h − cursor)` por dia e
pula para 8h do próximo dia útil; termina exatamente às 18h quando o saldo zera no fim do dia. Dia útil =
10 horas úteis. `computeDueAt(priority, updatedAt)`: `critical` soma 1h corrida; `high` 4h, `medium` 30h,
`low` 50h úteis. Entradas e saídas são `Date` (instantes UTC); o fuso da máquina não interfere.
- *Alternativa*: offset fixo −03:00 (São Paulo não tem horário de verão desde 2019). Rejeitada: quebra
  silenciosamente se a regra de fuso mudar; o custo da lib é pequeno.
- `isOverdue({ status, dueAt }, now)` e `isReopenable({ status, resolvedAt }, now)` recebem só os campos
  que usam, para servir tanto a linhas do banco quanto a DTOs.

### 4. SQLite via `node:sqlite` + Drizzle
Driver `drizzle-orm/node-sqlite` com `DatabaseSync` (nativo do Node 24): sem compilação nativa, sem
mexer em `allowBuilds`. Tabelas `employees`, `articles` (`tags` em texto JSON), `tickets` (id texto PK,
datas `integer` em ms via `mode: "timestamp_ms"`, índice em `employee_id`) e `ticket_comments`
(`kind`, `author_id` FK). `dueAt` é persistido (recalculado em toda escrita); `isOverdue` nunca é
persistido, é calculado na resposta. Migrações geradas por `drizzle-kit generate` em
`apps/tickets-api/drizzle/`, versionadas e aplicadas com `migrate()` na inicialização e em cada teste
(banco `:memory:`). O caminho da pasta vem de `src/paths.ts` via `import.meta.url` (um nível abaixo da
raiz do app tanto em `src/` quanto no bundle `dist/`).
- *Alternativa*: `better-sqlite3`. Mantida como plano B se o driver `node-sqlite` do Drizzle se
  mostrar instável na versão escolhida (só muda `db/client.ts` e `allowBuilds`).
- *Alternativa*: `drizzle-kit push`. Rejeitada: o schema precisa existir também em teste e no build sem
  depender da CLI.

### 5. IDs sequenciais por tipo
Na criação, dentro de uma transação síncrona: `max(cast(substr(id, 5) as integer))` dos chamados do
tipo, +1, formatado com 5 dígitos. O driver é síncrono e o processo é único, então não há corrida.
- *Alternativa*: tabela de contadores. Desnecessária com um processo só.

### 6. Composição do Fastify
`buildApp({ db, serviceToken, failureRate, latencyMs, now, random, sleep, logger })` — tudo injetável;
`server.ts` monta a partir do `env`. Ordem:
1. Plugin de erros (raiz): `setErrorHandler` mapeia `AppError(status, code)`, `ZodError` → 400
   `invalid_request` (mensagem com `z.prettifyError`) e o resto → 500 `internal_error` (logado, sem
   stack no corpo); `setNotFoundHandler` → 404 `not_found`.
2. `/health` registrado na raiz, fora dos plugins abaixo.
3. Plugin encapsulado com hooks `onRequest`: latência (`sleep(latencyMs)`), depois falha
   (`random() < failureRate` → 503), depois token. Latência antes da falha imita um legado lento que
   também cai. Se o cliente desconectou durante a latência, a requisição é descartada sem executar a
   rota (reduz duplicidade em retry por timeout).
4. Dentro dele, rotas de `employees` e `kb`, e um sub-plugin `/tickets` com `preHandler` que valida
   `X-Employee-Id` e decora `request.employee`.
Comparação do token com `crypto.timingSafeEqual` sobre buffers de mesmo tamanho.
- Validação: schemas zod de `@nexo/shared` aplicados com `schema.parse()` no início de cada handler.
  *Alternativa*: `fastify-type-provider-zod`. Rejeitada por ora: mais uma dependência acoplada às
  versões de Fastify/zod para ganho só de tipagem do `request`.

### 7. Privacidade na camada de dados
Toda função do repositório de chamados recebe `employeeId` e o inclui no `WHERE`
(`id = ? AND employee_id = ?`). Não existe função que busque chamado só por id. Assim o 404 para
chamado alheio é o mesmo caminho de código do inexistente.

### 8. Busca por palavra-chave
`normalize` (NFD sem diacríticos, minúsculas) → tokens `[a-z0-9]+` com ≥ 3 caracteres, fora de uma lista
curta de stopwords pt-BR. Pontuação = número de tokens distintos da consulta presentes no documento
(título + conteúdo/descrição); empate por título (artigos) ou `updatedAt` desc (chamados). Tudo em
memória: são 8 artigos e poucos chamados por funcionário.

### 9. Seed
`buildSeed(now)` é puro e devolve todas as linhas; `applySeed(db, now)` apaga e insere numa transação.
O script `seed` (`tsx src/seed/cli.ts`) usa o mesmo `DATABASE_FILE` do servidor; `server.ts` chama
`applySeed` se não houver funcionários. Ids de funcionários fixos (`emp-001`…) para que testes e o web
os referenciem. Nomes e áreas seguem o protótipo do Pencil quando ele mostrar o funcionário/analista.
Datas: INC-20311 `now − 6d`; REQ-10442 `now − 5d`, ou `now − 4d` se `isOverdue` desse `true`;
INC-20150 resolvido em `now − 4d`; antigo resolvido em `now − 10d`; Alta aberto em `now − 1h`.
Um teste percorre as 168 horas cheias de uma semana chamando `buildSeed` e verifica todas as situações.

### 10. Cliente HTTP
`createTicketsClient({ baseUrl, serviceToken, timeoutMs = 5000, maxAttempts = 3, baseDelayMs = 200,
fetch = globalThis.fetch, sleep })` retorna métodos por endpoint; `employeeId` é argumento de cada
método de chamados (o agent o tira do runtime context). Cada tentativa usa
`AbortSignal.timeout(timeoutMs)`. Repete só em 503 e timeout, esperando `baseDelayMs × 2^(n−1)`. Erro de
rede (conexão recusada) vira `TicketsUnavailableError` sem retry, conforme o escopo pedido. Hierarquia:
`TicketsClientError` (base: `status`, `code`, `message`) → `TicketsUnavailableError`,
`TicketNotFoundError`, `TicketConflictError`; 400/401/500 e resposta fora do schema lançam a base.
Testes do cliente em `@nexo/shared` usam `fetch` falso; um teste de integração no `tickets-api` usa um
`fetch` que encaminha para `app.inject`, provando o contrato ponta a ponta sem abrir porta.

### 11. Ambiente
`env.ts` do `tickets-api` ganha `NODE_ENV` (`development|test|production`), `SERVICE_TOKEN` (padrão
`dev-service-token` fora de produção; obrigatório com ≥ 16 caracteres em produção, via `superRefine`),
`DATABASE_FILE` (padrão `tickets.db`, relativo ao diretório do app, coberto pelo `.gitignore`),
`FAILURE_RATE` (0–1, padrão 0) e `LATENCY_MS` (inteiro ≥ 0, padrão 0). Os testes não leem `env`: passam
`failureRate: 0`, `latencyMs: 0` direto ao `buildApp`. `.env.example` atualizado.

### 12. Testes
- `shared/rules`: tabela de casos de `computeDueAt` (cenários da spec `ticket-sla`), `isOverdue` por
  status e limite exato, `isReopenable` em 4d, 7d e 7d+1min; rodar também com `TZ=UTC` não muda nada
  porque as entradas são instantes ISO.
- `shared/client`: retry em 503, 3× 503, timeout, 404 sem retry, 409, schema inválido.
- `tickets-api` (via `inject`, `now` fixo numa quarta 10h de São Paulo): 401 sem token, privacidade
  (A × B em GET, comments, reopen, escalate), 400 por campo faltando, reabertura dentro/fora da janela,
  IDs sequenciais, similares, instabilidade com `random` fixo e `sleep` falso, seed idempotente e grade
  de 168 horas.

## Risks / Trade-offs

- [`node:sqlite` emite aviso de API experimental em algumas versões do Node 24] → aceitável em dev;
  se o driver do Drizzle falhar, trocar para `better-sqlite3` (decisão 4).
- [Retry por timeout em `POST` pode duplicar chamado se o servidor processar depois do abort] → a falha
  simulada (503) ocorre antes de qualquer efeito, e requisições abortadas durante a latência são
  descartadas; resta uma janela pequena durante o handler (síncrono e rápido). Chave de idempotência
  fica para depois.
- [Feriados ignorados] → prazos em véspera/feriado ficam mais curtos que o real; registrado no README.
- [Token de serviço padrão em dev] → só vale fora de `production`; produção falha sem token forte.
- [Busca por palavra exata não pega variações ("lento" × "lentidão")] → suficiente para 8 artigos;
  stemming ou embeddings ficam como melhoria.
- [Seed apaga tudo] → é o comportamento esperado de "recriar dados de exemplo"; só roda por comando
  explícito ou com banco vazio.

## Migration Plan

Primeiro uso cria o banco e aplica o seed automaticamente. Para quem já rodou o setup, nada a migrar:
não havia banco. Rollback = reverter o código e apagar `apps/tickets-api/tickets.db`.

## Open Questions

- Nomes exatos do funcionário principal e dos analistas: tirar do protótipo do Pencil na implementação
  (não afeta specs nem tarefas).
