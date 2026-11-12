import { describe, expect, it } from "vitest";
import { decisionSchema, traceStepSchema } from "./agent";

describe("traceStepSchema", () => {
  const step = { tool: "list_my_tickets", label: "Consultou seus chamados", input: {}, output: [], durationMs: 12 };

  it("aceita passo sem erro", () => {
    expect(traceStepSchema.parse(step)).toEqual(step);
  });

  it("aceita passo com erro", () => {
    expect(traceStepSchema.parse({ ...step, error: "Indisponível" }).error).toBe("Indisponível");
  });

  it("rejeita duração negativa e label vazio", () => {
    expect(traceStepSchema.safeParse({ ...step, durationMs: -1 }).success).toBe(false);
    expect(traceStepSchema.safeParse({ ...step, label: "" }).success).toBe(false);
  });
});

describe("decisionSchema", () => {
  const decision = {
    intent: "ticket_status",
    action: "Listou os chamados",
    confidence: "high",
    reason: "O funcionário perguntou pelo status.",
  };

  it("aceita decisão válida", () => {
    expect(decisionSchema.parse(decision)).toEqual(decision);
  });

  it("rejeita intent inválido", () => {
    expect(decisionSchema.safeParse({ ...decision, intent: "smalltalk" }).success).toBe(false);
  });

  it("rejeita confiança inválida", () => {
    expect(decisionSchema.safeParse({ ...decision, confidence: "very_high" }).success).toBe(false);
  });

  it("rejeita motivo vazio", () => {
    expect(decisionSchema.safeParse({ ...decision, reason: "  " }).success).toBe(false);
  });
});
