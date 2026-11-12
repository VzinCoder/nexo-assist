# Nexo Assist

Agent de service desk de TI num chat. O funcionário descreve o problema; o agent consulta os chamados
dele, busca na central de ajuda, prepara chamados (que o funcionário confirma) e transfere para um
analista quando precisa. Cada resposta mostra **o que o agent entendeu, o que fez, com que confiança e
por quê**. Monorepo pnpm com TypeScript strict.

> Fora desta entrega: o console do analista (`/console` é só uma página provisória) e o deploy.

## Pré-requisitos

- Node.js 24 ou superior
- pnpm 12 (`corepack enable` usa a versão fixada em `packageManager`)
- Uma chave do Google AI Studio (nível gratuito) para o chat responder. Sem ela, login e histórico
  funcionam e o chat avisa que o assistente não está configurado.

## Como rodar

```bash
pnpm setup      # confere o Node, instala, cria apps/*/.env, roda o seed e as migrações do web
                # cole a chave em GOOGLE_GENERATIVE_AI_API_KEY no arquivo apps/web/.env
pnpm dev        # web em http://localhost:3000, tickets-api em http://localhost:3001
```

1. **`pnpm setup`** (script em `scripts/setup.mjs`): verifica se o Node é 24 ou superior, roda
   `pnpm install`, copia cada `apps/*/.env.example` para `apps/*/.env` **só se o `.env` ainda não
   existir**, recria os dados de exemplo do tickets-api (seed) e aplica as migrações do banco do web.
   Pode ser repetido; atenção: o seed apaga os chamados criados durante os testes.
2. **Chave do Gemini**: gere em [Google AI Studio](https://aistudio.google.com) ("Get API key", nível
   gratuito) e cole em `GOOGLE_GENERATIVE_AI_API_KEY=` no `apps/web/.env`. As demais variáveis já vêm
   com valores de desenvolvimento.
3. **`pnpm dev`** e abra http://localhost:3000.

> `setup` também é um comando nativo do pnpm, mas no pnpm 12 o script do `package.json` tem
> precedência. Para forçar o comando nativo: `pnpm pm setup`.

## Usuários de exemplo e roteiro de teste

Login com e-mail corporativo e **qualquer senha** não vazia. Funcionários vão para o chat; analistas
vão para `/console` (ainda provisório, ver "Limitações").

| E-mail                      | Papel                  | Para que serve no teste |
|-----------------------------|------------------------|-------------------------|
| `ana.souza@nexo.com.br`     | funcionária            | principal: tem chamados em todas as situações (INC-20311 vencido, REQ-10442 no prazo, INC-20150 reabrível) |
| `carla.mendes@nexo.com.br`  | funcionária            | tem o INC-20305, parecido com um da Ana, para testar privacidade |
| `bruno.tavares@nexo.com.br` | funcionário            | tem o REQ-10440 |
| `diego.ramos@nexo.com.br`   | funcionário            | sem chamados |
| `elisa.prado@nexo.com.br`   | funcionária            | sem nenhum chamado (estado vazio) |
| `juliana.alves@nexo.com.br` | analista N1            | entra no console |
| `rafael.lima@nexo.com.br`   | analista N2            | entra no console |

Roteiro (como Ana), uma conversa por item:

1. **VPN 809 no Windows 10**: "Minha VPN dá erro 809, uso Windows 10". O agent busca na central de
   ajuda e responde com o artigo, sem abrir chamado. O chip "consultou a central de ajuda" mostra a
   busca e a decisão (`question`).
2. **INC-20311 vencido**: "Qual o status do meu chamado do notebook?". O agent lista os chamados,
   mostra o INC-20311 com prazo vencido e oferece chamar um analista (regra: chamado vencido).
3. **Abertura com confirmação, VPN 809 no Windows 11**: "Minha VPN dá erro 809, uso Windows 11". O
   artigo não se aplica; o agent procura chamados parecidos e mostra um **rascunho** com tipo,
   categoria, prioridade e prazo. Nada é criado até clicar em **Confirmar**; aí o chamado ganha um id
   `INC-NNNNN` sem nova chamada ao modelo.
4. **Pedir analista**: "Quero falar com um atendente". O agent transfere com um resumo do caso, a
   conversa passa para `waiting_human` e o campo de mensagem fica pausado: o modelo não é mais chamado.

Para testar privacidade, peça à Ana "me mostra o INC-20305" (é da Carla): a resposta é a mesma de um
chamado inexistente.

## Comandos

