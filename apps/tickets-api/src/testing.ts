import { createTicketsClient, type FetchLike, type TicketsClient } from "@nexo/shared";
import type { FastifyInstance } from "fastify";
import { buildApp, type AppOptions } from "./app";
import { createDb, type Db } from "./db/client";
import { applySeed } from "./seed/apply";
import { MAIN_EMPLOYEE_ID } from "./seed/data";

export const TEST_TOKEN = "token-de-teste-0123456789";

/** Quarta-feira, 10h em São Paulo: instante fixo dos testes de rota. */
export const TEST_NOW = new Date("2026-11-11T10:00:00-03:00");

export type TestApp = { app: FastifyInstance; db: Db; close: () => Promise<void> };

/** App com banco em memória já semeado em `TEST_NOW`, sem instabilidade. */
export function createTestApp(overrides: Partial<AppOptions> = {}): TestApp {
  const db = createDb(":memory:");
  applySeed(db, TEST_NOW);
  const app = buildApp({
    db,
    serviceToken: TEST_TOKEN,
    failureRate: 0,
    latencyMs: 0,
    now: () => TEST_NOW,
    ...overrides,
  });
  return {
    app,
    db,
    close: async () => {
      await app.close();
      db.$client.close();
    },
  };
}

/** Headers de um cliente autenticado agindo em nome de um funcionário. */
export function authHeaders(employeeId: string = MAIN_EMPLOYEE_ID): Record<string, string> {
  return { "x-service-token": TEST_TOKEN, "x-employee-id": employeeId };
}

/** `fetch` que encaminha para `app.inject`: contrato ponta a ponta sem abrir porta. */
export function injectFetch(app: FastifyInstance, calls: { count: number } = { count: 0 }): FetchLike {
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

/** Cliente do `@nexo/shared` falando com um app em memória (testes de outros pacotes e eval). */
export function createInMemoryTicketsClient(app: FastifyInstance): TicketsClient {
  return createTicketsClient({
    baseUrl: "http://tickets-api.test",
    serviceToken: TEST_TOKEN,
    fetch: injectFetch(app),
    sleep: async () => {},
  });
}
