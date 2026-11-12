import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerErrorHandlers } from "./errors";
import { registerInstability } from "./instability";
import { registerServiceAuth, tokensMatch } from "./service-auth";

const TOKEN = "token-de-teste-0123456789";

/**
 * Monta a mesma composição do `buildApp` (erros e `/health` na raiz; instabilidade e token num
 * escopo) com rotas de teste no lugar das reais, para isolar o comportamento dos plugins.
 */
function buildScopedApp(options: { failureRate?: number; latencyMs?: number; random?: () => number }) {
  const sleep = vi.fn(async (_ms: number) => {});
  const createTicket = vi.fn(() => ({ id: "INC-00001" }));
  const app = Fastify();
  registerErrorHandlers(app);
  app.get("/health", async () => ({ status: "ok" }));
  void app.register(async (scope) => {
    registerInstability(scope, {
      failureRate: options.failureRate ?? 0,
      latencyMs: options.latencyMs ?? 0,
      random: options.random ?? (() => 0),
      sleep,
    });
    registerServiceAuth(scope, TOKEN);
    scope.get("/tickets", async () => []);
    scope.post("/tickets", async (_request, reply) => reply.code(201).send(createTicket()));
  });
  return { app, sleep, createTicket };
}

describe("service-auth", () => {
  let app: FastifyInstance | undefined;
  afterEach(async () => {
    await app?.close();
  });

  it("401 sem X-Service-Token", async () => {
    ({ app } = buildScopedApp({}));
    const response = await app.inject({ method: "GET", url: "/tickets" });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: { code: "unauthorized", message: expect.any(String) },
    });
  });

  it("401 com token errado", async () => {
    ({ app } = buildScopedApp({}));
    const response = await app.inject({
      method: "GET",
      url: "/tickets",
      headers: { "x-service-token": "outro-token" },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("unauthorized");
  });

  it("atende com o token correto", async () => {
    ({ app } = buildScopedApp({}));
    const response = await app.inject({
      method: "GET",
      url: "/tickets",
      headers: { "x-service-token": TOKEN },
    });
    expect(response.statusCode).toBe(200);
  });

  it("/health não exige token", async () => {
    ({ app } = buildScopedApp({}));
    expect((await app.inject({ method: "GET", url: "/health" })).statusCode).toBe(200);
  });

  it("tokensMatch compara valores de tamanhos diferentes sem lançar", () => {
    expect(tokensMatch("a", TOKEN)).toBe(false);
    expect(tokensMatch(TOKEN, TOKEN)).toBe(true);
  });
});

describe("instability", () => {
  let app: FastifyInstance | undefined;
  afterEach(async () => {
    await app?.close();
  });

  it("FAILURE_RATE=1: 503 em /tickets e 200 em /health", async () => {
    ({ app } = buildScopedApp({ failureRate: 1, random: () => 0.99 }));
    const tickets = await app.inject({
      method: "GET",
      url: "/tickets",
      headers: { "x-service-token": TOKEN },
    });
    expect(tickets.statusCode).toBe(503);
    expect(tickets.json().error.code).toBe("service_unavailable");
    expect((await app.inject({ method: "GET", url: "/health" })).statusCode).toBe(200);
  });

  it("a falha ocorre antes do token (falha simulada não depende de autenticação)", async () => {
    ({ app } = buildScopedApp({ failureRate: 1 }));
    const response = await app.inject({ method: "GET", url: "/tickets" });
    expect(response.statusCode).toBe(503);
  });

  it("POST /tickets com falha não executa a rota", async () => {
    let createTicket: ReturnType<typeof buildScopedApp>["createTicket"];
    ({ app, createTicket } = buildScopedApp({ failureRate: 1 }));
    const response = await app.inject({
      method: "POST",
      url: "/tickets",
      headers: { "x-service-token": TOKEN },
      payload: {},
    });
    expect(response.statusCode).toBe(503);
    expect(createTicket).not.toHaveBeenCalled();
  });

  it("FAILURE_RATE=0: nenhuma falha simulada", async () => {
    ({ app } = buildScopedApp({ failureRate: 0, random: () => 0 }));
    for (let i = 0; i < 5; i++) {
      const response = await app.inject({
        method: "GET",
        url: "/tickets",
        headers: { "x-service-token": TOKEN },
      });
      expect(response.statusCode).toBe(200);
    }
  });

  it("falha só quando random() < FAILURE_RATE", async () => {
    let calls = 0;
    const values = [0.2, 0.7];
    ({ app } = buildScopedApp({ failureRate: 0.5, random: () => values[calls++] ?? 1 }));
    const send = () =>
      app!.inject({ method: "GET", url: "/tickets", headers: { "x-service-token": TOKEN } });
    expect((await send()).statusCode).toBe(503);
    expect((await send()).statusCode).toBe(200);
  });

  it("LATENCY_MS chama sleep com o valor configurado, mas não em /health", async () => {
    let sleep: ReturnType<typeof buildScopedApp>["sleep"];
    ({ app, sleep } = buildScopedApp({ latencyMs: 300 }));
    await app.inject({ method: "GET", url: "/health" });
    expect(sleep).not.toHaveBeenCalled();
    await app.inject({ method: "GET", url: "/tickets", headers: { "x-service-token": TOKEN } });
    expect(sleep).toHaveBeenCalledWith(300);
  });
});
