import { TicketsUnavailableError, traceStepSchema } from "@nexo/shared";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { MissingSessionContextError, createNexoRequestContext, getSessionIds } from "./context";
import { ToolRefusal, withTrace } from "./trace";

function fakeClock(...ticks: number[]) {
  let index = 0;
  return () => ticks[Math.min(index++, ticks.length - 1)] ?? 0;
}

describe("withTrace", () => {
  it("sucesso: dados, saída resumida e duração", async () => {
    const result = await withTrace({
      tool: "list_my_tickets",
      label: "Consultou seus chamados",
      input: { status: "open" },
      run: async () => [{ id: "INC-20311", title: "Notebook lento", description: "longa" }],
      summarize: (rows) => rows.map(({ id, title }) => ({ id, title })),
      clock: fakeClock(100, 142),
    });
    expect(result.ok).toBe(true);
    expect(result.trace).toEqual({
      tool: "list_my_tickets",
      label: "Consultou seus chamados",
      input: { status: "open" },
      output: [{ id: "INC-20311", title: "Notebook lento" }],
      durationMs: 42,
    });
    expect(traceStepSchema.safeParse(result.trace).success).toBe(true);
  });

  it("TicketsUnavailableError vira mensagem pt-BR no resultado e no trace", async () => {
    const result = await withTrace({
      tool: "list_my_tickets",
      label: "Consultou seus chamados",
      input: {},
      run: async () => {
        throw new TicketsUnavailableError(503, "unavailable", "detalhe interno");
      },
    });
    expect(result).toMatchObject({ ok: false, code: "tickets_unavailable" });
    expect(result.trace.error).toBe("Sistema de chamados indisponível no momento.");
    expect(result.trace.output).toBeNull();
  });

  it("erro de validação cita o campo", async () => {
    const result = await withTrace({
      tool: "draft_ticket",
      label: "Montou o rascunho",
      input: {},
      run: async () => z.object({ category: z.string() }).parse({}),
    });
    expect(result).toMatchObject({ ok: false, code: "invalid_input" });
    expect(result.trace.error).toMatch(/category/);
  });

  it("recusa de regra e rótulo dependente do resultado", async () => {
    const refused = await withTrace({
      tool: "draft_ticket_update",
      label: (data: string | undefined) => (data ? `Ok ${data}` : "Tentou preparar a reabertura"),
      input: {},
      run: async (): Promise<string> => {
        throw new ToolRefusal("Passou o prazo de reabertura.");
      },
    });
    expect(refused.trace).toMatchObject({ label: "Tentou preparar a reabertura", error: "Passou o prazo de reabertura." });
  });
});

describe("getSessionIds", () => {
  it("lê os ids do RequestContext", () => {
    const context = createNexoRequestContext({ employeeId: "emp-001", conversationId: "c1" });
    expect(getSessionIds(context)).toEqual({ employeeId: "emp-001", conversationId: "c1" });
  });

  it("lança sem contexto", () => {
    expect(() => getSessionIds(undefined)).toThrow(MissingSessionContextError);
    expect(() => getSessionIds({ get: () => undefined })).toThrow(MissingSessionContextError);
  });
});
