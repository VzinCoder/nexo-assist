import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestApp, TEST_TOKEN, type TestApp } from "../testing";

const headers = { "x-service-token": TEST_TOKEN };

describe("GET /employees/by-email/:email", () => {
  let t: TestApp;
  beforeEach(() => {
    t = createTestApp();
  });
  afterEach(async () => {
    await t.close();
  });

  const get = (email: string) =>
    t.app.inject({
      method: "GET",
      url: `/employees/by-email/${encodeURIComponent(email)}`,
      headers,
    });

  it("devolve o funcionário do seed sem exigir X-Employee-Id", async () => {
    const response = await get("ana.souza@nexo.com.br");
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: "emp-001",
      name: "Ana Souza",
      email: "ana.souza@nexo.com.br",
      department: "Financeiro",
      role: "employee",
    });
  });

  it("ignora maiúsculas no e-mail", async () => {
    const response = await get("Ana.Souza@NEXO.com.br");
    expect(response.statusCode).toBe(200);
    expect(response.json().id).toBe("emp-001");
  });

  it("devolve analista com role", async () => {
    expect((await get("rafael.lima@nexo.com.br")).json().role).toBe("analyst_n2");
  });

  it("e-mail desconhecido responde 404", async () => {
    const response = await get("ninguem@nexo.com.br");
    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe("not_found");
  });

  it("valor que não é e-mail responde 400", async () => {
    const response = await get("nao-e-email");
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("invalid_request");
  });

  it("exige token de serviço", async () => {
    const response = await t.app.inject({
      method: "GET",
      url: "/employees/by-email/ana.souza%40nexo.com.br",
    });
    expect(response.statusCode).toBe(401);
  });
});

describe("GET /kb/articles", () => {
  let t: TestApp;
  beforeEach(() => {
    t = createTestApp();
  });
  afterEach(async () => {
    await t.close();
  });

  const search = async (q?: string) => {
    const url = q === undefined ? "/kb/articles" : `/kb/articles?q=${encodeURIComponent(q)}`;
    const response = await t.app.inject({ method: "GET", url, headers });
    expect(response.statusCode).toBe(200);
    return response.json() as Array<{ id: string; title: string; content: string; tags: string[] }>;
  };

  it("q=vpn erro 809 traz o artigo da VPN em primeiro", async () => {
    const results = await search("vpn erro 809");
    expect(results[0]?.title).toBe("VPN com erro 809");
    expect(results[0]?.tags).toContain("vpn");
  });

  it("q=horario encontra 'Horário do service desk' sem acento", async () => {
    const titles = (await search("horario")).map((a) => a.title);
    expect(titles).toContain("Horário do service desk");
  });

  it("só stopwords devolve lista vazia", async () => {
    expect(await search("de com para")).toEqual([]);
  });

  it("termo inexistente devolve lista vazia", async () => {
    expect(await search("xilofone")).toEqual([]);
  });

  it("sem q devolve todos os artigos ordenados por título", async () => {
    const titles = (await search()).map((a) => a.title);
    expect(titles).toHaveLength(8);
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b, "pt-BR")));
  });

  it("q vazio equivale a sem q", async () => {
    expect(await search("")).toHaveLength(8);
  });
});
