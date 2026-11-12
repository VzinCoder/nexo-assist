import { createMemoryPorts, createNexoRequestContext, createNexoTools } from "@nexo/agent";
import { TEST_NOW, createInMemoryTicketsClient, createTestApp, type TestApp } from "@nexo/tickets-api/testing";
import { MAIN_EMPLOYEE_ID, OTHER_EMPLOYEE_ID, SEED_TICKETS } from "@nexo/tickets-api/seed";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/** Privacidade ponta a ponta: tools do agent × tickets-api em memória, via cliente HTTP real. */
describe("privacidade das tools contra o tickets-api", () => {
  let t: TestApp;
  let tools: ReturnType<typeof createNexoTools>;
  const ports = createMemoryPorts();
  const context = { requestContext: createNexoRequestContext({ employeeId: MAIN_EMPLOYEE_ID, conversationId: "c1" }) };

  beforeEach(() => {
    t = createTestApp();
    tools = createNexoTools({
      tickets: createInMemoryTicketsClient(t.app),
      drafts: ports.draftStore,
      conversations: ports.conversationStore,
      now: () => TEST_NOW,
    });
  });
  afterEach(async () => t.close());

  const run = (tool: { execute?: unknown }, input: unknown) =>
    (tool.execute as (input: unknown, context: unknown) => Promise<unknown>)(input, context);

  it("pedir o chamado de outro funcionário dá não encontrado, sem dados dele no resultado nem no trace", async () => {
    const result = (await run(tools.get_ticket, { ticketId: SEED_TICKETS.otherSimilar })) as {
      ok: boolean;
      trace: { error?: string; output: unknown };
    };
    expect(result.ok).toBe(false);
    expect(result.trace.error).toMatch(/não encontrado/);
    expect(result.trace.output).toBeNull();
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("planilhas");
    expect(serialized).not.toContain(OTHER_EMPLOYEE_ID);
  });

  it("listar e buscar parecidos só trazem chamados do funcionário da sessão", async () => {
    const list = (await run(tools.list_my_tickets, {})) as { ok: boolean; data: { id: string }[] };
    expect(list.ok).toBe(true);
    const ids = list.data.map((ticket) => ticket.id);
    expect(ids).toContain(SEED_TICKETS.overdue);
    expect(ids).not.toContain(SEED_TICKETS.otherSimilar);
    expect(ids).not.toContain(SEED_TICKETS.otherRequest);

    const similar = (await run(tools.find_similar_tickets, { text: "notebook lento planilhas" })) as {
      data: { id: string }[];
    };
    expect(similar.data.map((ticket) => ticket.id)).not.toContain(SEED_TICKETS.otherSimilar);
  });

  it("não prepara complemento em chamado de outro funcionário", async () => {
    const result = (await run(tools.draft_ticket_update, {
      ticketId: SEED_TICKETS.otherRequest,
      kind: "comment",
      text: "oi",
    })) as { ok: boolean };
    expect(result.ok).toBe(false);
    expect(ports.drafts).toHaveLength(0);
  });
});
