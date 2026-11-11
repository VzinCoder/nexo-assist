# Design

## Context

O repositório só tem `CLAUDE.md`, `.claude/` e `openspec/`; não há `package.json` nem código. A máquina
do desenvolvedor roda Windows 11, Node 24 e pnpm 12. O `CLAUDE.md` já fixa a stack (pnpm workspaces,
Next App Router, Fastify, Vitest, zod, TypeScript strict) e as regras de dependência entre pacotes.
Motivação e escopo estão em `proposal.md`; o comportamento esperado está nas specs `dev-workspace`,
`runtime-config` e `service-health`.

## Goals / Non-Goals

**Goals:**
- Estrutura que as próximas mudanças (seed, Drizzle, Mastra, chat) só precisam preencher, sem refazer
  configuração.
- Ciclo rápido: `pnpm dev` com recarga, `pnpm test` em segundos, sem passo de build para pacotes internos.
- Funcionar igual no Windows (shell do pnpm) e em Linux/macOS.

**Non-Goals:**
- Banco, Drizzle, Mastra, AI SDK, autenticação, simulação de falhas (`FAILURE_RATE`/`LATENCY_MS`) e cliente
  HTTP com retry: ficam para as mudanças seguintes.
- CI, Husky, ESLint além do mínimo que o Next exigir, Prettier, Docker, deploy.

## Decisions

### 1. Layout e nomes
```
package.json            scripts da raiz, packageManager, engines
pnpm-workspace.yaml     packages: apps/*, packages/*
tsconfig.base.json      strict e opções comuns
vitest.config.ts        test.projects
.gitignore
apps/web                @nexo/web          Next App Router + Tailwind, porta 3000
apps/tickets-api        @nexo/tickets-api  Fastify, porta 3001
packages/shared         @nexo/shared       sem deps internas
packages/agent          @nexo/agent        depende só de @nexo/shared
```
`web` e `tickets-api` declaram `@nexo/shared` como `workspace:*` para já validar a resolução interna.
`web` não depende de `@nexo/agent` nesta mudança (entra junto com o chat).

### 2. Pacotes internos consumidos como fonte TypeScript (sem build)
`packages/*` exportam `./src/index.ts` diretamente pelo campo `exports` do `package.json`. O Next os
compila via `transpilePackages: ["@nexo/shared", "@nexo/agent"]`; o `tickets-api` roda com `tsx` em dev e
os testes rodam no Vitest, que entende TS nativamente.
- *Alternativa*: compilar cada pacote para `dist/` com `tsc -b` e project references. Rejeitada agora:
  exige watch extra no `dev` e ordem de build, sem ganho com 2 pacotes pequenos.
- *Consequência*: o build de produção do `tickets-api` precisa empacotar as dependências internas, já
  que `node dist/server.js` não executa `.ts`. Usar `tsup` (esbuild) com `noExternal: [/^@nexo\//]`,
  gerando um único `dist/server.js`. `tsc --noEmit` continua responsável pela checagem de tipos.

### 3. TypeScript
`tsconfig.base.json`: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` desligado
(atrapalha com zod/Next), `isolatedModules`, `verbatimModuleSyntax`, `skipLibCheck`, `target ES2023`.
- Todos os projetos usam `module: "ESNext"` + `moduleResolution: "Bundler"`. Funciona com tsx, tsup,
  Vitest e Next, e permite imports sem extensão entre pacotes que exportam `.ts`.
  - *Alternativa*: `NodeNext`. Rejeitada: exigiria `.js` nos imports e build dos pacotes internos, o que
    contraria a decisão 2.
- `apps/web` estende a base e adiciona o que o Next gera (`jsx: preserve`, plugin `next`, `allowJs`).
- Todos os pacotes com `"type": "module"`.

### 4. Execução em dev
`pnpm dev` na raiz = `pnpm --parallel --filter "./apps/*" dev`.
- `web`: `next dev --port 3000`.
- `tickets-api`: `tsx watch src/server.ts`.
O pnpm intercala as saídas com prefixo do pacote; dispensa `concurrently`/`turbo`.
- *Alternativa*: Turborepo. Rejeitada: cache de build não compensa neste tamanho e adiciona configuração.

### 5. tickets-api: app separado do listen
`src/app.ts` exporta `buildApp()` que cria a instância Fastify e registra rotas (`/health`, handler de
404 em JSON). `src/server.ts` lê `env`, chama `buildApp()` e `listen({ port, host })`. Os testes usam
`app.inject()` sem abrir porta. Esse formato vai receber as rotas de chamados depois sem mudança.
`/health` fica registrado antes de qualquer hook futuro de falha simulada/identificação (spec
`service-health`), o que será garantido registrando esses hooks em um plugin encapsulado que não cobre
`/health`.

### 6. Ambiente (env.ts)
Um `src/env.ts` por app com um schema zod e uma função pura `parseEnv(source: Record<string, string |
undefined>)` que retorna os valores tipados ou lança erro listando cada variável inválida. O módulo
exporta `env = parseEnv(process.env)`. A função pura é o que os testes exercitam.
- `tickets-api`: `PORT` (`z.coerce.number().int().min(1).max(65535)`, padrão 3001), `HOST` (padrão
  `0.0.0.0`), `LOG_LEVEL` (enum do pino, padrão `info`).
- `web`: `TICKETS_API_URL` (`z.url()`, padrão `http://localhost:3001`). Só servidor; nada exposto como
  `NEXT_PUBLIC_*`. Importado em `next.config.ts` para falhar no `next dev`/`next build`, não só na
  primeira requisição.