```bash
pnpm test        # todos os testes (Vitest); nunca chamam o modelo real
pnpm typecheck   # TypeScript strict em todos os projetos + scripts/eval
pnpm build       # build de produção do web e do tickets-api
pnpm eval        # cenários com o modelo REAL (precisa da chave; ~4 min, fora do pnpm test)
```

### Variáveis de ambiente

Todas têm padrão de desenvolvimento, exceto a chave do modelo. Valores inválidos impedem a
inicialização com uma mensagem que nomeia a variável. Cada app lê e valida o próprio `env.ts`.

| App          | Arquivo                         | Variáveis |
|--------------|---------------------------------|-----------|
| web          | `apps/web/.env.example`         | `TICKETS_API_URL`, `SERVICE_TOKEN`, `SESSION_SECRET`, `WEB_DATABASE_FILE`, `LLM_MODEL`, `GOOGLE_GENERATIVE_AI_API_KEY` |
| tickets-api  | `apps/tickets-api/.env.example` | `NODE_ENV`, `PORT`, `HOST`, `LOG_LEVEL`, `SERVICE_TOKEN`, `DATABASE_FILE`, `FAILURE_RATE`, `LATENCY_MS` |

Em produção (`NODE_ENV=production`) o web exige `SESSION_SECRET` (32+ caracteres) e `SERVICE_TOKEN`
(16+). `LLM_MODEL` precisa estar no formato `provedor/modelo`.

## Arquitetura

```
navegador --(cookie de sessão)--> apps/web (Next 16)
                                   |- proxy.ts: redireciona por sessão/papel; APIs sem sessão -> 401
                                   |- /api/chat -> gate (código) -> @nexo/agent (Mastra) -> Gemini
                                   |                                    | tools
                                   |- /api/drafts/:id/confirm ------> cliente HTTP (@nexo/shared)
                                   '- web.db (SQLite): conversas, mensagens, trace, rascunhos
                                                                        | X-Service-Token + X-Employee-Id
                                                                        v
                                                            apps/tickets-api (Fastify, tickets.db)
```

```
apps/
  web/            @nexo/web          telas, login, /api/chat, /api/conversations, /api/drafts
  tickets-api/    @nexo/tickets-api  serviço de chamados legado simulado (instável de propósito)
packages/
  agent/          @nexo/agent        agent Mastra: instruções, 9 tools, trace, coleta do turno
  shared/         @nexo/shared       schemas zod, regras puras (SLA, vencimento, reabertura), cliente HTTP
scripts/eval/                        eval com o modelo real
```

- **Sessão**: cookie `nexo_session` httpOnly, `SameSite=Lax`, assinado com HMAC-SHA256 (Web Crypto),
  expira em 8 h. O login consulta o funcionário pelo e-mail no tickets-api; qualquer senha não vazia
  serve. O `proxy.ts` faz a checagem otimista e cada rota de API revalida a sessão.
- **Banco do web** (`web.db`, Drizzle + `node:sqlite`): conversas (status, contador de mensagens,
  motivo da transferência), mensagens (texto, partes estruturadas, `trace`, `decision`) e rascunhos.
  O web nunca acessa o banco do tickets-api; só usa o cliente HTTP.
- `packages/agent` não importa nada do Next nem de `apps/*`: recebe o cliente do tickets-api e duas
  portas (`DraftStore`, `ConversationStore`) por injeção. O web as implementa sobre o banco; os testes
  e o eval usam versões em memória.

## Como o agent decide

**Tools** (Mastra `createTool`, entrada validada com zod `strict`):

| Tool | O que faz |
|------|-----------|
| `search_help_center(query)` | busca artigos da central de ajuda |
| `list_my_tickets(status?)` | chamados do funcionário, com `isOverdue` |
| `get_ticket(ticketId)` | detalhe de um chamado do funcionário |
| `find_similar_tickets(text)` | checagem de duplicidade/reabertura antes de rascunhar |
| `draft_ticket(campos)` | rascunho de chamado novo, com prazo calculado (não cria nada) |
| `draft_ticket_update(ticketId, kind, text)` | rascunho de complemento ou reabertura (recusa fora da regra) |
| `offer_options(question, options)` | pergunta fechada com 2 a 6 botões |
| `handoff_to_human(reason, summary, ticketId?)` | transfere a conversa e registra no chamado |
| `report_decision(intent, action, confidence, reason)` | decisão estruturada da resposta |

