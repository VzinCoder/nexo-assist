# Tasks

## 1. Dependências

- [x] 1.1 Confirmar via Context7 as APIs atuais de `drizzle-orm` (driver `node-sqlite`, `migrate`, `timestamp_ms`), `drizzle-kit` (`generate`), `@date-fns/tz` (`TZDate`) e `date-fns`; adicionar `drizzle-orm`/`drizzle-kit` ao `tickets-api` e `date-fns`/`@date-fns/tz`/`zod` ao `@nexo/shared`; verificar `pnpm install` sem aviso de build bloqueado e `pnpm typecheck` verde

## 2. @nexo/shared: schemas e tipos

- [x] 2.1 Criar `src/schemas/` com zod e tipos de `Employee` (role), `Article`, `TicketType`, `TicketCategory`, `TicketPriority`, `TicketStatus`, `TicketAffected`, `Comment` (kind), `TicketSummary`, `Ticket`, bodies de criação/comentário/reabertura/transferência/similares, `ErrorBody` e mapas de rótulo pt-BR; reexportar no `index.ts`; verificar com testes de parse (válido, campo faltando, título só com espaços, id fora do padrão `INC|REQ-NNNNN`)

## 3. @nexo/shared: regras de prazo

- [x] 3.1 Implementar `rules/business-hours.ts` (`addBusinessHours` com `TZDate` em America/Sao_Paulo) e `rules/sla.ts` (`computeDueAt`, `isOverdue`); verificar com testes cobrindo todos os cenários da spec `ticket-sla` (crítica no sábado, virada de dia, sexta → segunda, antes/depois do expediente, domingo, limite exato do `isOverdue`, `resolved`/`closed` nunca vencidos)
- [x] 3.2 Implementar `rules/reopen.ts` (`isReopenable`, janela de 168 h); verificar com testes em 4 d, 7 d exatos, 7 d + 1 min, status `closed` e status não resolvido
- [x] 3.3 Atualizar o `CLAUDE.md` (invariante 4 e estrutura) para `packages/shared/src/rules/`; verificar com busca que não restou menção a `packages/agent/src/rules`

## 4. @nexo/shared: cliente HTTP

- [x] 4.1 Implementar `client/errors.ts` (`TicketsClientError`, `TicketsUnavailableError`, `TicketNotFoundError`, `TicketConflictError`) e `client/tickets-client.ts` (`createTicketsClient` com headers, timeout por tentativa, retry só em 503/timeout com backoff `baseDelayMs × 2^(n−1)`, validação da resposta); verificar com testes de `fetch` falso: 503→200 (2 chamadas), 3× 503 (3 chamadas + `TicketsUnavailableError`), timeout esgotado, 404 com 1 chamada, 409 → `TicketConflictError` com mensagem, conexão recusada, corpo fora do schema, headers enviados

## 5. tickets-api: ambiente e erros

- [ ] 5.1 Estender `env.ts` com `NODE_ENV`, `SERVICE_TOKEN` (padrão só fora de produção, ≥ 16 em produção), `DATABASE_FILE`, `FAILURE_RATE` e `LATENCY_MS`; atualizar `.env.example`; verificar com testes de `parseEnv` (padrões, produção sem token, `FAILURE_RATE=1.5`, `LATENCY_MS=-10`)
- [ ] 5.2 Criar `plugins/errors.ts` (`AppError`, handler de erro para zod/AppError/500 e 404 no formato `{ error: { code, message } }`) e ligar no `buildApp`; verificar atualizando o teste de rota inexistente e adicionando teste de 500 sem stack no corpo

## 6. tickets-api: banco

- [ ] 6.1 Criar `db/schema.ts` (employees, articles, tickets, ticket_comments), `db/client.ts` (`createDb(file)` com `node:sqlite` + `migrate`) e `paths.ts`; adicionar script `db:generate` e gerar a primeira migração em `drizzle/`; verificar com teste que cria banco `:memory:`, migra e insere/consulta um chamado, e com `pnpm build` + `start` aplicando a migração a partir de `dist/`

## 7. tickets-api: seed

- [ ] 7.1 Ler no Pencil (somente leitura) os nomes do funcionário e dos analistas exibidos nas telas e usá-los no seed; implementar `seed/data.ts` (`buildSeed(now)`: 4–5 funcionários de áreas diferentes, analistas N1/N2, 8 artigos incluindo VPN 809 e horário do service desk, chamados do principal e de outros dois funcionários com comentários, `dueAt` via `computeDueAt`, regra 5 d/4 d do REQ-10442); verificar com teste da grade de 168 horas cheias de uma semana e do caso sexta 19h
- [ ] 7.2 Implementar `seed/apply.ts` (apaga e insere em transação), `seed/cli.ts` e o script `seed` do `package.json`; aplicar seed automático em `server.ts` quando não houver funcionários; verificar com teste de idempotência (duas aplicações, mesmo conteúdo; chamado criado entre elas some) e rodando `pnpm --filter @nexo/tickets-api seed` duas vezes

