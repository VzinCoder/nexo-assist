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
