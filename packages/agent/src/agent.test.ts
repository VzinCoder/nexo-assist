import { describe, expect, it } from "vitest";
import { MAX_STEPS, createNexoAgent, streamNexoReply, toModelMessages } from "./agent";
import { createMemoryPorts } from "./memory-ports";
import { fakeTicketsClient } from "./test-helpers";
import { createScriptedModel } from "./testing";
import { collectTurn, type RawToolResult } from "./turn";

const now = new Date("2026-11-11T13:00:00.000Z");
const session = { employeeId: "emp-001", conversationId: "conv-1" };

function build(script: Parameters<typeof createScriptedModel>[0]) {
  const scripted = createScriptedModel(script);
  const tickets = fakeTicketsClient();
  const ports = createMemoryPorts();
  const agent = createNexoAgent({
    model: scripted.model,
    tickets,
    drafts: ports.draftStore,
    conversations: ports.conversationStore,
    now: () => now,
  });
  return { scripted, tickets, ports, agent };
}

async function finish(stream: Awaited<ReturnType<typeof streamNexoReply>>) {
  const output = await stream.getFullOutput();
  const toolResults: RawToolResult[] = output.toolResults.map((chunk) => ({
    toolName: chunk.payload.toolName,
    args: chunk.payload.args,
    result: chunk.payload.result,
  }));
  return { output, turn: collectTurn({ text: output.text, toolResults }) };
}

describe("createNexoAgent + streamNexoReply (modelo falso)", () => {
  it("list_my_tickets → report_decision: tools recebem o contexto, trace e decisão são coletados", async () => {
    const { agent, tickets, scripted } = build([
      { toolCalls: [{ name: "list_my_tickets", args: {} }] },
      {
        toolCalls: [
          {
            name: "report_decision",
            args: {
              intent: "ticket_status",
              action: "Listou os chamados",
              confidence: "high",
              reason: "Pediu o status; INC-20311 está vencido.",
            },
          },
        ],
      },
      { text: "Seu INC-20311 está vencido. Quer falar com um analista?" },
    ]);
    const stream = await streamNexoReply(agent, {
      history: [{ role: "user", content: "qual o status do meu chamado?" }],
      session,
    });
    const { turn } = await finish(stream);

    expect(tickets.listTickets).toHaveBeenCalledWith("emp-001", {});
    expect(scripted.calls).toBe(3);
    expect(turn.trace.map((step) => step.label)).toEqual(["Consultou seus chamados", "Registrou a decisão"]);
    expect(turn.decision).toMatchObject({ intent: "ticket_status", confidence: "high" });
    expect(turn.decisionMissing).toBe(false);
    expect(turn.parts).toEqual([{ type: "ticket", ticket: expect.objectContaining({ id: "INC-20311", isOverdue: true }) }]);
    expect(turn.text).toMatch(/vencido/);
  });

  it(`modelo em laço é encerrado em ${MAX_STEPS} passos e o trace dos passos executados é mantido`, async () => {
    const { agent, scripted, tickets } = build([{ toolCalls: [{ name: "list_my_tickets", args: {} }] }]);
    const stream = await streamNexoReply(agent, { history: [{ role: "user", content: "oi" }], session });
    const { turn } = await finish(stream);
    expect(scripted.calls).toBe(MAX_STEPS);
    expect(tickets.listTickets).toHaveBeenCalledTimes(MAX_STEPS);
    expect(turn.trace).toHaveLength(MAX_STEPS);
    expect(turn.decisionMissing).toBe(true);
    expect(turn.decision).toMatchObject({ intent: "other", confidence: "low" });
  });

  it("o modelo recebe só as últimas 12 mensagens, com data/hora nas instruções", async () => {
    const { agent, scripted } = build([{ text: "ok" }]);
    const history = Array.from({ length: 25 }, (_, i) => ({
      role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: `mensagem ${i + 1}`,
    }));
    await finish(await streamNexoReply(agent, { history, session }));
    const prompt = JSON.stringify(scripted.prompts[0]);
    expect(prompt).toContain("mensagem 25");
    expect(prompt).toContain("mensagem 14");
    expect(prompt).not.toContain("mensagem 13\"");
    expect(prompt).toContain("Nexo Assist");
  });
});

describe("toModelMessages", () => {
  it("mapeia analista e sistema para o lado do assistente e corta em 12", () => {
    const messages = toModelMessages([
      { role: "system", content: "Chamado INC-20518 criado." },
      { role: "analyst", content: "Olá, sou a Juliana." },
      { role: "user", content: "oi" },
    ]);
    expect(messages).toEqual([
      { role: "assistant", content: "[Sistema] Chamado INC-20518 criado." },
      { role: "assistant", content: "[Analista] Olá, sou a Juliana." },
      { role: "user", content: "oi" },
    ]);
  });
});
