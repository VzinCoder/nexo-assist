# Design

## Context

Já existem: `tickets-api` (Fastify, `X-Service-Token` + `X-Employee-Id`, endpoints de funcionário por
e-mail, KB, listar/detalhar/similares/criar/comentar/reabrir/transferir), o cliente
`createTicketsClient` em `@nexo/shared` (retry, timeout, `TicketsUnavailableError`,
`TicketNotFoundError`, `TicketConflictError`) e as regras puras `computeDueAt`, `isOverdue`,
`isReopenable`, `SLA_LABELS` em `packages/shared/src/rules`. O `web` é um Next 16 vazio (só `env.ts`
com `TICKETS_API_URL` e a página "Em construção"); `packages/agent` só exporta `AGENT_NAME`. O Mastra
ainda não está instalado. No Next 16 o antigo `middleware.ts` chama-se `proxy.ts`
(`node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md`). O protótipo do Pencil tem as
telas "Identificação", "Chat — Novo chamado" e "Chat — Consulta e transferência" com os tokens já
copiados para `globals.css`.

Motivação e escopo: ver proposal.md. Requisitos: ver `specs/`.

## Goals / Non-Goals

**Goals:**
- Toda regra crítica (identidade, confirmação, gating de status, limite, SLA) aplicada por código
  testável, nunca só pelo prompt.
- Agent testável sem rede: modelo falso e cliente falso injetáveis.
- Trace e decisão com um único schema compartilhado entre agent, rota e UI.

**Non-Goals:**
- Memória/threads do Mastra (o histórico é do banco do web; não usamos o storage do Mastra).
- Servidor Mastra (`mastra dev`) ou playground; o agent roda dentro da rota do Next.
- Console do analista, polling de mensagens do analista e deploy.

## Decisions

### D1. Agent como fábrica com dependências injetadas
`packages/agent` exporta `createNexoAgent({ model, tickets, drafts, conversations, now })`, onde
`tickets` é o `TicketsClient` e `drafts`/`conversations` são portas (interfaces) para gravar rascunho e
mudar status, implementadas pelo web com Drizzle. Assim o agent não importa Next nem o banco do web e
os testes injetam fakes. `model` aceita string do model router do Mastra (`"google/gemini-…"`) ou um
modelo de teste.
*Alternativa*: registrar o agent numa instância `Mastra` global — dificulta injetar portas por
requisição e testar; rejeitada. Se `handleChatStream` exigir instância `Mastra`, criamos uma
instância leve por processo no web, mantendo a fábrica.

### D2. Identidade via `RequestContext`
A rota monta `new RequestContext()` com `employeeId` e `conversationId` (da sessão e do banco) e passa
em `agent.stream(..., { requestContext })`. Cada tool lê com um helper `getSessionIds(context)` que lança
se faltarem; os `inputSchema` das tools não têm esses campos (zod `strict`, então argumento extra do
LLM falha a validação). Teste: tool chamada com contexto de A nunca toca dados de B.

### D3. Wrapper `withTrace` para toda tool
Um helper envolve o `execute`: mede `durationMs`, captura erro (tipos do cliente viram mensagem pt-BR),
monta `TraceStep { tool, label, input, output, durationMs, error? }` com `output` resumido por uma
função por tool (ex.: chamados → `{id,title,status,isOverdue}`), e devolve `{ ok, data?, error?,
trace }`. Erros não são relançados para o modelo: ele recebe `{ ok:false, error }` e as instruções
mandam avisar o funcionário. Os schemas `traceStepSchema` e `decisionSchema` ficam em
`@nexo/shared/schemas/agent.ts` (shared não depende de ninguém; agent e web importam).

### D4. Coleta do trace e da decisão na rota
A rota não confia no texto do modelo: ao fim do stream (`onFinish` do Mastra/AI SDK), percorre os
resultados das tool calls, extrai os `trace` e o argumento validado de `report_decision`. Sem decisão
→ decisão sintética `other/low` (spec `decision-trace`). As partes estruturadas para a UI (cards de
chamado, lista, rascunho, opções, transferência) também são derivadas dos resultados das tools, não do
texto. Na UI em streaming, os chips aparecem a partir das partes `tool-*` do `useChat`; depois do
reload vêm de `messages.trace` gravado.

### D5. Streaming: Mastra → AI SDK UI stream
`POST /api/chat` usa `agent.stream(messages, { requestContext, maxSteps: 6, modelSettings: {
maxOutputTokens: 800 } })` e converte com `toAISdkStream`/`handleChatStream` de `@mastra/ai-sdk`
(com `version` igual ao `ai` instalado), respondendo com `createUIMessageStreamResponse`. O cliente
usa `useChat` com transport customizado que envia só `{ conversationId, text }` — o servidor ignora o
histórico do navegador e lê as últimas 12 mensagens do banco. APIs exatas confirmadas na doc embutida
em `node_modules/@mastra/core/dist/docs/` e no Context7 na task 1.
*Alternativa*: SSE próprio — mais código e perde o `useChat`; rejeitada.

### D6. Gating antes do modelo, em função pura
`decideChatGate({ conversation, employeeId, userMessageCount, hasApiKey })` devolve `not_found |
not_agent(status) | limit_reached | not_configured | ok`. A rota chama essa função e só instancia o
agent no caso `ok`. A rota recebe o agent por injeção (`createChatHandler({ db, agentFactory, … })`)
para os testes contarem chamadas de um agent falso. Incremento de `userMessageCount` e insert da
mensagem numa transação; limite checado com `count >= 30` antes de gravar.