- `.env.example` **por app** (`apps/web/.env.example`, `apps/tickets-api/.env.example`), porque o Next
  só carrega `.env*` do diretório do app e o tickets-api roda a partir do seu diretório. `tickets-api`
  carrega o `.env` com `node --env-file-if-exists` (Node ≥ 22), sem `dotenv`.
- *Alternativa*: um único `.env.example` na raiz. Rejeitada: obrigaria carregar arquivo fora do app e
  esconderia qual variável pertence a qual serviço.

### 7. Testes
`vitest.config.ts` na raiz com `test.projects: ["apps/*", "packages/*"]`; cada projeto pode ter seu
`vitest.config.ts` (o `web` usa ambiente `node` por enquanto; jsdom entra com os componentes do chat).
`passWithNoTests` ativo para que pacotes sem testes não quebrem a execução. Testes de exemplo:
- `apps/tickets-api`: `GET /health` → 200 `{status:"ok"}`; rota desconhecida → 404 JSON;
  `parseEnv` com padrões, `PORT=4001` e `PORT=abc`.
- `apps/web`: `parseEnv` com URL inválida e com padrão.
- `packages/shared`: teste trivial do export de exemplo (prova que o projeto é coletado).

### 8. Web
`create-next-app` não é usado (gera ESLint, lockfile e git próprios). Arquivos escritos à mão: `app/layout.tsx`
(`lang="pt-BR"`), `app/page.tsx` com "Nexo Assist" e uma linha descritiva, `app/globals.css` com
`@import "tailwindcss";`, `postcss.config.mjs` com `@tailwindcss/postcss` (Tailwind v4), `next.config.ts`.
Antes de escrever, ler o protótipo no Pencil só para extrair fonte e cor primária para o `globals.css`;
a página em si é provisória.

### 9. Versões e pnpm
Versões estáveis atuais de cada lib, confirmadas via Context7 no momento da implementação (Vitest 5 com
`test.projects`, Tailwind v4 com `@tailwindcss/postcss`). Raiz com `"packageManager": "pnpm@12.x"` e
`"engines": { "node": ">=24" }`. Dependências comuns de dev (typescript, vitest, tsx, @types/node) ficam
na raiz.

## Risks / Trade-offs

- [pnpm bloqueia scripts de instalação por padrão (esbuild, sharp, e no futuro better-sqlite3)] →
  declarar os permitidos em `pnpm-workspace.yaml` (`onlyBuiltDependencies`/`allowBuilds`, conforme a
  versão) e documentar.
- [Pacotes internos sem build acoplam os consumidores ao TS] → aceitável num monorepo fechado; se algum
  pacote precisar ser publicado, adiciona-se build só nele.
- [`pnpm --parallel` não tem painel separado por processo] → prefixos bastam; trocar por `turbo` depois
  se incomodar.
- [Diferenças de shell no Windows] → scripts sem `&&` encadeando variáveis de ambiente, sem `rm -rf`;
  tudo via comandos das próprias ferramentas.
- [Next exige ESLint?] → `next build` não falha sem ESLint configurado; não adicionar configuração.

## Migration Plan

Não há código anterior. Rollback = apagar os arquivos criados.
