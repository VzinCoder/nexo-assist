import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { createDb, type Db } from "./client";
import { conversations, drafts, messages } from "./schema";

describe("createDb (web)", () => {
  let db: Db | undefined;
  afterEach(() => {
    db?.$client.close();
    db = undefined;
  });

  it("aplica as migrações e persiste conversa, mensagem com trace/decisão e rascunho", () => {
    const local = createDb(":memory:");
    db = local;
    const now = new Date("2026-11-11T13:00:00.000Z");
    local
      .insert(conversations)
      .values({ id: "c1", employeeId: "emp-001", status: "agent", createdAt: now, updatedAt: now })
      .run();
    local
      .insert(messages)
      .values({
        id: "m1",
        conversationId: "c1",
        role: "assistant",
        content: "Encontrei 2 chamados.",
        parts: [{ type: "handoff", reason: "pedido" }],
        trace: [
          { tool: "list_my_tickets", label: "Consultou seus chamados", input: {}, output: [], durationMs: 5 },
        ],
        decision: { intent: "ticket_status", action: "Listou", confidence: "high", reason: "Pediu status." },
        createdAt: now,
      })
      .run();
    local
      .insert(drafts)
      .values({
        id: "d1",
        conversationId: "c1",
        kind: "comment",
        payload: { ticketId: "INC-20311", ticketTitle: "x", text: "y" },
        status: "pending",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    const conversation = local.select().from(conversations).where(eq(conversations.id, "c1")).get();
    expect(conversation?.userMessageCount).toBe(0);
    const message = local.select().from(messages).get();
    expect(message?.trace[0]?.label).toBe("Consultou seus chamados");
    expect(message?.decision?.confidence).toBe("high");
    expect(message?.createdAt.toISOString()).toBe(now.toISOString());
    expect(local.select().from(drafts).get()?.payload).toEqual({
      ticketId: "INC-20311",
      ticketTitle: "x",
      text: "y",
    });
  });

  it("aplica chaves estrangeiras", () => {
    const local = createDb(":memory:");
    db = local;
    const now = new Date();
    expect(() =>
      local
        .insert(messages)
        .values({
          id: "m",
          conversationId: "nao-existe",
          role: "user",
          content: "x",
          parts: [],
          trace: [],
          createdAt: now,
        })
        .run(),
    ).toThrow();
  });
});