### D7. Erros do provedor
Erros do stream (`APICallError` com `statusCode 429`, ou 5xx) são classificados em
`provider_rate_limited | provider_unavailable`. A rota grava a resposta do assistente com o texto
padrão e um `TraceStep { tool: "llm", label: "Chamou o modelo", error }`, e emite essa mensagem no
stream para a UI. Não há retry automático no 429 (gastaria cota).

### D8. Rascunhos: transição atômica
Confirm faz `UPDATE drafts SET status='confirming' WHERE id=? AND status='pending'` (claim); 0 linhas
→ 409. Depois chama o cliente; sucesso → `confirmed` + `ticketId` + mensagem `system` com o card;
falha → volta para `pending` e responde 503/409 com a mensagem do erro. Isso cobre confirmação dupla
simultânea. `confirming` é estado interno (a spec expõe `pending|confirmed|discarded`).
Posse: join `drafts → conversations.employeeId = session.employeeId`, senão 404.

### D9. Sessão sem biblioteca
Cookie `nexo_session` = `base64url(json{employeeId, role, exp}) + "." + HMAC-SHA256` com Web Crypto
(funciona no `proxy.ts` e nas rotas). Expiração de 8 h. `proxy.ts` faz só o redirecionamento por
sessão/papel; as rotas de API revalidam a sessão (defesa em profundidade). Login é uma Server Action
ou `POST /api/auth/login` que chama `getEmployeeByEmail`; senha qualquer não vazia.
*Alternativa*: Auth.js/iron-session — dependência a mais para um login simulado; rejeitada.

### D10. Banco do web
Drizzle com `node:sqlite` (mesmo driver do `tickets-api`), arquivo `WEB_DATABASE_FILE`, migrações em
`apps/web/drizzle/` aplicadas na primeira abertura. Tabelas conforme proposal (conversations,
messages, drafts); `parts`, `trace`, `decision`, `payload` como JSON texto validado com zod na
leitura. Índices: `conversations(employeeId, updatedAt)`, `messages(conversationId, createdAt)`.
Testes usam `:memory:`.

### D11. Modelo e env
`LLM_MODEL` default `google/gemini-3.5-flash-lite`, validado por regex `^[a-z0-9-]+/[\w.\-]+$`; o id
exato é conferido na task 1 (doc do model router e/ou `GET models` da API do Gemini) e, se não
existir, cai no reserva `google/gemini-3.1-flash-lite`. O model router do Mastra resolve a string e lê
`GOOGLE_GENERATIVE_AI_API_KEY`; trocar de provedor = trocar `LLM_MODEL` e a chave correspondente.
`SERVICE_TOKEN` passa a existir no web com o mesmo default `dev-service-token` do `tickets-api`.

### D12. Instruções do agent
Arquivo `packages/agent/src/instructions.ts` com texto pt-BR gerado a partir das constantes de
`@nexo/shared` (labels de categoria, `SLA_LABELS`, `REOPEN_WINDOW_HOURS`) para não divergir das
regras. Inclui: fluxo obrigatório `find_similar_tickets` → `draft_ticket`; usar `offer_options` para
perguntas fechadas; `report_decision` como última tool; nunca dizer "criei o chamado"; até 3 frases.
Data/hora atual injetada por resposta (via `instructions` dinâmicas com `requestContext`).

### D13. Eval
`scripts/eval/run.ts` (tsx) usa `createNexoAgent` com modelo real e um `TicketsClient` contra um
`tickets-api` em memória (`buildApp` + seed do pacote, já usado no teste de integração) e portas de
rascunho/conversa em memória — não cria chamados reais nem toca o banco do web. Pausa de 30 s entre
cenários (cada cenário ≤ 6 passos ⇒ < 15 req/min). Asserções: conjunto de tools chamadas e `intent`.

## Risks / Trade-offs

- [Gemini Flash Lite pode pular `report_decision` ou `find_similar_tickets`] → decisão sintética
  `other/low` (D4) e eval cobrindo; regras críticas não dependem disso.
- [Cota de 500 req/dia e 15/min no free tier] → 6 passos máx., 12 mensagens, eval manual e pausado,
  mensagem clara no 429.
- [APIs do Mastra/AI SDK mudam rápido; versão do `ai` vs `@mastra/ai-sdk`] → task 1 fixa versões
  compatíveis e confirma nomes (`requestContext`, `toAISdkStream`, `maxSteps`) na doc embutida.
- [Trace pode vazar dados sensíveis no painel] → output resumido por tool e sempre dentro do
  `employeeId` da sessão.
- [Modelo ignora o gating "aguardando analista" por prompt] → gating é na rota, antes do modelo.
- [SQLite com escrita concorrente no dev] → transações curtas; um processo Next.

## Migration Plan

Sem dados existentes no web. `pnpm install`, copiar `.env.example` → `.env` com a chave do Gemini,
`pnpm --filter @nexo/tickets-api seed`, `pnpm dev`. Rollback: reverter os commits; o `tickets-api`
não muda.

## Open Questions

- Id final do modelo (`gemini-3.5-flash-lite` vs reserva) — resolvido na task 1 sem afetar specs.
- Se `handleChatStream` aceitar o agent diretamente ou exigir instância `Mastra` — decide-se na task 1
  conforme a doc; a fábrica (D1) funciona nos dois casos.
