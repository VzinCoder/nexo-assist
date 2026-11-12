# CLAUDE.md — Nexo Assist

Agent de service desk de TI num chat. O funcionário descreve o
problema, o agent consulta os chamados dele, busca na central de ajuda, abre/atualiza chamados e
transfere para um analista quando precisa. Há também um console do analista.

**Prioridade máxima: transparência das decisões do agent** (o que entendeu, que ação
tomou, com que confiança e por quê, visível em cada resposta).

## Stack

- TypeScript com `strict: true` em todos os projetos. Proibido `any`; use `unknown` + zod.
- Monorepo com **pnpm workspaces**.
- `apps/web`: Next.js (App Router) — telas, login, rotas de API do chat e do console.
- `apps/tickets-api`: Fastify — serviço de chamados **legado simulado**, separado do agent.
- `packages/agent`: agent com **Mastra** (tools, prompt, regras de negócio).
- `packages/shared`: schemas zod, tipos e cliente HTTP do tickets-api.
- Persistência: SQLite + Drizzle (um banco para `tickets-api`, outro para `web`).
- Streaming do chat: AI SDK (`useChat`) integrado ao Mastra.
- Testes: Vitest.

## Comandos

```bash
pnpm install                         # instala tudo
pnpm dev                             # sobe web (3000) e tickets-api (3001)
pnpm test                            # testes de todos os projetos
pnpm --filter @nexo/tickets-api seed # recria os dados de exemplo
pnpm --filter @nexo/web dev          # roda só um projeto
```

## Estrutura

```
apps/
  web/            @nexo/web          Next: UI + rotas /api/chat, /api/conversations, /api/auth
  tickets-api/    @nexo/tickets-api  Fastify + SQLite próprio + seed
packages/
  agent/          @nexo/agent        Mastra agent, tools, prompt, regras puras (SLA, prioridade)
  shared/         @nexo/shared       schemas zod, tipos, cliente HTTP do tickets-api
```

Regras de dependência (não quebrar):
- `packages/agent` **não importa nada do Next** nem de `apps/*`.
- `packages/shared` não depende de nenhum outro pacote do repo.
- `apps/web` nunca acessa o banco do `tickets-api`; só via cliente HTTP de `@nexo/shared`.
- Pacotes internos são referenciados com `"workspace:*"`.

## Regras do service desk — o agent deve seguir

- **Tipos**: `INC` (incidente: algo parou/não funciona) e `REQ` (requisição: acesso, equipamento, software).
- **Categorias**: Acesso, Rede e VPN, Hardware, Software, E-mail, Outros.
- **Abertura**: todo chamado exige título, descrição, tipo, categoria, prioridade e quem é afetado.
  O agent mostra um **rascunho** e só cria/atualiza **após confirmação** do funcionário.
- **Sem duplicidade**: se há chamado aberto sobre o mesmo problema, atualiza em vez de criar.
  Chamados resolvidos há até 7 dias podem ser **reabertos**.
- **Transferência** para analista quando: o funcionário pede, caso crítico, chamado vencido, ou o agent
  não tem segurança. Leva um resumo do caso. **O agent não responde enquanto a conversa está com analista.**
- **Privacidade**: dados de um chamado só para quem o abriu.
- **Escopo**: só TI. RH, financeiro e facilities são redirecionados.

### Prioridade e prazo (SLA)

Prioridade = impacto (quantas pessoas) + urgência (compromisso em risco). O prazo vale para a primeira
resposta e para cada atualização; passado o prazo, o chamado está **vencido**.

| Prioridade | Quando usar                                                | Prazo          |
|------------|------------------------------------------------------------|----------------|
| Crítica    | Algo parado para uma equipe ou para a empresa              | 1 hora         |
| Alta       | Impede uma pessoa de trabalhar, ou compromisso no mesmo dia | 4 horas úteis  |
| Média      | Atrapalha, mas há alternativa                              | 3 dias úteis   |
| Baixa      | Pedidos e melhorias sem urgência                           | 5 dias úteis   |

Horário útil: segunda a sexta, 8h às 18h (fuso America/Sao_Paulo).

## Invariantes garantidas por código (não pelo LLM)

Estas regras são determinísticas e testadas. Nunca delegar ao prompt:

1. **Privacidade**: as tools recebem o `employeeId` do contexto da sessão (runtime context do Mastra),
   **nunca** como argumento vindo do LLM. O `tickets-api` também filtra por `employeeId`.
2. **Confirmação**: a tool `draft_ticket` só gera um rascunho. A criação real acontece quando o
   funcionário clica em "Confirmar" no card, chamando a API diretamente, sem passar pelo LLM.
3. **Transferência**: se `conversation.status !== "agent"`, a rota `/api/chat` **não chama o LLM**.
4. **SLA e vencimento**: calculados por funções puras em `packages/agent/src/rules/`.
5. **Limite**: 30 mensagens do funcionário por sessão, contadas no banco.

Status da conversa: `agent` → `waiting_human` → `with_human` → (`agent` | `closed`).

## Tools do agent

- `search_help_center(query)`: busca por palavra-chave nos artigos (sem embeddings, são 5–10 artigos).
- `list_my_tickets(filter?)`: chamados do funcionário logado, com `isOverdue`.
- `get_ticket(id)`: detalhe de um chamado do funcionário logado.
- `find_similar_tickets(description)`: checagem de duplicidade/reabertura antes do rascunho.
- `draft_ticket(fields)`: monta rascunho (inclui prioridade + prazo calculado).
- `draft_ticket_update(id, comment)`: rascunho de complemento/reabertura.
- `handoff_to_human(reason, summary)`: transfere e muda status para `waiting_human`.
- `report_decision(...)`: chamada **sempre no fim de cada resposta** (ver abaixo).

