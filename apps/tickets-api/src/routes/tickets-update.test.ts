import { computeDueAt, ticketSchema } from "@nexo/shared";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ticketComments, tickets } from "../db/schema";
import { MAIN_EMPLOYEE_ID, OTHER_EMPLOYEE_ID, SEED_TICKETS } from "../seed/data";
import { TEST_NOW, authHeaders, createTestApp, type TestApp } from "../testing";

describe("atualização de chamados", () => {
  let t: TestApp;
  beforeEach(() => {
    t = createTestApp();
  });
  afterEach(async () => {
    await t.close();
  });

  const post = (url: string, payload: object, employeeId = MAIN_EMPLOYEE_ID) =>
    t.app.inject({ method: "POST", url, headers: authHeaders(employeeId), payload });
  const row = (id: string) => t.db.select().from(tickets).where(eq(tickets.id, id)).get();
  const commentCount = (id: string) =>
    t.db.select().from(ticketComments).where(eq(ticketComments.ticketId, id)).all().length;

  describe("POST /tickets/:id/comments", () => {
    it("adiciona comentário, renova updatedAt/dueAt e tira INC-20311 do vencido", async () => {
      const response = await post(`/tickets/${SEED_TICKETS.overdue}/comments`, {
        text: "Continua lento hoje de manhã.",
      });

      expect(response.statusCode).toBe(201);
      const ticket = ticketSchema.parse(response.json());
      expect(ticket.isOverdue).toBe(false);
      expect(ticket.updatedAt).toBe(TEST_NOW.toISOString());
      expect(ticket.dueAt).toBe(computeDueAt("medium", TEST_NOW).toISOString());
      expect(ticket.comments.at(-1)).toMatchObject({
        kind: "comment",
        authorId: MAIN_EMPLOYEE_ID,
        authorName: "Ana Souza",
        text: "Continua lento hoje de manhã.",
      });
    });

    it("chamado resolvido responde 409 sugerindo reabrir", async () => {
      const before = commentCount(SEED_TICKETS.reopenable);
      const response = await post(`/tickets/${SEED_TICKETS.reopenable}/comments`, { text: "Oi" });
      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe("conflict");
      expect(response.json().error.message).toMatch(/[Rr]eabra/);
      expect(commentCount(SEED_TICKETS.reopenable)).toBe(before);
    });

    it("texto vazio responde 400", async () => {
      const response = await post(`/tickets/${SEED_TICKETS.overdue}/comments`, { text: "  " });
      expect(response.statusCode).toBe(400);
    });
  });

  describe("POST /tickets/:id/reopen", () => {
    it("reabre dentro da janela: 200, open, resolvedAt null e comentário reopen", async () => {
      const response = await post(`/tickets/${SEED_TICKETS.reopenable}/reopen`, {
        comment: "Bloqueou de novo.",
      });

      expect(response.statusCode).toBe(200);
      const ticket = ticketSchema.parse(response.json());
      expect(ticket.status).toBe("open");
      expect(ticket.resolvedAt).toBeNull();
      expect(ticket.updatedAt).toBe(TEST_NOW.toISOString());
      expect(ticket.dueAt).toBe(computeDueAt("medium", TEST_NOW).toISOString());
      expect(ticket.comments.at(-1)).toMatchObject({ kind: "reopen", text: "Bloqueou de novo." });
    });

    it("aceita reabertura sem comentário e sem body", async () => {
      const response = await t.app.inject({
        method: "POST",
        url: `/tickets/${SEED_TICKETS.reopenable}/reopen`,
        headers: authHeaders(),
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().comments.at(-1).kind).toBe("reopen");
    });

    it("fora da janela responde 409 e não altera o chamado", async () => {
      const before = row(SEED_TICKETS.resolvedLongAgo);
      const response = await post(`/tickets/${SEED_TICKETS.resolvedLongAgo}/reopen`, {});
      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe("conflict");
      expect(row(SEED_TICKETS.resolvedLongAgo)).toEqual(before);
      expect(row(SEED_TICKETS.resolvedLongAgo)?.status).toBe("resolved");
    });

    it("chamado que não está resolvido responde 409", async () => {
      const response = await post(`/tickets/${SEED_TICKETS.overdue}/reopen`, {});
      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe("conflict");
    });

    it("chamado fechado responde 409", async () => {
      const response = await post(`/tickets/${SEED_TICKETS.closed}/reopen`, {});
      expect(response.statusCode).toBe(409);
    });
  });

  describe("POST /tickets/:id/escalate", () => {
    const body = {
      reason: "Funcionário pediu um analista",
      summary: "Sem acesso à pasta Financeiro; relatório vence hoje.",
    };

    it("transfere: 200, waiting_analyst e comentário escalation com o resumo", async () => {
      const response = await post(`/tickets/${SEED_TICKETS.highOpen}/escalate`, body);

      expect(response.statusCode).toBe(200);
      const ticket = ticketSchema.parse(response.json());
      expect(ticket.status).toBe("waiting_analyst");
      expect(ticket.updatedAt).toBe(TEST_NOW.toISOString());
      expect(ticket.dueAt).toBe(computeDueAt("high", TEST_NOW).toISOString());
      const last = ticket.comments.at(-1);
      expect(last?.kind).toBe("escalation");
      expect(last?.text).toContain(body.summary);
      expect(last?.text).toContain(body.reason);
    });

    it("sem summary responde 400", async () => {
      const response = await post(`/tickets/${SEED_TICKETS.highOpen}/escalate`, {
        reason: body.reason,
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("invalid_request");
      expect(response.json().error.message).toMatch(/summary/);
    });

    it("chamado resolvido responde 409", async () => {
      const response = await post(`/tickets/${SEED_TICKETS.reopenable}/escalate`, body);
      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe("conflict");
    });
  });

  describe("privacidade: A agindo em chamado de B", () => {
    const foreign = SEED_TICKETS.otherSimilar;
    const cases: Array<[string, object]> = [
      ["comments", { text: "Intrusão" }],
      ["reopen", { comment: "Intrusão" }],
      ["escalate", { reason: "Intrusão", summary: "Intrusão" }],
    ];

    it.each(cases)("POST /:id/%s responde 404 igual ao inexistente e não altera", async (action, payload) => {
      const before = row(foreign);
      const commentsBefore = commentCount(foreign);

      const response = await post(`/tickets/${foreign}/${action}`, payload, MAIN_EMPLOYEE_ID);
      const missing = await post(`/tickets/INC-99999/${action}`, payload, MAIN_EMPLOYEE_ID);

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual(missing.json());
      expect(row(foreign)).toEqual(before);
      expect(commentCount(foreign)).toBe(commentsBefore);
      expect(before?.employeeId).toBe(OTHER_EMPLOYEE_ID);
    });
  });
});
