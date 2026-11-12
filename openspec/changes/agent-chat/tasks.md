# Tasks

Cada seção termina com um commit (`git add` de arquivos específicos), feito só depois que os testes e o
`pnpm typecheck` da seção passarem.

## 1. Dependências e ambiente

- [x] 1.1 Ler a doc embutida em `node_modules/@mastra/core/dist/docs/` (após instalar) e o Context7 para confirmar: `Agent`/`createTool`, `RequestContext` em tools e instruções dinâmicas, `maxSteps`/`modelSettings.maxOutputTokens`, model router `google/...`, `toAISdkStream`/`handleChatStream` e a versão do `ai` compatível, e o modelo de teste (mock); registrar as decisões em notas no topo de `packages/agent/src/index.ts`; verificar que nenhuma API usada nas tasks seguintes ficou sem confirmação
- [x] 1.2 Adicionar `@mastra/core` ao `@nexo/agent`; `@mastra/core`, `@mastra/ai-sdk`, `ai`, `@ai-sdk/react`, `drizzle-orm`, `drizzle-kit` (dev) e `@nexo/agent` (`workspace:*`) ao `@nexo/web`, nas versões confirmadas; verificar `pnpm install` sem aviso de build bloqueado e `pnpm typecheck` verde
- [x] 1.3 Confirmar o id do modelo (`google/gemini-3.5-flash-lite`, senão `google/gemini-3.1-flash-lite`) pela lista do model router ou `GET models` da API do Gemini; verificar registrando o id escolhido no `.env.example`
- [x] 1.4 Estender `apps/web/src/env.ts` com `NODE_ENV`, `SERVICE_TOKEN` (padrão `dev-service-token` fora de produção, ≥ 16 em produção), `SESSION_SECRET` (padrão de dev, ≥ 32 em produção), `WEB_DATABASE_FILE` (`web.db`), `LLM_MODEL` (formato `provedor/modelo`) e `GOOGLE_GENERATIVE_AI_API_KEY` opcional; atualizar `apps/web/.env.example` com comentários; verificar com testes de `parseEnv` (padrões, `LLM_MODEL=gemini` falha, produção sem `SESSION_SECRET` falha citando a variável)
- [x] 1.5 Adicionar `traceStepSchema` e `decisionSchema` (+ tipos e rótulos pt-BR de intent e confiança) em `packages/shared/src/schemas/agent.ts` e reexportar; verificar com testes de parse (intent inválido, confidence inválida, `error` opcional)

## 2. Persistência do web

- [x] 2.1 Criar `apps/web/src/db/schema.ts` (conversations, messages, drafts com índices do design D10), `db/client.ts` (`createDb(file)` com `node:sqlite` + `migrate`) e `drizzle.config.ts`; gerar a primeira migração; verificar com teste em `:memory:` que insere e lê conversa, mensagem com `trace`/`decision` JSON e rascunho
- [x] 2.2 Criar repositório `src/chat/repository.ts`: `getCurrentConversation(employeeId)`, `createConversation` (fechando a anterior só se `agent`), `getOwnedConversation(id, employeeId)`, `appendUserMessage` (transação com incremento de `userMessageCount`), `appendMessage`, `lastMessages(conversationId, 12)`, `setStatus`, drafts (`insertDraft`, `claimDraft`, `finishDraft`, `releaseDraft`, `discardDraft`, `getOwnedDraft`); verificar com testes: retomar a última não encerrada, nova conversa fecha a anterior `agent` e preserva `waiting_human`, `lastMessages` devolve só 12 em ordem, `claimDraft` concorrente só vence uma vez, posse por `employeeId`
- [x] 2.3 Garantir `web.db*` no `.gitignore`; verificar com `git status` limpo após rodar os testes e o dev

## 3. Autenticação e login

- [x] 3.1 Implementar `src/auth/session.ts` (assinar/verificar cookie HMAC-SHA256 com Web Crypto, `exp` de 8 h) e `getSession()` para rotas e páginas; verificar com testes: cookie válido, adulterado, expirado, segredo errado
- [x] 3.2 Implementar `src/tickets.ts` (instância do `createTicketsClient` com `env`) e o login (`POST /api/auth/login` ou Server Action): valida com zod, `getEmployeeByEmail`, grava cookie httpOnly/`SameSite=Lax`, devolve destino por papel; `POST /api/auth/logout`; verificar com testes de handler com cliente falso: e-mail do seed → cookie + `/chat`, analista → `/console`, desconhecido → erro sem cookie, `TicketsUnavailableError` → mensagem de indisponível
- [x] 3.3 Criar `apps/web/proxy.ts` (Next 16) redirecionando sem sessão para `/login`, por papel entre `/chat` e `/console`, e `/` conforme a sessão; APIs sem sessão → 401; verificar com testes da função de decisão do proxy e manualmente no `pnpm dev`
- [x] 3.4 Criar a página `/login` seguindo a tela "Identificação" do Pencil (painel de apresentação + formulário, erros de campo e de serviço, estado enviando) e `/console` placeholder com "Sair"; remover a página "Em construção"; verificar no navegador com `ana.souza@nexo.com.br` e com um analista do seed

