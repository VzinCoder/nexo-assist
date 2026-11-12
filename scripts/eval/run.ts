/**
 * Eval do agent com o modelo REAL (fora do `pnpm test`): cenários típicos do service desk,
 * verificando as ações chamadas e o intent da decisão. Usa um tickets-api em memória semeado e
 * portas em memória: não cria chamados reais nem toca o banco do web.
 *
 *   pnpm eval            # lê GOOGLE_GENERATIVE_AI_API_KEY e LLM_MODEL de apps/web/.env
 *   EVAL_ONLY=sap pnpm eval
 */
import {
  collectTurn,
  createMemoryPorts,
  createNexoAgent,
  streamNexoReply,
  type CollectedTurn,
  type MemoryDraft,
} from "@nexo/agent";
import { TEST_NOW, createInMemoryTicketsClient, createTestApp } from "@nexo/tickets-api/testing";
import { MAIN_EMPLOYEE_ID, SEED_TICKETS } from "@nexo/tickets-api/seed";

const DEFAULT_MODEL = "google/gemini-3.5-flash-lite";
/** Pausa entre cenários: cada cenário faz no máximo 6 chamadas, então fica abaixo de 15/min. */
const PAUSE_MS = Number(process.env.EVAL_PAUSE_MS ?? 30_000);

type Observed = {
  tools: string[];
  turn: CollectedTurn;
  drafts: MemoryDraft[];
  handoffs: number;
};

type Scenario = {
  id: string;
  title: string;
  message: string;
  /** Devolve a lista de falhas (vazia = passou). */
  check: (observed: Observed) => string[];
};

const has = (observed: Observed, tool: string) => observed.tools.includes(tool);
const expectTool = (observed: Observed, tool: string) => (has(observed, tool) ? [] : [`esperava a ação ${tool}`]);
const forbidTool = (observed: Observed, tool: string) => (has(observed, tool) ? [`não deveria chamar ${tool}`] : []);
const expectIntent = (observed: Observed, ...intents: string[]) =>
  intents.includes(observed.turn.decision.intent) && !observed.turn.decisionMissing
    ? []
    : [`intent esperado ${intents.join(" ou ")}, obtido ${observed.turn.decisionMissing ? "(sem decisão)" : observed.turn.decision.intent}`];

const SCENARIOS: Scenario[] = [
  {
    id: "rh",
    title: "Pergunta de RH → fora do escopo",
    message: "Quantos dias de férias eu ainda tenho para tirar este ano?",
    check: (o) => [...expectIntent(o, "out_of_scope"), ...forbidTool(o, "draft_ticket")],
  },
  {
    id: "vpn-win10",
    title: "VPN erro 809 no Windows 10 → central de ajuda",
    message: "Minha VPN não conecta e aparece o erro 809. Meu notebook é Windows 10.",
    check: (o) => [...expectTool(o, "search_help_center"), ...forbidTool(o, "draft_ticket"), ...expectIntent(o, "question")],
  },
  {
    id: "vpn-win11",
    title: "VPN erro 809 no Windows 11 → rascunho de chamado",
    message:
      "Minha VPN não conecta desde ontem, aparece o erro 809. Meu notebook é Windows 11 e o artigo da central não serve. Só eu sou afetada e tenho reunião com cliente hoje às 16h.",
    check: (o) => [
      ...expectTool(o, "find_similar_tickets"),
      ...expectTool(o, "draft_ticket"),
      ...(o.drafts.some((draft) => draft.kind === "create") ? [] : ["nenhum rascunho de chamado novo gravado"]),
      ...expectIntent(o, "ticket_create"),
    ],
  },
  {
    id: "notebook",
    title: "Status do chamado do notebook → lista e vencimento",
    message: "Qual o status do meu chamado do notebook?",
    check: (o) => [
      ...(has(o, "list_my_tickets") || has(o, "get_ticket") ? [] : ["esperava consultar os chamados"]),
      ...(/venc|prazo/i.test(o.turn.text) ? [] : ["a resposta não menciona o vencimento"]),
      ...expectIntent(o, "ticket_status"),
    ],
  },
  {
    id: "atendente",
    title: "Pedido de atendente → transferência",
    message: "Quero falar com um atendente humano, por favor.",
    check: (o) => [
      ...expectTool(o, "handoff_to_human"),
      ...(o.handoffs === 1 ? [] : ["a conversa não foi transferida"]),
      ...expectIntent(o, "handoff"),
    ],
  },
  {
    id: "existente",
    title: "Problema já aberto → checa parecidos sem novo rascunho",
    message: "O meu acesso à pasta Financeiro no SharePoint ainda não foi liberado, preciso dele.",
    check: (o) => [
      ...(has(o, "find_similar_tickets") || has(o, "list_my_tickets") ? [] : ["esperava checar chamados existentes"]),
      ...forbidTool(o, "draft_ticket"),
      ...expectIntent(o, "ticket_status", "ticket_update"),
    ],
  },
  {
    id: "sap",
    title: "Senha do SAP bloqueou de novo → reabertura do INC-20150",
    message: "A senha do SAP bloqueou de novo.",
    check: (o) => [
      ...expectTool(o, "find_similar_tickets"),
      ...forbidTool(o, "draft_ticket"),
      ...(o.drafts.some(
        (draft) =>
          draft.kind === "reopen" &&
          typeof draft.payload === "object" &&
          draft.payload !== null &&
          "ticketId" in draft.payload &&
          draft.payload.ticketId === SEED_TICKETS.reopenable,
      )
        ? []
        : [`esperava rascunho de reabertura do ${SEED_TICKETS.reopenable}`]),
      ...expectIntent(o, "ticket_update"),
    ],
  },
  {
    id: "sem-dados",
    title: "Pedido sem dados → pergunta antes de rascunhar",
    message: "Preciso de um software.",
    check: (o) => [
      ...forbidTool(o, "draft_ticket"),
      ...(o.turn.text.includes("?") || has(o, "offer_options") ? [] : ["esperava uma pergunta ao funcionário"]),
      ...expectIntent(o, "ticket_create", "question", "other"),
    ],
  },
];

