import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { AppError } from "./plugins/errors";
import { createTestApp, type TestApp } from "./testing";

describe("tickets-api", () => {
  let testApp: TestApp;
  let app: FastifyInstance;

  beforeEach(() => {
    testApp = createTestApp();
    app = testApp.app;
  });

  afterEach(async () => {
    await testApp.close();
  });

  it("GET /health responde 200 com JSON { status: 'ok' } sem identificação", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("rota desconhecida responde 404 no formato de erro padrão", async () => {
    const response = await app.inject({ method: "GET", url: "/nao-existe" });

    expect(response.statusCode).toBe(404);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(response.json()).toEqual({
      error: { code: "not_found", message: expect.any(String) },
    });
  });

  it("exceção não tratada responde 500 internal_error sem stack no corpo", async () => {
    app.get("/boom", async () => {
      throw new Error("falha secreta em /srv/app.ts:42");
    });

    const response = await app.inject({ method: "GET", url: "/boom" });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: { code: "internal_error", message: "Erro interno no sistema de chamados." },
    });
    expect(response.body).not.toMatch(/stack|secreta|app\.ts/);
  });

  it("ZodError responde 400 invalid_request citando o campo", async () => {
    app.post("/validar", async (request) => z.object({ category: z.string() }).parse(request.body));

    const response = await app.inject({ method: "POST", url: "/validar", payload: {} });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("invalid_request");
    expect(response.json().error.message).toMatch(/category/);
  });

  it("AppError usa o status do código", async () => {
    app.get("/conflito", async () => {
      throw new AppError("conflict", "Chamado resolvido.");
    });

    const response = await app.inject({ method: "GET", url: "/conflito" });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: { code: "conflict", message: "Chamado resolvido." } });
  });

  it("JSON malformado responde 400 invalid_request", async () => {
    app.post("/eco", async (request) => request.body);

    const response = await app.inject({
      method: "POST",
      url: "/eco",
      headers: { "content-type": "application/json" },
      payload: "{nao-e-json",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("invalid_request");
  });
});
