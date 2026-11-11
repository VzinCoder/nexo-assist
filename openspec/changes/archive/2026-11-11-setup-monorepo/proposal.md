# Proposal

## Why

O repositório ainda não tem código: só o `CLAUDE.md` e a configuração do OpenSpec. Toda a ordem de
implementação (tickets-api + seed → agent → chat → console) depende de um monorepo que instala, sobe,
testa e faz build com um único comando. Fazer isso primeiro, sem regra de negócio, separa os problemas
de tooling dos problemas de domínio e deixa as próximas mudanças focadas no produto.

## What Changes

- Monorepo **pnpm workspaces** na raiz com `apps/web`, `apps/tickets-api`, `packages/shared` e
  `packages/agent` (nomes `@nexo/*`, dependências internas via `workspace:*`).
- `tsconfig.base.json` compartilhado na raiz com `strict: true`; cada projeto estende a base.
- `apps/web`: Next.js (App Router) + Tailwind, com uma página inicial simples em português, na porta 3000.
- `apps/tickets-api`: Fastify com a rota `GET /health`, na porta 3001.
- `packages/shared` e `packages/agent`: pacotes vazios mínimos (um export de exemplo), respeitando as
  regras de dependência do `CLAUDE.md` (`shared` não depende de nada do repo; `agent` não importa Next
  nem `apps/*`).
- `env.ts` em cada app, validando variáveis de ambiente com zod e falhando cedo com mensagem clara.
- `.env.example` documentando todas as variáveis lidas pelos apps.
- Vitest configurado na raiz cobrindo todos os projetos, com testes de exemplo passando
  (`/health` e validação de env).
- Scripts na raiz: `dev` (sobe web e tickets-api em paralelo), `test`, `build` e `typecheck`.
- `.gitignore` para Node/Next/SQLite/env.
- Fora do escopo: CI, Husky, ESLint elaborado, banco/Drizzle, Mastra, seed, login e qualquer regra de
  negócio.

## Capabilities

### New Capabilities

- `dev-workspace`: como o desenvolvedor instala, sobe, testa, faz typecheck e build do monorepo com
  comandos únicos na raiz, e as portas em que cada app responde.
- `runtime-config`: validação das variáveis de ambiente na inicialização de cada app, com padrões
  documentados em `.env.example` e falha explícita para valores inválidos.
- `service-health`: endpoint de saúde do `tickets-api`, usado para verificar se o serviço legado está
  no ar.

### Modified Capabilities

(nenhuma; não há specs existentes)

## Impact

- **Código novo**: toda a árvore `apps/` e `packages/`, arquivos de configuração da raiz
  (`package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `vitest.config.ts`, `.gitignore`).
- **Dependências**: next, react, react-dom, tailwindcss, fastify, zod, typescript, vitest, tsx e tipos.
  Versões estáveis atuais, confirmadas via Context7 na implementação.
- **APIs**: `GET /health` no tickets-api (porta 3001).
- **Ambiente**: Node 24 e pnpm 12 (versões instaladas na máquina do desenvolvedor), fixados via
  `engines`/`packageManager`.
