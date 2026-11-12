import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDb, type Db } from "../db/client";
import { applySeed } from "../seed/apply";
import { MAIN_EMPLOYEE_ID } from "../seed/data";
import { currentEmployee, registerEmployeeContext } from "./employee-context";
import { registerErrorHandlers } from "./errors";

describe("employee-context", () => {
  let db: Db;
  let app: FastifyInstance;

  beforeEach(() => {
    db = createDb(":memory:");
    applySeed(db, new Date("2026-11-11T10:00:00-03:00"));
    app = Fastify();
    registerErrorHandlers(app);
    void app.register(async (scope) => {
      registerEmployeeContext(scope, db);
      scope.get("/tickets", async (request) => ({ id: currentEmployee(request).id }));
    });
  });

  afterEach(async () => {
    await app.close();
    db.$client.close();
  });

  it("sem X-Employee-Id responde 400 invalid_request", async () => {
    const response = await app.inject({ method: "GET", url: "/tickets" });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("invalid_request");
  });

  it("X-Employee-Id malformado responde 400 invalid_request", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/tickets",
      headers: { "x-employee-id": "ana" },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("invalid_request");
  });

  it("funcionário inexistente responde 401 unauthorized", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/tickets",
      headers: { "x-employee-id": "emp-999" },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("unauthorized");
  });

  it("funcionário existente é decorado em request.employee", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/tickets",
      headers: { "x-employee-id": MAIN_EMPLOYEE_ID },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ id: MAIN_EMPLOYEE_ID });
  });
});