## 4. Tools do agent com testes

- [x] 4.1 Criar `packages/agent/src/context.ts` (chaves do `RequestContext`, `getSessionIds` que lança sem ids) e `src/trace.ts` (`withTrace`: duração, erro tipado → mensagem pt-BR, `TraceStep` com output resumido, resultado `{ ok, data|error, trace }`); definir as portas `DraftStore` e `ConversationStore`; verificar com testes de `withTrace` (sucesso, `TicketsUnavailableError`, erro de validação)
- [x] 4.2 Implementar `search_help_center`, `list_my_tickets(status?)`, `get_ticket(id)` e `find_similar_tickets(text)` com inputs zod `strict` sem ids de sessão; verificar com testes usando cliente falso: chamadas usam o `employeeId` do contexto, argumento `employeeId` extra é rejeitado, `isOverdue` presente, rótulos "Consultou seus chamados"/"Abriu o chamado X"
- [x] 4.3 Implementar `draft_ticket` (valida com `createTicketBodySchema`, calcula `dueAt` com `computeDueAt(now)` e `SLA_LABELS`, grava draft `pending` pela porta) e `draft_ticket_update(ticketId, kind, text)` (busca o chamado do funcionário; `comment` recusa resolvido/fechado; `reopen` exige `isReopenable`); verificar com testes: `draft_ticket` nunca chama `createTicket`, prazo de alta numa segunda 10h = 14h, campo faltando → erro sem draft, reabertura fora de 7 dias recusada
- [x] 4.4 Implementar `offer_options(question, options[2..6])`, `handoff_to_human(reason, summary, ticketId?)` (status `waiting_human` pela porta e `escalateTicket` quando há `ticketId`) e `report_decision(intent, action, confidence, reason)` com `decisionSchema`; verificar com testes: handoff muda o status e escala só com `ticketId`, falha no escalate ainda transfere a conversa e registra o erro no trace, decisão inválida é rejeitada
- [x] 4.5 Verificar com teste de privacidade ponta a ponta das tools contra o `tickets-api` em memória (`createTestApp`): contexto do funcionário principal pedindo chamado de outro funcionário → `TicketNotFoundError` no trace e nenhum dado do outro no output

## 5. Agent e instruções

- [x] 5.1 Escrever `src/instructions.ts` em pt-BR a partir das constantes de `@nexo/shared` (tipos, categorias, prioridade × prazo, duplicidade, reabertura 7 dias, transferência, privacidade, escopo só TI, perguntar quando faltar dado, nunca afirmar criação, respostas curtas, `report_decision` sempre por último, confiança baixa → oferecer analista) com data/hora atual injetada; verificar com teste de snapshot que cita todas as categorias, os 4 prazos e a janela de 7 dias
- [x] 5.2 Implementar `createNexoAgent({ model, tickets, drafts, conversations, now })` com as 9 tools, e `streamNexoReply(...)` aplicando `maxSteps: 6` e `maxOutputTokens`; exportar no `index.ts` sem nenhum import de Next/`apps/*`; verificar com teste usando modelo falso que roteiriza `list_my_tickets` → `report_decision`: as tools recebem o contexto, o trace e a decisão são coletados, e o limite de 6 passos encerra um modelo em laço
- [x] 5.3 Implementar `collectTurn(result)` que extrai `TraceStep[]`, `Decision` (ou sintética `other/low`) e partes de UI (cards, lista, rascunho, opções, transferência) dos resultados das tools, e `classifyProviderError` (429 → `provider_rate_limited`, 5xx/rede → `provider_unavailable`); verificar com testes de unidade cobrindo decisão ausente e os dois tipos de erro

## 6. /api/chat com streaming e gating

- [ ] 6.1 Implementar `decideChatGate` (puro) e `createChatHandler({ db, tickets, agentFactory, env })` para `POST /api/chat`: sessão, posse (404), status ≠ `agent` (sem LLM, devolve estado), limite 30 (sem gravar), sem chave → "assistente não configurado", grava mensagem do usuário, carrega últimas 12 do banco, `RequestContext` com `employeeId`/`conversationId`, stream convertido para UI message stream, grava resposta com trace/decisão/partes no fim e o passo `llm` com erro em 429/5xx; verificar com testes usando agent falso: não chama o agent em `waiting_human`/`with_human`, 30ª passa e 31ª é bloqueada, conversa de outro → 404, sem sessão → 401, 429 grava passo com erro e mensagem clara, o modelo recebe só 12 mensagens
- [ ] 6.2 Implementar `GET /api/conversations/current` e `POST /api/conversations`; verificar com testes: devolve só a conversa do dono com `userMessageCount` e mensagens em ordem; nova conversa fecha a anterior `agent`

