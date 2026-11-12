import { describe, expect, it } from "vitest";
import { MISSING_DECISION, classifyProviderError, collectTurn } from "./turn";

const card = {
  id: "INC-20311",
  type: "INC",
  title: "Notebook lento",
  category: "hardware",
  priority: "medium",
  status: "open",
  createdAt: "2026-10-16T17:20:00.000Z",
  updatedAt: "2026-10-16T17:20:00.000Z",
  dueAt: "2026-10-21T17:20:00.000Z",
  isOverdue: true,
};
const step = (tool: string, label: string, extra: Record<string, unknown> = {}) => ({
  tool,
  label,
  input: {},
  output: null,
  durationMs: 3,
  ...extra,
});
const ok = (tool: string, label: string, data: unknown) => ({ ok: true, data, trace: step(tool, label) });

describe("collectTurn", () => {
  it("sem report_decision: decisão sintética other/low", () => {
    const turn = collectTurn({ text: "Olá!", toolResults: [] });
    expect(turn.decision).toEqual(MISSING_DECISION);
    expect(turn.decision).toMatchObject({ intent: "other", confidence: "low" });
    expect(turn.decisionMissing).toBe(true);
  });

  it("monta lista, card, rascunho, opções e transferência a partir das tools", () => {
    const turn = collectTurn({
      text: "",
      toolResults: [
        { toolName: "list_my_tickets", args: {}, result: ok("list_my_tickets", "Consultou seus chamados", [card, { ...card, id: "REQ-10442", type: "REQ" }]) },
        { toolName: "get_ticket", args: {}, result: ok("get_ticket", "Abriu o chamado INC-20311", { ...card, description: "x", comments: [] }) },
        { toolName: "draft_ticket", args: {}, result: ok("draft_ticket", "Montou o rascunho do chamado", { draftId: "d1" }) },
        { toolName: "offer_options", args: {}, result: ok("offer_options", "Ofereceu opções", { question: "Quem?", options: ["Só eu", "Minha equipe"] }) },
        { toolName: "handoff_to_human", args: {}, result: ok("handoff_to_human", "Transferiu para um analista", { reason: "Pedido" }) },
        {
          toolName: "report_decision",
          args: {},
          result: ok("report_decision", "Registrou a decisão", { intent: "handoff", action: "Transferiu", confidence: "high", reason: "Pedido explícito." }),
        },
      ],
    });
    expect(turn.parts.map((part) => part.type)).toEqual(["ticket", "draft", "options", "handoff"]);
    expect(turn.handedOff).toBe(true);
    expect(turn.decision.intent).toBe("handoff");
    expect(turn.trace).toHaveLength(6);
    expect(turn.text).toMatch(/analista/);
  });

  it("lista sem filtro mostra só chamados em andamento; com filtro, todos os devolvidos", () => {
    const resolved = { ...card, id: "INC-20150", status: "resolved", isOverdue: false };
    const result = ok("list_my_tickets", "Consultou seus chamados", [card, { ...card, id: "REQ-10442", type: "REQ" }, resolved]);
    const all = collectTurn({ text: "x", toolResults: [{ toolName: "list_my_tickets", args: {}, result }] });
    expect(all.parts[0]).toMatchObject({ type: "tickets", tickets: [{ id: "INC-20311" }, { id: "REQ-10442" }] });
    const filtered = collectTurn({
      text: "x",
      toolResults: [{ toolName: "list_my_tickets", args: { status: "resolved" }, result: ok("list_my_tickets", "Consultou seus chamados", [resolved]) }],
    });
    expect(filtered.parts[0]).toMatchObject({ type: "ticket", ticket: { id: "INC-20150" } });
  });

  it("parecidos somem quando o agent prepara um chamado novo; ficam se não houver rascunho novo", () => {
    const similar = { toolName: "find_similar_tickets", args: {}, result: ok("find_similar_tickets", "Verificou chamados parecidos", [{ ...card, reopenable: false }]) };
    const draft = { toolName: "draft_ticket", args: {}, result: ok("draft_ticket", "Montou o rascunho do chamado", { draftId: "d1" }) };
    expect(collectTurn({ text: "x", toolResults: [similar, draft] }).parts).toEqual([{ type: "draft", draftId: "d1" }]);
    expect(collectTurn({ text: "Achei o INC-20311 aberto.", toolResults: [similar] }).parts.map((part) => part.type)).toEqual(["ticket"]);
    // Resposta que não cita o chamado (ex.: resolveu pela central): o card some.
    expect(collectTurn({ text: "Reinstale o cliente de VPN.", toolResults: [similar] }).parts).toEqual([]);
  });

  it("erro de validação do Mastra vira passo de trace com erro", () => {
    const turn = collectTurn({
      text: "x",
      toolResults: [
        {
          toolName: "list_my_tickets",
          args: { employeeId: "emp-002" },
          result: {
            error: true,
            message: 'Tool input validation failed for list_my_tickets.\n- root: Unrecognized key: "employeeId"\n\nProvided arguments: {}',
          },
        },
      ],
    });
    expect(turn.trace[0]).toMatchObject({
      tool: "list_my_tickets",
      label: "Consultou seus chamados",
      error: 'Argumentos recusados pela validação: root: Unrecognized key: "employeeId".',
    });
  });

  it("sistema de chamados indisponível gera aviso", () => {
    const turn = collectTurn({
      text: "",
      toolResults: [
        {
          toolName: "list_my_tickets",
          args: {},
          result: {
            ok: false,
            error: "Sistema de chamados indisponível no momento.",
            code: "tickets_unavailable",
            trace: step("list_my_tickets", "Consultou seus chamados", { error: "Sistema de chamados indisponível no momento." }),
          },
        },
      ],
    });
    expect(turn.parts).toEqual([{ type: "notice", code: "tickets_unavailable" }]);
    expect(turn.trace[0]?.error).toMatch(/indisponível/);
    expect(turn.text).toMatch(/indisponível/);
  });
});

describe("classifyProviderError", () => {
  it("429 → provider_rate_limited", () => {
    expect(classifyProviderError(Object.assign(new Error("Too Many Requests"), { statusCode: 429 }))).toBe("provider_rate_limited");
    expect(classifyProviderError(new Error("wrapped", { cause: { statusCode: 429 } }))).toBe("provider_rate_limited");
    expect(classifyProviderError({ lastError: { statusCode: 429 } })).toBe("provider_rate_limited");
    expect(classifyProviderError(new Error("RESOURCE_EXHAUSTED: quota"))).toBe("provider_rate_limited");
  });

  it("5xx e rede → provider_unavailable", () => {
    expect(classifyProviderError(Object.assign(new Error("Service Unavailable"), { statusCode: 503 }))).toBe("provider_unavailable");
    expect(classifyProviderError(new TypeError("fetch failed"))).toBe("provider_unavailable");
    expect(classifyProviderError("qualquer coisa")).toBe("provider_unavailable");
  });
});