async function runScenario(scenario: Scenario, model: string, index: number): Promise<Observed> {
  const t = createTestApp();
  const ports = createMemoryPorts();
  try {
    const agent = createNexoAgent({
      model,
      tickets: createInMemoryTicketsClient(t.app),
      drafts: ports.draftStore,
      conversations: ports.conversationStore,
      now: () => TEST_NOW,
    });
    const stream = await streamNexoReply(agent, {
      history: [{ role: "user", content: scenario.message }],
      session: { employeeId: MAIN_EMPLOYEE_ID, conversationId: `eval-${index}` },
    });
    const output = await stream.getFullOutput();
    const toolResults = output.toolResults.map((chunk) => ({
      toolName: chunk.payload.toolName,
      args: chunk.payload.args,
      result: chunk.payload.result,
    }));
    return {
      tools: output.toolCalls.map((chunk) => chunk.payload.toolName),
      turn: collectTurn({ text: output.text, toolResults }),
      drafts: [...ports.drafts],
      handoffs: ports.handoffs.length,
    };
  } finally {
    await t.close();
  }
}

async function main(): Promise<void> {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim()) {
    console.error(
      "GOOGLE_GENERATIVE_AI_API_KEY não definida. O eval usa o modelo real: configure a chave em apps/web/.env (veja apps/web/.env.example).",
    );
    process.exit(1);
  }
  const model = process.env.LLM_MODEL?.trim() || DEFAULT_MODEL;
  const only = process.env.EVAL_ONLY?.split(",").map((id) => id.trim());
  const scenarios = only ? SCENARIOS.filter((scenario) => only.includes(scenario.id)) : SCENARIOS;

  console.log(`Eval do Nexo Assist · modelo ${model} · ${scenarios.length} cenários · pausa de ${PAUSE_MS / 1000}s\n`);
  let passed = 0;
  for (const [index, scenario] of scenarios.entries()) {
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
    let failures: string[];
    let summary: string;
    try {
      const observed = await runScenario(scenario, model, index);
      failures = scenario.check(observed);
      const decision = observed.turn.decisionMissing ? "(sem decisão)" : `${observed.turn.decision.intent}/${observed.turn.decision.confidence}`;
      summary = `ações: ${observed.tools.join(" → ") || "(nenhuma)"} | decisão: ${decision}\n      resposta: ${observed.turn.text.replace(/\s+/g, " ").slice(0, 160)}`;
    } catch (error) {
      failures = [`erro ao rodar: ${error instanceof Error ? error.message : String(error)}`];
      summary = "";
    }
    const ok = failures.length === 0;
    if (ok) passed++;
    console.log(`${ok ? "PASSOU" : "FALHOU"}  ${scenario.id} — ${scenario.title}`);
    if (summary) console.log(`      ${summary}`);
    for (const failure of failures) console.log(`      ✗ ${failure}`);
  }
  console.log(`\nTotal: ${passed}/${scenarios.length} cenários passaram.`);
  process.exit(passed === scenarios.length ? 0 : 1);
}

void main();
