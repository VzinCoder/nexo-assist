# Proposal

## Why

O agent e o console dependem de um serviço de chamados para consultar, abrir, complementar, reabrir e
transferir chamados, e hoje o `tickets-api` só tem `/health`. Ele é o primeiro item da ordem de
implementação do `CLAUDE.md`: sem ele (e sem o cliente HTTP e as regras de prazo em `@nexo/shared`),
as tools do agent não têm o que chamar nem como serem testadas. Ele também precisa simular um sistema
legado instável, para que retry, erros tipados e o aviso ao funcionário sejam exercitados de verdade.

## What Changes

- **Regras de prazo puras** em `packages/shared/src/rules`: `dueAt` a partir de `updatedAt` e da
  prioridade (Crítica 1h corrida; Alta 4h úteis; Média 3 dias úteis; Baixa 5 dias úteis; seg–sex
  8h–18h, America/Sao_Paulo, sem feriados), `isOverdue(ticket, now)` (sempre `false` em `resolved` e
  `closed`) e a janela de reabertura de 7 dias. O `CLAUDE.md` passa a apontar este local (hoje cita
  `packages/agent/src/rules/`).
- **Schemas zod e tipos** em `@nexo/shared`: `Employee`, `Article`, `Ticket`, `TicketType`,
  `TicketCategory`, `TicketPriority`, `TicketStatus` (com rótulos em português), `Comment` e o formato
  de erro `{ error: { code, message } }`.
- **Persistência do `tickets-api`** em SQLite + Drizzle (funcionários, artigos, chamados, comentários),
  com migrações aplicadas na inicialização.
- **Endpoints** com validação zod de params, query e body: `GET /employees/by-email/:email`,
  `GET /kb/articles?q=`, `GET /tickets?status=`, `GET /tickets/:id`, `POST /tickets/similar`,
  `POST /tickets`, `POST /tickets/:id/comments`, `POST /tickets/:id/reopen`,
  `POST /tickets/:id/escalate`. IDs `INC-NNNNN`/`REQ-NNNNN` sequenciais por tipo.
- **Segurança e privacidade**: `X-Service-Token` obrigatório (401 sem ele); rotas de chamados exigem
  `X-Employee-Id` e só enxergam chamados desse funcionário; chamado alheio responde 404.
- **Instabilidade simulada** por `FAILURE_RATE` (503 aleatório) e `LATENCY_MS` (atraso), sem afetar
  `/health` e desligada nos testes.
- **Seed idempotente** com datas relativas ao momento em que roda: funcionários, 2 analistas, 8 artigos
  (incluindo VPN erro 809 e horário do service desk), INC-20311 (vencido), REQ-10442 (no prazo),
  INC-20150 (resolvido há 4 dias, reabrível), um resolvido há mais de 7 dias, um Alta no prazo e
  chamados de outros funcionários.
- **Cliente HTTP tipado** em `@nexo/shared` com timeout, retry com backoff exponencial (3 tentativas,
  só em 503 e timeout) e erros `TicketsUnavailableError`, `TicketNotFoundError`, `TicketConflictError`.
- **BREAKING** (interno): o 404 de rota inexistente passa de `{ error, message }` para
  `{ error: { code, message } }`. Nenhum consumidor existe ainda.
- Fora de escopo: autenticação do usuário final, UI, agent, estado da conversa e limite de mensagens
  (ficam no `apps/web`); resolver/fechar chamados pelo analista; feriados.

## Capabilities

### New Capabilities

- `ticket-sla`: cálculo do prazo (`dueAt`) em horas/dias úteis por prioridade, vencimento por status e
  janela de reabertura, como regras puras compartilhadas.
- `service-access`: autenticação serviço-a-serviço por token, identificação do funcionário por header,
  formato único de erro e instabilidade simulada do legado.
- `employee-directory`: consulta de funcionário por e-mail corporativo.
- `help-center`: busca por palavra-chave nos artigos da central de ajuda.
- `ticket-management`: consulta, criação, busca de similares, comentário, reabertura e transferência de
  chamados, restritos ao funcionário dono, com IDs sequenciais por tipo.
- `sample-data`: seed idempotente com cenários de exemplo válidos em qualquer data.
- `tickets-client`: cliente HTTP tipado do `tickets-api` com timeout, retry e erros tipados.

### Modified Capabilities

- `service-health`: rotas inexistentes passam a responder no formato de erro padrão
  `{ error: { code, message } }`.
- `runtime-config`: o `tickets-api` ganha `SERVICE_TOKEN`, `DATABASE_FILE`, `FAILURE_RATE` e
  `LATENCY_MS`, com padrões que mantêm o `pnpm dev` funcionando sem `.env` (token padrão só fora de
  produção).

## Impact

- **Código**: `apps/tickets-api` (db, rotas, plugins, seed, testes), `packages/shared` (schemas, regras,
  cliente, testes), `CLAUDE.md` (local das regras), `README.md` (limitação de feriados), `.env.example`
  do `tickets-api`.
- **APIs**: novos endpoints do `tickets-api` listados acima; todos exceto `/health` exigem
  `X-Service-Token`.
- **Dependências**: `drizzle-orm` e `drizzle-kit` (driver `node:sqlite`, nativo do Node 24, sem build
  nativo), `@date-fns/tz` + `date-fns` em `@nexo/shared` para o fuso; versões confirmadas via Context7.
- **Consumidores futuros**: `packages/agent` e `apps/web` passam a usar o cliente e as regras de
  `@nexo/shared`.
