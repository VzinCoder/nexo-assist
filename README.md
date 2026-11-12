# Nexo Assist

Agent de service desk de TI num chat, com console do analista. Monorepo pnpm.

> Em construção: esta é a base do workspace. Arquitetura, decisões do agent, testes/eval e trade-offs
> serão documentados aqui conforme as próximas etapas forem entregues.

## Pré-requisitos

- Node.js 24 ou superior
- pnpm 12 (`corepack enable` usa a versão fixada em `packageManager`)

## Como rodar

```bash
pnpm install     # instala as dependências de todos os projetos
pnpm dev         # sobe web (http://localhost:3000) e tickets-api (http://localhost:3001)
pnpm test        # roda os testes (Vitest) de todos os projetos
pnpm typecheck   # verifica os tipos (TypeScript strict) de todos os projetos
pnpm build       # build de produção do web e do tickets-api
```

Rodar só um projeto:

```bash
pnpm --filter @nexo/web dev
pnpm --filter @nexo/tickets-api dev
pnpm --filter @nexo/tickets-api start   # executa o build (dist/server.js)
```

Não é preciso `.env` para rodar localmente: todas as variáveis têm padrão. Para sobrescrever, copie o
`.env.example` do app para `.env` no mesmo diretório:

| App          | Arquivo                       | Variáveis                       |
|--------------|-------------------------------|---------------------------------|
| web          | `apps/web/.env.example`       | `TICKETS_API_URL`               |
| tickets-api  | `apps/tickets-api/.env.example` | `NODE_ENV`, `PORT`, `HOST`, `LOG_LEVEL`, `SERVICE_TOKEN`, `DATABASE_FILE`, `FAILURE_RATE`, `LATENCY_MS` |

Valores inválidos impedem a inicialização com uma mensagem que nomeia a variável.

## Estrutura

```
apps/
  web/            @nexo/web          Next.js (App Router) + Tailwind
  tickets-api/    @nexo/tickets-api  Fastify; serviço de chamados legado simulado
packages/
  agent/          @nexo/agent        agent (Mastra), tools e regras de negócio
  shared/         @nexo/shared       schemas, tipos e cliente HTTP do tickets-api
```

Os pacotes de `packages/` são consumidos direto do código TypeScript (sem build próprio). O Next os
transpila e o build do `tickets-api` (tsup) os empacota em `dist/server.js`.

## tickets-api (serviço de chamados legado)

Fastify + SQLite (`node:sqlite`, nativo do Node 24, sem build nativo) com Drizzle. As migrações
ficam em `apps/tickets-api/drizzle/` e são aplicadas ao iniciar. Na primeira execução, com o banco
vazio, o seed é aplicado automaticamente.

> O driver `drizzle-orm/node-sqlite` só existe a partir do Drizzle 1.0; por isso `drizzle-orm` e
> `drizzle-kit` estão fixados em `1.0.0-rc.5` (a versão `latest`, 0.45, não tem esse driver).

### Dados de exemplo

```bash
pnpm --filter @nexo/tickets-api seed        # apaga tudo e recria os dados de exemplo
pnpm --filter @nexo/tickets-api db:generate # gera migração após alterar src/db/schema.ts
```

As datas do seed são relativas ao momento em que ele roda; as situações valem em qualquer dia e hora.

| Funcionário (id)          | E-mail                       | Papel / área          |
|---------------------------|------------------------------|-----------------------|
| Ana Souza (`emp-001`)     | ana.souza@nexo.com.br        | funcionária principal, Financeiro |
| Carla Mendes (`emp-002`)  | carla.mendes@nexo.com.br     | Comercial (chamado parecido, para testar privacidade) |
| Bruno Tavares (`emp-003`) | bruno.tavares@nexo.com.br    | Marketing             |
| Diego Ramos (`emp-004`)   | diego.ramos@nexo.com.br      | Logística             |
| Elisa Prado (`emp-005`)   | elisa.prado@nexo.com.br      | Jurídico (sem chamados) |
| Juliana Alves (`emp-101`) | juliana.alves@nexo.com.br    | analista N1           |
| Rafael Lima (`emp-102`)   | rafael.lima@nexo.com.br      | analista N2           |