## 8. tickets-api: acesso e instabilidade

- [ ] 8.1 Reestruturar `buildApp(options)` com dependências injetáveis (`db`, `serviceToken`, `failureRate`, `latencyMs`, `now`, `random`, `sleep`) e criar os plugins `instability` (latência → descarte se o cliente desconectou → falha 503) e `service-auth` (token com `timingSafeEqual`), mantendo `/health` fora deles; verificar com testes: 401 sem token e com token errado, `FAILURE_RATE=1` → 503 em `/tickets` e 200 em `/health`, `POST /tickets` com falha não cria chamado, `sleep` falso chamado com `LATENCY_MS` e não chamado em `/health`
- [ ] 8.2 Criar `plugins/employee-context.ts` (`X-Employee-Id` ausente → 400, inexistente → 401, decora `request.employee`); verificar com testes dos dois casos de erro

## 9. tickets-api: funcionários e central de ajuda

- [ ] 9.1 Implementar `search/keywords.ts` (normalização, stopwords, pontuação); verificar com testes de acento, palavras curtas/vazias e ordenação por pontuação
- [ ] 9.2 Implementar `GET /employees/by-email/:email` e `GET /kb/articles?q=`; verificar com testes de e-mail com maiúsculas, desconhecido (404), inválido (400), `q=vpn erro 809` com o artigo da VPN em primeiro, `q=horario`, só stopwords (vazio) e sem `q` (todos por título)

## 10. tickets-api: chamados

- [ ] 10.1 Implementar `tickets/repository.ts` (toda consulta filtrada por `employeeId`, próximo id por tipo em transação) e `GET /tickets?status=` e `GET /tickets/:id`; verificar com testes: lista só do próprio funcionário ordenada por `updatedAt`, filtro por status, status inválido (400), lista vazia, detalhe com comentários e `isOverdue` de INC-20311, id malformado (400), chamado de B pedido por A → 404 igual ao inexistente
- [ ] 10.2 Implementar `POST /tickets`; verificar com testes: 201 com status `open` e `dueAt` conforme prioridade, campo faltando (400 citando o campo, nada criado), título vazio, ids INC-20312 e sequência REQ independente
- [ ] 10.3 Implementar `POST /tickets/similar`; verificar com testes dos cenários de notebook lento (INC-20311, `reopenable` false), SAP (INC-20150, `reopenable` true), resolvido há mais de 7 dias fora e chamado alheio fora, limite de 5
- [ ] 10.4 Implementar `POST /tickets/:id/comments`, `/reopen` e `/escalate` com recálculo de `updatedAt`/`dueAt`; verificar com testes: comentário tira INC-20311 do vencido, comentário em resolvido → 409, reabertura dentro (200, `open`, `resolvedAt` null, comentário `reopen`) e fora da janela (409, inalterado), reabrir não resolvido → 409, transferência (200, `waiting_analyst`, comentário `escalation`), sem `summary` → 400, transferir resolvido → 409, e A agindo em chamado de B → 404 sem alteração nas três rotas

## 11. Integração e documentação

- [ ] 11.1 Teste de integração do cliente de `@nexo/shared` contra o `buildApp` via `fetch` que encaminha para `app.inject`: listar, criar, `TicketNotFoundError` para chamado alheio, `TicketConflictError` na reabertura fora da janela e `TicketsUnavailableError` com `failureRate: 1`; verificar que passa em `pnpm test`
- [ ] 11.2 Atualizar o `README.md` com os endpoints, headers exigidos, variáveis de instabilidade, comando de seed e a limitação de feriados; verificar seguindo o README: `pnpm dev`, `curl` em `/tickets` com os headers do seed e com `FAILURE_RATE=0.5` observando 503 ocasionais
- [ ] 11.3 Rodar `pnpm test`, `pnpm typecheck` e `pnpm build` na raiz e confirmar todos com código 0 e `git status` sem banco nem `.env`

## Workflow follow-up

- Commit após cada task concluída e verificada, conforme a seção Git do CLAUDE.md.
- Arquivar a mudança com `/opsx:archive` após revisão.
