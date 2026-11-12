# Proposal

## Why

O `tickets-api` e o cliente de `@nexo/shared` já existem, mas o produto ainda não tem o que o define: o
agent Nexo Assist conversando com o funcionário. Esta change entrega o agent (packages/agent) e o chat
do funcionário (apps/web) com login, streaming, rascunhos confirmados fora do LLM e a transparência das
decisões visível em cada resposta, que é a prioridade máxima do projeto.

## What Changes

- **Modelo de LLM configurável**: `LLM_MODEL` no formato `provedor/modelo` (padrão
  `google/gemini-3.5-flash-lite`, reserva `google/gemini-3.1-flash-lite`, id exato confirmado na
  implementação), chave em `GOOGLE_GENERATIVE_AI_API_KEY`. Trocar de provedor é só mudar o env.
  Limites por resposta: até 6 passos de tool, `maxOutputTokens` moderado e só as últimas 12 mensagens
  enviadas ao modelo. 429 do provedor vira aviso claro ao funcionário e passo de trace com erro.
- **Agent Mastra** com instruções em pt-BR (tipos, categorias, prioridade × prazo, sem duplicidade,
  reabertura até 7 dias, transferência, privacidade, escopo só TI, perguntar quando faltar dado, nunca
  afirmar que criou chamado, respostas curtas) e 9 tools: `search_help_center`, `list_my_tickets`,
  `get_ticket`, `find_similar_tickets`, `draft_ticket`, `draft_ticket_update`, `offer_options`,
  `handoff_to_human` e `report_decision`. `employeeId`/`conversationId` vêm só do request context.
  Cada tool devolve resultado + `TraceStep`; toda resposta termina com uma `Decision`.
- **Login e sessão** no web: e-mail corporativo + qualquer senha, funcionário buscado no `tickets-api`,
  cookie httpOnly assinado (`SESSION_SECRET`) com `employeeId` e papel, redirecionamento por papel
  (`/chat` ou `/console` placeholder), logout e proteção de páginas e rotas de API.
- **Persistência do web** (SQLite + Drizzle em `WEB_DATABASE_FILE`): conversas, mensagens (com
  `parts`, `trace` e `decision`) e rascunhos. Ao abrir `/chat` a última conversa não encerrada é
  retomada; "Nova conversa" inicia outra.
- **API do chat**: `POST /api/chat` com gating determinístico (conversa de outro → 404; status ≠
  `agent` → não chama o LLM; 30 mensagens do funcionário → bloqueio), streaming e gravação de trace e
  decisão; `GET /api/conversations/current`; `POST /api/conversations`.
- **Rascunhos**: `POST /api/drafts/:id/confirm` executa criar/comentar/reabrir pelo cliente do
  `tickets-api` sem passar pelo LLM (segunda confirmação → 409) e `POST /api/drafts/:id/discard`.
- **UI do chat** seguindo o protótipo do Pencil (telas 1, 2 e 3): chips de trace expansíveis com
  input/output/duração e a decisão com badge de confiança, cards de chamado (selo "Vencido"), lista
  selecionável, card de rascunho com Confirmar/Descartar, opções rápidas, banner de analista com input
  desabilitado, contador "X de 30 mensagens" e estados de carregamento, vazio e erro.
- **Eval** (`pnpm eval`, fora do `pnpm test`): ~8 cenários com o modelo real, pausados para respeitar
  15 req/min, verificando tool chamada e `intent`.
- **README**: escolha do modelo, como o agent decide e como a qualidade foi verificada.
- A raiz `/` do web deixa de ser a página "Em construção" e passa a redirecionar conforme a sessão.

Fora de escopo: console do analista (próxima change; aqui só a página placeholder) e deploy.

## Capabilities

### New Capabilities
- `employee-auth`: login por e-mail corporativo, sessão em cookie assinado, papéis, logout e proteção
  de páginas e rotas.
- `chat-conversations`: conversas e mensagens persistidas no web, retomada e nova conversa, status da
  conversa, limite de 30 mensagens e gating da rota do chat (não chamar o LLM fora do status `agent`).
- `service-desk-agent`: comportamento do agent (regras do service desk nas instruções), tools com
  identidade vinda do contexto, limites de custo, modelo configurável e tratamento de falhas do
  `tickets-api` e do provedor.
- `decision-trace`: formato e registro de `TraceStep` e `Decision` em cada resposta e sua exibição
  legível na UI.
- `ticket-drafts`: rascunhos de criação, complemento e reabertura, confirmação e descarte
  determinísticos, idempotência e posse.
- `chat-ui`: tela de chat do funcionário (streaming, cards, opções rápidas, banner de analista,
  contador e estados de carregamento, vazio e erro) e tela de login.
- `agent-eval`: cenários de avaliação com o modelo real, fora da suíte de testes.

### Modified Capabilities
- `runtime-config`: o `web` passa a ler e validar `SERVICE_TOKEN`, `SESSION_SECRET`,
  `WEB_DATABASE_FILE`, `LLM_MODEL` e `GOOGLE_GENERATIVE_AI_API_KEY`, com padrões de desenvolvimento e
  `SESSION_SECRET` obrigatório em produção.
- `dev-workspace`: a raiz `/` do web redireciona para `/login`, `/chat` ou `/console` em vez de exibir a
  página estática.

## Impact

- `packages/agent`: novas dependências `@mastra/core` (e o que a doc exigir para o provedor Google),
  agent, instruções, tools, tipos de trace/decisão e testes com modelo/cliente falsos.
- `packages/shared`: schemas zod de `TraceStep` e `Decision` (usados por agent e web).
- `apps/web`: novas dependências (`@mastra/core`, `@mastra/ai-sdk`, `ai`, `@ai-sdk/react`,
  `drizzle-orm`, `drizzle-kit`, `@nexo/agent`); `env.ts` e `.env.example`; banco próprio com migrações;
  `middleware`/`proxy`, páginas `/login`, `/chat`, `/console`; rotas `/api/auth/*`, `/api/chat`,
  `/api/conversations*`, `/api/drafts/:id/*`; componentes do chat.
- Raiz: script `pnpm eval` e `scripts/eval`.
- `README.md` atualizado. Sem mudança no `tickets-api` (usa os endpoints já existentes).
- Custo externo: chamadas ao Gemini no free tier (15 req/min, 500/dia); testes automatizados nunca
  chamam o modelo real.
