import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "./app";

describe("tickets-api", () => {
  let app: FastifyInstance;

  beforeEach(() => {
    app = buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it("GET /health responde 200 com JSON { status: 'ok' } sem identificação", async () => {
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("rota desconhecida responde 404 em JSON", async () => {
    const response = await app.inject({ method: "GET", url: "/nao-existe" });

    expect(response.statusCode).toBe(404);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(response.json()).toMatchObject({ error: "not_found" });
  });
});
