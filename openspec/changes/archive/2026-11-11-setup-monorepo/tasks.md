# Tasks

## 1. Raiz do workspace

- [x] 1.1 Confirmar via Context7 as versões estáveis atuais e a configuração de Next.js (App Router), Tailwind v4, Fastify, Vitest, zod e tsup; registrar as versões escolhidas no `package.json` de cada projeto
- [x] 1.2 Criar `package.json` da raiz (privado, `packageManager` pnpm 12, `engines.node >=24`, scripts `dev`, `test`, `typecheck`, `build`) e `pnpm-workspace.yaml` com `apps/*` e `packages/*`; verificar com `pnpm install` sem erro
- [x] 1.3 Criar `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`, `isolatedModules`, `verbatimModuleSyntax`, `moduleResolution: Bundler`) e verificar que ele é estendido por todos os projetos criados nos grupos seguintes
- [x] 1.4 Criar `.gitignore` (node_modules, .next, dist, coverage, *.tsbuildinfo, *.db/*.sqlite, `.env` e `.env.*` exceto `.env.example`) e verificar com `git status` após install/build/test que nada gerado aparece
- [x] 1.5 Declarar em `pnpm-workspace.yaml` os pacotes com build script permitido (esbuild, sharp, etc.) e verificar que `pnpm install` não mostra aviso de scripts ignorados

## 2. packages/shared e packages/agent

- [x] 2.1 Criar `packages/shared` (`@nexo/shared`, `type: module`, `exports` apontando para `./src/index.ts`, sem dependências internas) com um export de exemplo e um teste Vitest dele; verificar que `pnpm test` coleta e passa o teste
- [x] 2.2 Criar `packages/agent` (`@nexo/agent`, depende só de `@nexo/shared` via `workspace:*`, sem Next nem `apps/*`) com `src/index.ts` mínimo; verificar com `pnpm --filter @nexo/agent typecheck`

## 3. apps/tickets-api

- [x] 3.1 Criar o projeto `@nexo/tickets-api` (fastify, zod, tsx, tsup; `@nexo/shared` via `workspace:*`) com `tsconfig.json` estendendo a base
- [x] 3.2 Implementar `src/env.ts` com `parseEnv` (PORT padrão 3001, HOST padrão 0.0.0.0, LOG_LEVEL padrão info) e `env` exportado; testes para padrões, `PORT=4001` e `PORT=abc` (erro citando `PORT`)
- [x] 3.3 Implementar `src/app.ts` com `buildApp()`, rota `GET /health` → 200 `{ "status": "ok" }` e handler de 404 em JSON; testes com `app.inject()` cobrindo os cenários da spec `service-health`
- [x] 3.4 Implementar `src/server.ts` (lê `env`, `listen`) e scripts `dev` (`tsx watch` com `--env-file-if-exists`), `build` (tsup em `dist/server.js` com `@nexo/*` empacotado), `start`, `typecheck`, `test`; verificar `curl localhost:3001/health` em dev e após `build` + `start`, e que `PORT=abc` encerra com código ≠ 0
- [x] 3.5 Criar `apps/tickets-api/.env.example` com PORT, HOST e LOG_LEVEL comentados; verificar que bate com o schema de `env.ts`

## 4. apps/web

- [x] 4.1 Ler no Pencil o protótipo para extrair fonte e cor primária (sem alterar o arquivo de design)
- [x] 4.2 Criar o projeto `@nexo/web` à mão (next, react, react-dom, tailwindcss, @tailwindcss/postcss, zod; `@nexo/shared` via `workspace:*`) com `tsconfig.json` estendendo a base, `next.config.ts` com `transpilePackages` e `postcss.config.mjs`
- [x] 4.3 Implementar `src/env.ts` com `parseEnv` (`TICKETS_API_URL` URL, padrão `http://localhost:3001`, só servidor), importado em `next.config.ts`; testes para padrão e URL inválida (erro citando `TICKETS_API_URL`)
- [x] 4.4 Criar `app/layout.tsx` (`lang="pt-BR"`), `app/globals.css` (`@import "tailwindcss"` + fonte/cor do protótipo) e `app/page.tsx` exibindo "Nexo Assist" com classes Tailwind; verificar em `pnpm --filter @nexo/web dev` que `/` responde 200 com o texto estilizado
- [x] 4.5 Criar `apps/web/.env.example` com `TICKETS_API_URL` comentada; verificar que `next build` com `TICKETS_API_URL=nao-e-url` falha citando a variável

## 5. Integração e documentação

- [x] 5.1 Criar `vitest.config.ts` da raiz com `test.projects: ["apps/*", "packages/*"]` e `passWithNoTests`; verificar que `pnpm test` roda todos os projetos com código 0 e que um teste quebrado de propósito gera código ≠ 0
- [x] 5.2 Em clone limpo (ou após apagar `node_modules`), rodar `pnpm install`, `pnpm typecheck`, `pnpm test`, `pnpm build` e `pnpm dev` sem `.env`; verificar portas 3000 e 3001 e `git status` limpo
- [x] 5.3 Criar `README.md` inicial com pré-requisitos (Node 24, pnpm 12) e os comandos da raiz; verificar que cada comando documentado roda como escrito
- [x] 5.4 Listar os arquivos alterados e sugerir as mensagens de commit (Conventional Commits, descrição em português), sem executar `git commit`
