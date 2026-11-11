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
| tickets-api  | `apps/tickets-api/.env.example` | `PORT`, `HOST`, `LOG_LEVEL`   |

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
