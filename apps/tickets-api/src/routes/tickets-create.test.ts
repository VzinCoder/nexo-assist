import { computeDueAt, ticketSchema } from "@nexo/shared";
import { afterEach, describe, expect, it } from "vitest";
import { tickets } from "../db/schema";
import { MAIN_EMPLOYEE_ID } from "../seed/data";
import { TEST_NOW, authHeaders, createTestApp, type TestApp } from "../testing";

const validBody = {
  title: "VPN não conecta — erro 809",
  description: "Desde ontem o notebook (Windows 11) não conecta na VPN.",
  type: "INC",
  category: "network_vpn",
  priority: "high",
  affected: "me",
};

describe("POST /tickets", () => {
  let t: TestApp;
  afterEach(async () => {
    await t.close();
  });

  const create = (payload: unknown) =>
    t.app.inject({ method: "POST", url: "/tickets", headers: authHeaders(), payload: payload as object });
  const count = () => t.db.select().from(tickets).all().length;

  it("cria chamado open com dueAt pela prioridade e responde 201", async () => {
    t = createTestApp();
    const response = await create(validBody);

    expect(response.statusCode).toBe(201);
    const ticket = ticketSchema.parse(response.json());
    expect(ticket).toMatchObject({
      id: "INC-20312",
      status: "open",
      employeeId: MAIN_EMPLOYEE_ID,
      title: validBody.title,
      resolvedAt: null,
      isOverdue: false,
      comments: [],
      createdAt: TEST_NOW.toISOString(),
      updatedAt: TEST_NOW.toISOString(),
    });
    // Quarta 10h + 4 horas úteis = quarta 14h.
    expect(ticket.dueAt).toBe(computeDueAt("high", TEST_NOW).toISOString());
    expect(ticket.dueAt).toBe(new Date("2026-11-11T14:00:00-03:00").toISOString());
  });

  it("o chamado criado aparece no GET do dono", async () => {
    t = createTestApp();
    await create(validBody);
    const response = await t.app.inject({
      method: "GET",
      url: "/tickets/INC-20312",
      headers: authHeaders(),
    });
    expect(response.statusCode).toBe(200);
  });

  it("campo faltando responde 400 citando o campo e não cria nada", async () => {
    t = createTestApp();
    const before = count();
    const { category: _omit, ...withoutCategory } = validBody;

    const response = await create(withoutCategory);

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("invalid_request");
    expect(response.json().error.message).toMatch(/category/);
    expect(count()).toBe(before);
  });

  it("título vazio ou só com espaços responde 400", async () => {
    t = createTestApp();
    expect((await create({ ...validBody, title: "" })).statusCode).toBe(400);
    expect((await create({ ...validBody, title: "   " })).statusCode).toBe(400);
  });

  it("campo com tipo errado responde 400 citando o campo", async () => {
    t = createTestApp();
    const response = await create({ ...validBody, priority: 3 });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.message).toMatch(/priority/);
  });

  it("ids seguem sequências independentes por tipo", async () => {
    t = createTestApp();
    const inc = await create(validBody);
    const req = await create({ ...validBody, type: "REQ", category: "hardware", priority: "low" });
    const inc2 = await create(validBody);

    expect(inc.json().id).toBe("INC-20312");
    expect(req.json().id).toBe("REQ-10443");
    expect(inc2.json().id).toBe("INC-20313");
  });

  it("com FAILURE_RATE=1 responde 503 e não cria chamado", async () => {
    t = createTestApp({ failureRate: 1, random: () => 0.5 });
    const before = count();

    const response = await create(validBody);

    expect(response.statusCode).toBe(503);
    expect(response.json().error.code).toBe("service_unavailable");
    expect(count()).toBe(before);
  });
});
