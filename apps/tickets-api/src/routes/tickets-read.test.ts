import { ticketSchema, ticketSummaryListSchema } from "@nexo/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  EMPLOYEE_WITHOUT_TICKETS_ID,
  MAIN_EMPLOYEE_ID,
  OTHER_EMPLOYEE_ID,
  SEED_TICKETS,
} from "../seed/data";
import { authHeaders, createTestApp, type TestApp } from "../testing";

describe("GET /tickets", () => {
  let t: TestApp;
  beforeEach(() => {
    t = createTestApp();
  });
  afterEach(async () => {
    await t.close();
  });

  const list = (url = "/tickets", employeeId = MAIN_EMPLOYEE_ID) =>
    t.app.inject({ method: "GET", url, headers: authHeaders(employeeId) });

  it("lista só os chamados do funcionário, do mais recente para o mais antigo", async () => {
    const response = await list();
    expect(response.statusCode).toBe(200);
    const tickets = ticketSummaryListSchema.parse(response.json());

    const ids = tickets.map((ticket) => ticket.id);
    expect(ids).toEqual(
      expect.arrayContaining([SEED_TICKETS.overdue, SEED_TICKETS.onTime, SEED_TICKETS.reopenable]),
    );
    expect(ids).not.toContain(SEED_TICKETS.otherSimilar);
    expect(tickets.every((ticket) => ticket.employeeId === MAIN_EMPLOYEE_ID)).toBe(true);

    const updatedAts = tickets.map((ticket) => ticket.updatedAt);
    expect(updatedAts).toEqual([...updatedAts].sort().reverse());
    expect(response.json()[0]).not.toHaveProperty("comments");
  });

  it("calcula isOverdue na resposta", async () => {
    const tickets = ticketSummaryListSchema.parse((await list()).json());
    const byId = new Map(tickets.map((ticket) => [ticket.id, ticket]));
    expect(byId.get(SEED_TICKETS.overdue)?.isOverdue).toBe(true);
    expect(byId.get(SEED_TICKETS.onTime)?.isOverdue).toBe(false);
    expect(byId.get(SEED_TICKETS.reopenable)?.isOverdue).toBe(false);
  });

  it("filtra por status", async () => {
    const tickets = ticketSummaryListSchema.parse(
      (await list("/tickets?status=waiting_analyst")).json(),
    );
    expect(tickets.map((ticket) => ticket.id)).toContain(SEED_TICKETS.overdue);
    expect(tickets.every((ticket) => ticket.status === "waiting_analyst")).toBe(true);
  });

  it("status desconhecido responde 400", async () => {
    const response = await list("/tickets?status=pending");
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("invalid_request");
  });

  it("funcionário sem chamados recebe lista vazia", async () => {
    const response = await list("/tickets", EMPLOYEE_WITHOUT_TICKETS_ID);
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });

  it("sem token responde 401 mesmo com X-Employee-Id válido", async () => {
    const response = await t.app.inject({
      method: "GET",
      url: "/tickets",
      headers: { "x-employee-id": MAIN_EMPLOYEE_ID },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("unauthorized");
  });
});

describe("GET /tickets/:id", () => {
  let t: TestApp;
  beforeEach(() => {
    t = createTestApp();
  });
  afterEach(async () => {
    await t.close();
  });

  const get = (id: string, employeeId = MAIN_EMPLOYEE_ID) =>
    t.app.inject({ method: "GET", url: `/tickets/${id}`, headers: authHeaders(employeeId) });

  it("devolve INC-20311 vencido, com comentários em ordem cronológica", async () => {
    const response = await get(SEED_TICKETS.overdue);
    expect(response.statusCode).toBe(200);
    const ticket = ticketSchema.parse(response.json());
    expect(ticket.isOverdue).toBe(true);
    expect(ticket.comments.length).toBeGreaterThanOrEqual(2);
    const times = ticket.comments.map((comment) => comment.createdAt);
    expect(times).toEqual([...times].sort());
    expect(ticket.comments[0]?.authorName).toBe("Ana Souza");
  });

  it("id malformado responde 400", async () => {
    const response = await get("abc");
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("invalid_request");
  });

  it("chamado de outro funcionário responde 404 igual ao inexistente", async () => {
    const foreign = await get(SEED_TICKETS.otherSimilar, MAIN_EMPLOYEE_ID);
    const missing = await get("INC-99999", MAIN_EMPLOYEE_ID);
    expect(foreign.statusCode).toBe(404);
    expect(missing.statusCode).toBe(404);
    expect(foreign.json()).toEqual(missing.json());
    expect(foreign.json().error.code).toBe("not_found");
  });

  it("o dono enxerga o próprio chamado", async () => {
    const response = await get(SEED_TICKETS.otherSimilar, OTHER_EMPLOYEE_ID);
    expect(response.statusCode).toBe(200);
  });
});
