import {
  TicketConflictError,
  TicketNotFoundError,
  TicketsUnavailableError,
  createTicketsClient,
  type FetchLike,
  type TicketsClient,
} from "@nexo/shared";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { MAIN_EMPLOYEE_ID, SEED_TICKETS } from "./seed/data";
import { TEST_TOKEN, createTestApp, type TestApp } from "./testing";

/** `fetch` que encaminha para `app.inject`: contrato ponta a ponta sem abrir porta. */
function injectFetch(app: FastifyInstance, calls: { count: number }): FetchLike {
  return async (input, init) => {
    calls.count++;
    const url = new URL(input);
    const response = await app.inject({
      method: (init.method ?? "GET") as "GET" | "POST",
      url: `${url.pathname}${url.search}`,
      headers: init.headers as Record<string, string>,
      payload: typeof init.body === "string" ? init.body : undefined,
    });
    return new Response(response.body, {
      status: response.statusCode,
      headers: { "content-type": String(response.headers["content-type"] ?? "application/json") },
    });
  };
}

describe("cliente @nexo/shared × tickets-api", () => {
  let t: TestApp;
  let client: TicketsClient;
  const calls = { count: 0 };

  function setup(overrides: Parameters<typeof createTestApp>[0] = {}) {
    t = createTestApp(overrides);
    calls.count = 0;
    client = createTicketsClient({
      baseUrl: "http://tickets-api.test",
      serviceToken: TEST_TOKEN,
      fetch: injectFetch(t.app, calls),
      sleep: async () => {},
    });
  }

  afterEach(async () => {
    await t.close();
  });

  it("lista os chamados do funcionário com isOverdue", async () => {
    setup();
    const tickets = await client.listTickets(MAIN_EMPLOYEE_ID);
    const overdue = tickets.find((ticket) => ticket.id === SEED_TICKETS.overdue);
    expect(overdue?.isOverdue).toBe(true);
    expect(tickets.every((ticket) => ticket.employeeId === MAIN_EMPLOYEE_ID)).toBe(true);
  });

  it("cria um chamado", async () => {
    setup();
    const ticket = await client.createTicket(MAIN_EMPLOYEE_ID, {
      title: "VPN não conecta",
      description: "Erro 809 no Windows 11.",
      type: "INC",
      category: "network_vpn",
      priority: "high",
      affected: "me",
    });
    expect(ticket.id).toBe("INC-20312");
    expect(ticket.status).toBe("open");
  });

  it("consulta funcionário e artigos", async () => {
    setup();
    expect((await client.getEmployeeByEmail("ANA.SOUZA@nexo.com.br")).id).toBe(MAIN_EMPLOYEE_ID);
    expect((await client.searchArticles("vpn erro 809"))[0]?.title).toBe("VPN com erro 809");
  });

  it("chamado de outro funcionário vira TicketNotFoundError", async () => {
    setup();
    await expect(client.getTicket(MAIN_EMPLOYEE_ID, SEED_TICKETS.otherSimilar)).rejects.toBeInstanceOf(
      TicketNotFoundError,
    );
  });

  it("reabertura fora da janela vira TicketConflictError com a mensagem do serviço", async () => {
    setup();
    const error = await client
      .reopenTicket(MAIN_EMPLOYEE_ID, SEED_TICKETS.resolvedLongAgo)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TicketConflictError);
    expect((error as TicketConflictError).message).toMatch(/mais de 7 dias/);
  });

  it("reabre, comenta e transfere pelo cliente", async () => {
    setup();
    const reopened = await client.reopenTicket(MAIN_EMPLOYEE_ID, SEED_TICKETS.reopenable, "De novo.");
    expect(reopened.status).toBe("open");
    const commented = await client.addComment(MAIN_EMPLOYEE_ID, SEED_TICKETS.reopenable, "Mais info.");
    expect(commented.comments.at(-1)?.kind).toBe("comment");
    const escalated = await client.escalateTicket(MAIN_EMPLOYEE_ID, SEED_TICKETS.reopenable, {
      reason: "Pedido do funcionário",
      summary: "SAP bloqueou de novo após reabertura.",
    });
    expect(escalated.status).toBe("waiting_analyst");
    const similar = await client.findSimilarTickets(MAIN_EMPLOYEE_ID, "notebook lento");
    expect(similar.map((ticket) => ticket.id)).toContain(SEED_TICKETS.overdue);
  });

  it("failureRate 1 esgota as 3 tentativas e lança TicketsUnavailableError", async () => {
    setup({ failureRate: 1, random: () => 0 });
    await expect(client.listTickets(MAIN_EMPLOYEE_ID)).rejects.toBeInstanceOf(
      TicketsUnavailableError,
    );
    expect(calls.count).toBe(3);
  });
});