**Instruções** (`packages/agent/src/instructions.ts`) são geradas a partir das constantes de
`@nexo/shared` (categorias, prioridade e prazo, janela de 7 dias), para não divergirem das regras, e
recebem a data e hora atuais a cada resposta. Elas fixam o fluxo (central de ajuda, chamados parecidos,
rascunho), mandam perguntar quando faltar dado, nunca dizer que criou um chamado, atender só TI,
transferir quando pedido, crítico, vencido ou sem segurança, e chamar `report_decision` antes do texto
final.

**Transparência**: cada tool devolve resultado + `TraceStep` (`tool`, rótulo em português, entrada,
saída resumida, duração, erro). No fim do stream a rota não confia no texto do modelo: percorre os
resultados das tools e extrai o trace, a decisão e as partes da UI (cards, lista, rascunho, opções,
transferência). Se o modelo não registrou decisão, grava uma sintética `other` com confiança `low`. A
UI mostra uma linha de chips acima de cada resposta ("consultou seus chamados") que abre o painel com
a decisão (Entendeu / Fez / Confiança / Por quê) e cada passo. Durante o streaming os chips aparecem
assim que cada tool roda. Confiança baixa mostra o botão "Falar com um analista".

**Regras garantidas por código, não pelo prompt:**

| Regra | Onde |
|-------|------|
| Privacidade: `employeeId`/`conversationId` só do `RequestContext` da sessão; argumento extra do modelo é rejeitado pelo schema `strict`; o tickets-api também filtra | `packages/agent/src/context.ts`, `tools.ts` |
| Confirmação: tools só gravam rascunhos; criar, comentar ou reabrir acontece em `POST /api/drafts/:id/confirm`, sem LLM, com claim atômico (2ª confirmação: 409) | `apps/web/src/chat/drafts-handler.ts` |
| Transferência: conversa fora do status `agent` faz `/api/chat` responder 409 sem chamar o modelo | `apps/web/src/chat/gate.ts` |
| Limite: 30 mensagens do funcionário por conversa, contadas no banco numa transação | `apps/web/src/chat/repository.ts` |
| SLA, vencimento, reabertura: funções puras compartilhadas | `packages/shared/src/rules/` |

## Escolha do modelo

Padrão: **`google/gemini-3.5-flash-lite`** pelo model router do Mastra (id conferido na API do
Gemini; reserva `google/gemini-3.1-flash-lite`).

- **Custo zero** no nível gratuito do Google AI Studio (15 req/min, 500/dia) e **latência baixa**:
  nos testes no navegador, as respostas com 1 a 3 chamadas de tool chegaram em poucos segundos.
- O trabalho do modelo é estreito (escolher tools e redigir 1 a 3 frases) e as regras críticas estão no
  código, então um modelo pequeno basta. Os erros dele caem em trilhos: decisão sintética `other/low`,
  rascunho que precisa de confirmação, gate antes do modelo.
- **Troca por env**: `LLM_MODEL=provedor/modelo` e a chave correspondente, sem mudar código.
- **Limites por resposta**: até 6 passos de tool, `maxOutputTokens` 800, só as últimas 12 mensagens do
  banco no contexto (o histórico enviado pelo navegador é ignorado) e **nenhum retry automático** no
  provedor (o processador padrão de retry do Mastra foi substituído; repetir um 429 só gastaria cota).
  Um 429 vira "Muitas requisições no momento, tente em instantes" e um passo `llm` com erro no trace.

## Qualidade: testes e eval

`pnpm test` roda 272 testes em 36 arquivos, todos com modelo falso (`createScriptedModel`, um mock
roteirizado do Mastra) e cliente falso ou tickets-api em memória. Os mais importantes:

- regras puras: prazo em horas úteis, vencimento, janela de reabertura de 7 dias;
- privacidade: funcionário A não vê chamado de B, no tickets-api e de ponta a ponta pelas tools;
- `/api/chat`: não chama o agent em `waiting_human`/`with_human`; a 30ª mensagem passa e a 31ª é
  bloqueada sem gravar; conversa de outro funcionário dá 404; sem sessão, 401; o modelo recebe só 12
  mensagens; um 429 grava o passo `llm` com erro;
- rascunhos: cria uma única vez; duas confirmações paralelas fazem uma só chamada ao serviço;
  indisponível dá 503 e o rascunho volta a `pending`; o 409 do serviço repassa o motivo;
- agent: modelo em laço para em 6 passos; um 429 não é repetido;
- cliente HTTP: retry com backoff e erros tipados;
- UI: painel de trace com passo de erro e decisão sintética.