## Transparência (parte mais importante)

Toda tool retorna, além do resultado, um passo de trace. Toda resposta do agent termina com uma decisão
estruturada. Ambos são salvos junto da mensagem e exibidos na UI.

```ts
type TraceStep = {
  tool: string;
  label: string;          // texto curto para o chip: "Consultou seus chamados"
  input: unknown;
  output: unknown;
  durationMs: number;
  error?: string;
};

type Decision = {
  intent: "question" | "ticket_status" | "ticket_update" | "ticket_create"
        | "handoff" | "out_of_scope" | "other";
  action: string;         // o que o agent fez
  confidence: "high" | "medium" | "low";
  reason: string;         // por quê, em 1–2 frases, citando a regra quando houver
};
```

- UI: chips acima de cada resposta (`label`), expansíveis para ver `input/output` e a `Decision`.
- `confidence: "low"` → o agent deve oferecer/fazer transferência.

## Serviço legado (tickets-api)

- Simula instabilidade: `FAILURE_RATE` (ex.: 0.1) devolve 503 e `LATENCY_MS` adiciona atraso.
- O cliente em `@nexo/shared` tem timeout, retry com backoff exponencial (3 tentativas) e erros tipados
  (`TicketsUnavailableError`, `TicketNotFoundError`).
- Se falhar após os retries, o agent avisa o funcionário de forma clara e registra o erro no trace.
- Endpoints: consultar, criar, atualizar (comentário/reabrir) e transferir chamados.

## Dados de exemplo

O seed deve ter: alguns funcionários; 5–10 artigos curtos da central de ajuda (incluir o da VPN erro 809,
válido só para Windows 10, e o do horário do service desk); chamados em situações variadas: aberto,
**vencido**, resolvido recentemente (≤ 7 dias), e chamados **de outros funcionários** (para testar
privacidade). Incluir INC-20311, REQ-10442 e INC-20150.

## Interface

Seguir o protótipo do Pencil (layout e estilo):
1. Login: e-mail corporativo + senha (qualquer senha para funcionários do seed).
2. Chat — abertura de chamado: perguntas com opções rápidas, prioridade com prazo, rascunho para confirmar.
3. Chat — consulta: seleção entre chamados abertos, status com prazo vencido, oferta de chamar analista.
4. Console — conversa transferida: lista com filtros e status, histórico, agent pausado, chamados do funcionário.
5. Console — analista atendendo: assumir, devolver ao agent, encerrar.

Sempre tratar estados de carregamento, vazio e erro. Console atualiza por polling (2–3 s).

## Custo e eficiência

- Modelo barato/rápido; justificar a escolha no README.
- Enviar ao LLM só as últimas N mensagens da conversa (histórico completo fica no banco).
- Não chamar o LLM para ações determinísticas (confirmar rascunho, mudar status).

## Convenções

- Validar toda entrada externa (body HTTP, args de tool, env) com zod.
- Variáveis de ambiente lidas e validadas em um único módulo `env.ts` por app; nunca chaves no código.
  Manter `.env.example` atualizado.
- Funções puras para regras de negócio; efeitos (HTTP, banco) nas bordas.
- Nomes de código em inglês; textos da UI e respostas do agent em português.
## MCPs disponíveis

- **mastra** (docs): consulte **antes** de escrever ou alterar qualquer código do Mastra (Agent, tools,
  runtime context, streaming, integração com Next). Não confie em APIs de memória; a lib muda rápido.
- **context7**: consulte a documentação atual de Next.js (App Router), Fastify, Drizzle, AI SDK e zod
  quando houver dúvida de API ou versão.
- **pencil**: fonte da verdade da interface. Antes de implementar uma tela, leia a tela correspondente no
  arquivo .pen e siga layout, espaçamentos, cores e componentes. Não altere o arquivo de design.

## Git

- Commits pequenos e coerentes: um por task concluída, somente depois que os
  testes e o typecheck dela passarem.
- `git add` com os arquivos específicos da mudança, nunca `git add .`.
  Conferir com `git status` que nenhum `.env`, arquivo `.db` ou configuração
  local de editor entra no commit.
- Mensagem contendo apenas o título no padrão abaixo, sem rodapés ou trailers.
- Nunca executar `git push`, `git rebase` ou `git reset`.
- Padrão das mensagens: Conventional Commits, prefixo em inglês (`feat:`,
  `fix:`, `test:`, `docs:`, `chore:`, `refactor:`) e descrição em português,
  no imperativo. Ex.: `feat: adiciona seed de chamados no tickets-api`.
  
## Testes (onde fazem diferença)

- Regras puras: cálculo de prazo em horas úteis, vencimento, prioridade.
- Duplicidade e janela de reabertura de 7 dias.
- Privacidade no tickets-api (funcionário A não vê chamado de B).
- `/api/chat` não chama o LLM quando a conversa está com analista.
- Cliente HTTP: retry e erro após falhas do legado.
- `scripts/eval`: cenários de conversa verificando a tool/decisão esperada
  (ex.: pergunta de RH → `out_of_scope`; VPN 809 no Windows 11 → abrir chamado; "meu chamado do
  notebook" → `list_my_tickets`).

## README

Deve conter: como rodar; visão geral da arquitetura; como o agent decide o que fazer; como a qualidade
das decisões foi garantida (testes + eval); principais trade-offs; o que faria com mais tempo; escolha do
modelo; deploy (se houver: chaves protegidas e limite de uso).

## Prioridade de implementação

1. tickets-api + seed
2. packages/agent com tools, testado por script
3. Login + chat com streaming, cards e traces
4. Transferência + console do analista
5. README, `.env.example`, deploy (diferencial)