Chamados da Ana: INC-20311 (vencido, aguardando analista), REQ-10442 (aprovado, no prazo),
INC-20150 (resolvido há 4 dias, reabrível), INC-19877 (resolvido há 10 dias, não reabrível),
INC-19410 (fechado) e INC-20298 (prioridade alta, aberto, no prazo). São 8 artigos na central de
ajuda, incluindo "VPN com erro 809" e "Horário do service desk".

### Autenticação e headers

| Header             | Onde                       | Erro                                               |
|--------------------|----------------------------|----------------------------------------------------|
| `X-Service-Token`  | todas as rotas, exceto `/health` | ausente ou errado → 401 `unauthorized`        |
| `X-Employee-Id`    | todas as rotas `/tickets*` | ausente/malformado → 400; inexistente → 401        |

Fora de produção o token padrão é `dev-service-token`. Com `NODE_ENV=production`, `SERVICE_TOKEN` é
obrigatório (16+ caracteres). Cada funcionário só enxerga os próprios chamados: o chamado de outro
funcionário responde 404, igual a um id inexistente.

Todo erro tem o formato `{ "error": { "code", "message" } }`, com `code` em `invalid_request`,
`unauthorized`, `not_found`, `conflict`, `service_unavailable` ou `internal_error`.

### Endpoints

| Método e rota                      | Body                          | Resposta                                   |
|------------------------------------|-------------------------------|--------------------------------------------|
| `GET /health`                      | —                             | `{ status: "ok" }`                         |
| `GET /employees/by-email/:email`   | —                             | funcionário (`role`: employee, analyst_n1, analyst_n2) |
| `GET /kb/articles?q=`              | —                             | artigos por relevância (sem `q`: todos por título) |
| `GET /tickets?status=`             | —                             | chamados do funcionário, mais recentes primeiro |
| `GET /tickets/:id`                 | —                             | chamado com comentários                    |
| `POST /tickets/similar`            | `{ text }`                    | até 5 ativos ou reabríveis, com `reopenable` |
| `POST /tickets`                    | `{ title, description, type, category, priority, affected }` | 201 com o chamado criado |
| `POST /tickets/:id/comments`       | `{ text }`                    | 201; resolvido/fechado → 409               |
| `POST /tickets/:id/reopen`         | `{ comment? }`                | 200; fora da janela de 7 dias → 409        |
| `POST /tickets/:id/escalate`       | `{ reason, summary }`         | 200 com status `waiting_analyst`           |

Valores: `type` INC/REQ; `category` access, network_vpn, hardware, software, email, other;
`priority` critical, high, medium, low; `affected` me, team, company. Ids seguem `INC-NNNNN` /
`REQ-NNNNN`, sequenciais por tipo. Toda escrita renova `updatedAt` e recalcula `dueAt`;
`isOverdue` é calculado na resposta.

```bash
curl -s localhost:3001/tickets \
  -H "X-Service-Token: dev-service-token" -H "X-Employee-Id: emp-001"
```

### Prazos (SLA)

Calculados em `packages/shared/src/rules/`: crítica 1 hora corrida; alta 4 horas úteis; média 3 dias
úteis; baixa 5 dias úteis. Horário útil: segunda a sexta, 8h às 18h, America/Sao_Paulo.

**Limitação:** feriados não são considerados. Um prazo que atravessa um feriado fica mais curto que o
real.

### Simulação de instabilidade

O serviço imita um legado instável, sem afetar `/health`:

- `FAILURE_RATE` (0 a 1): fração das requisições que recebem 503 `service_unavailable`, antes de
  qualquer efeito da rota.
- `LATENCY_MS` (inteiro ≥ 0): atraso aplicado a cada requisição.

```bash
# PowerShell: $env:FAILURE_RATE="0.5"; pnpm dev   |   bash:
FAILURE_RATE=0.5 LATENCY_MS=300 pnpm --filter @nexo/tickets-api dev
```

O cliente de `@nexo/shared` (`createTicketsClient`) tolera essa instabilidade: timeout de 5 s por
tentativa, até 3 tentativas só em 503/timeout (espera de 200 ms e depois 400 ms) e erros tipados
(`TicketsUnavailableError`, `TicketNotFoundError`, `TicketConflictError`).