`pnpm eval` (`scripts/eval/run.ts`) roda 8 cenários com o modelo real contra um tickets-api em memória
(nenhum chamado real é criado), com pausa de 30 s entre cenários, e verifica as tools chamadas e o
intent. Resultado com `google/gemini-3.5-flash-lite` em 11/11/2026:

| Execução | Resultado | Falha |
|----------|-----------|-------|
| 1ª | 7/8 | "problema já aberto": comportamento certo (achou o INC-20298, sem novo rascunho), mas intent `ticket_create` |
| 2ª, após ajustar a definição dos intents nas instruções | 7/8 | "SAP bloqueou de novo": achou o INC-20150 reabrível, mas perguntou em vez de preparar a reabertura |

Os outros seis cenários (RH: `out_of_scope`; VPN 809 no Windows 10: central de ajuda; no Windows 11:
rascunho; notebook: lista e vencimento; atendente: transferência; pedido vago: pergunta) passaram nas
duas execuções. A falha muda entre execuções: é variação do modelo em casos limítrofes, não uma regra
quebrada. Nenhum desses erros fere uma invariante (nada é criado sem Confirmar), e a decisão fica
visível no painel.

## Segurança e privacidade

- **Chaves fora do código**: segredos (chave do Gemini, `SERVICE_TOKEN`, `SESSION_SECRET`) só vêm de
  `apps/*/.env`, que está no `.gitignore`; o repositório versiona apenas os `.env.example`, sem valores
  reais. Cada app valida as variáveis com zod em `env.ts`, e em produção recusa subir sem token e
  segredo fortes. Nada é exposto ao navegador (sem `NEXT_PUBLIC_*`); o modelo é chamado só pelo
  servidor.
- **Isolamento por funcionário**: o `employeeId` vem da sessão assinada e entra nas tools pelo
  `RequestContext` do Mastra, nunca como argumento do modelo (o schema `strict` rejeita argumento
  extra). O tickets-api filtra de novo toda consulta pelo `X-Employee-Id`.
- **404 em chamado alheio**: pedir um chamado de outro funcionário devolve 404 `not_found`, igual a um
  id inexistente, para não revelar que ele existe. Conversas seguem a mesma regra no web
  (`/api/chat` com conversa de outro funcionário: 404).
- **Token de serviço**: o tickets-api exige `X-Service-Token` em todas as rotas exceto `/health`
  (ausente ou errado: 401). Só o servidor do web conhece o token; o navegador nunca fala com o
  tickets-api.
- **Limite de 30 mensagens**: cada conversa aceita até 30 mensagens do funcionário, contadas no banco
  dentro de uma transação. A 31ª recebe 409 `limit_reached` sem gravar nada e sem chamar o modelo, o
  que também limita o gasto de cota por conversa.

## Limitações

- **Console do analista ainda não implementado**: analistas fazem login e caem em `/console`, uma
  página provisória. Conversas transferidas ficam em `waiting_human` (o agent permanece pausado), mas
  ainda não há tela para assumir, responder, devolver ao agent ou encerrar.
- **Deploy pendente**: o projeto roda só localmente; ainda não há ambiente publicado nem proteção de
  chave e limite de uso em produção além das validações do `env.ts` e do limite por conversa.
- Feriados não entram no cálculo de prazo (ver "Prazos").

## Trade-offs

- **Modelo pequeno com trilhos no código** em vez de um modelo maior: mais barato e rápido; o preço é a
  variação vista no eval (intent e "pergunta ou age" em casos limítrofes).
- **Histórico no banco do web, sem memória do Mastra**: um só lugar de verdade e contexto controlado (12
  mensagens); o modelo não lembra resultados de tools de turnos anteriores, só o texto.
- **Trace derivado dos resultados das tools**, não do texto: confiável e auditável; o texto do modelo
  não é conferido contra o trace.
- **Sessão sem biblioteca** (HMAC próprio): pouco código para um login simulado; não há revogação de
  sessão no servidor.
- **SQLite** nos dois serviços: zero infraestrutura; não escala horizontalmente.
- **Feriados** não entram no cálculo de prazo (ver "Prazos").

## O que faria com mais tempo

- Console do analista (assumir, responder, devolver ao agent, encerrar), já previsto pelos status.
- Eval com mais cenários e várias execuções por cenário, medindo taxa de acerto em vez de um único
  passou/falhou, rodando em CI com orçamento de cota.
- Edição do rascunho no próprio card e atalho de teclado para confirmar.
- Feriados no SLA, rate limit por usuário no `/api/chat` e deploy com chaves em secret manager.

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