## 7. Rascunhos: confirm/discard com testes

- [ ] 7.1 Implementar `POST /api/drafts/:id/confirm` (posse → 404; conversa `closed` → 409; `claimDraft` → 409 se não `pending`; executa `createTicket`/`addComment`/`reopenTicket` pelo cliente; sucesso → `confirmed` + `ticketId` + mensagem `system` com card; falha → `releaseDraft` e 503/409 com mensagem) sem nenhuma referência ao agent; verificar com testes de cliente falso: cria uma única vez, segunda confirmação → 409, duas confirmações paralelas → 1 chamada ao cliente, draft de outro → 404, indisponível → 503 e draft volta `pending`, 409 do serviço repassa o motivo, conversa `waiting_human` ainda confirma
- [ ] 7.2 Implementar `POST /api/drafts/:id/discard`; verificar com testes: `discarded` sem chamar cliente, já confirmado → 409, de outro → 404

## 8. UI do chat e trace

- [ ] 8.1 Montar o layout de `/chat` seguindo "Chat — Novo chamado" do Pencil (barra lateral com Atendimento/perfil/Sair, cabeçalho "Service desk de TI › Atendimento" com estado, área de mensagens, composer "Escreva para o Nexo…"/"Enviar", contador "X de 30 mensagens nesta conversa", "Nova conversa"), carregando a conversa atual no servidor; verificar no navegador com estado de carregamento, vazio (sugestões) e histórico retomado após reload
- [ ] 8.2 Integrar `useChat` com transport que envia `{ conversationId, text }` para `/api/chat`, streaming de texto, indicador de resposta, envio bloqueado durante streaming, 401 → `/login`, erros (rede, tickets indisponível, 429, não configurado) como avisos sem esconder o histórico; verificar no navegador com `FAILURE_RATE=1` no `tickets-api` e sem chave do Gemini
- [ ] 8.3 Implementar `TraceChips` + painel expansível (input/output/duração por passo, passo com erro destacado, decisão com intent em pt-BR, ação, badge Alta/Média/Baixa e motivo) usado tanto nas partes `tool-*` em streaming quanto no `trace` gravado; com `confidence: low` mostrar "Falar com um analista"; verificar com testes de componente (renderização de passo com erro e da decisão sintética) e no navegador
- [ ] 8.4 Implementar `TicketCard` (id, título, status, prioridade, prazo, selo "Vencido"), `TicketPicker` (lista selecionável → envia escolha), `DraftCard` (Confirmar/Descartar chamando as rotas, botões desabilitados durante a ação, estados confirmado/descartado/erro) e `QuickOptions` (botões numerados, desabilitados em respostas antigas), seguindo "Chat — Novo chamado" e "Chat — Consulta e transferência"; verificar no navegador o fluxo VPN 809 Windows 11 até o card do chamado criado e o fluxo de consulta do INC-20311 vencido
- [ ] 8.5 Implementar banner "Aguardando um analista"/"Em atendimento com analista" com input desabilitado e polling de `GET /api/conversations/current` a cada 3 s enquanto transferida, e bloqueio ao atingir 30 mensagens; verificar no navegador pedindo "quero falar com um atendente"

## 9. Eval

- [ ] 9.1 Criar `scripts/eval/run.ts` e o script `pnpm eval` na raiz (fora do `pnpm test`): exige `GOOGLE_GENERATIVE_AI_API_KEY` (sai com código ≠ 0 sem ela), usa `createNexoAgent` com o modelo de `LLM_MODEL`, `tickets-api` em memória semeado e portas em memória, pausa de 30 s entre cenários; os 8 cenários do spec `agent-eval` com asserções de tools e `intent`; imprime resultado por cenário e total, código ≠ 0 se algum falhar; verificar que `pnpm test` não o inclui e rodar `pnpm eval` no máximo 2 vezes, registrando o resultado

## 10. README

- [ ] 10.1 Atualizar `README.md`: como rodar (env, seed, dev, login), arquitetura (web ↔ agent ↔ tickets-api, sessão, banco do web), como o agent decide (tools, instruções, trace/decisão, gating no código), escolha do modelo (free tier custo zero, latência baixa, regras críticas no código, troca por env, limites 6 passos/12 mensagens/`maxOutputTokens`), qualidade (testes + resultado do `pnpm eval`), trade-offs e próximos passos; verificar seguindo o README do zero num clone limpo até uma conversa funcionando

## Workflow follow-up

- Revisar e arquivar a change (`/opsx:archive`) depois que todas as tasks estiverem concluídas.
- Próxima change: console do analista (telas 4 e 5 do Pencil).
