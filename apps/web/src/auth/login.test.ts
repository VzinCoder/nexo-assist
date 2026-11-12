import { TicketNotFoundError, TicketsUnavailableError, type Employee } from "@nexo/shared";
import { describe, expect, it, vi } from "vitest";
import { createLoginHandler, createLogoutHandler } from "./login";
import { SESSION_COOKIE, readCookie, verifySession } from "./session";

const SECRET = "segredo-de-teste-com-mais-de-32-caracteres";
const now = new Date("2026-11-11T13:00:00.000Z");

const people: Record<string, Employee> = {
  "ana.souza@nexo.com.br": {
    id: "emp-001",
    name: "Ana Souza",
    email: "ana.souza@nexo.com.br",
    department: "Comercial",
    role: "employee",
  },
  "juliana.alves@nexo.com.br": {
    id: "emp-006",
    name: "Juliana Alves",
    email: "juliana.alves@nexo.com.br",
    department: "TI",
    role: "analyst_n1",
  },
};

function fakeTickets(mode: "ok" | "down" = "ok") {
  return {
    getEmployeeByEmail: vi.fn(async (email: string) => {
      if (mode === "down") throw new TicketsUnavailableError(503, "unavailable", "fora");
      const employee = people[email];
      if (!employee) throw new TicketNotFoundError(404, "employee_not_found", "não encontrado");
      return employee;
    }),
  };
}

function post(body: unknown): Request {
  return new Request("http://localhost:3000/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function handler(mode: "ok" | "down" = "ok") {
  const tickets = fakeTickets(mode);
  return { tickets, login: createLoginHandler({ tickets, sessionSecret: SECRET, secureCookies: false, now: () => now }) };
}

describe("POST /api/auth/login", () => {
  it("funcionário do seed recebe cookie e vai para /chat", async () => {
    const { login } = handler();
    const response = await login(post({ email: "Ana.Souza@nexo.com.br", password: "qualquer" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ redirectTo: "/chat" });
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    const token = readCookie(setCookie.split(";")[0] ?? null, SESSION_COOKIE);
    expect((await verifySession(token, SECRET, now))?.employeeId).toBe("emp-001");
  });

  it("analista vai para /console", async () => {
    const { login } = handler();
    const response = await login(post({ email: "juliana.alves@nexo.com.br", password: "x" }));
    expect(await response.json()).toEqual({ redirectTo: "/console" });
  });

  it("e-mail desconhecido: erro e nenhum cookie", async () => {
    const { login } = handler();
    const response = await login(post({ email: "ninguem@nexo.com.br", password: "x" }));
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
    const body = (await response.json()) as { error: { field: string; message: string } };
    expect(body.error.field).toBe("email");
    expect(body.error.message).toMatch(/E-mail não encontrado/);
  });

  it("campos inválidos: erro do campo sem consultar o serviço", async () => {
    const { login, tickets } = handler();
    const badEmail = await login(post({ email: "nao-e-email", password: "x" }));
    expect(badEmail.status).toBe(400);
    expect(((await badEmail.json()) as { error: { field: string } }).error.field).toBe("email");
    const noPassword = await login(post({ email: "ana.souza@nexo.com.br", password: "" }));
    expect(((await noPassword.json()) as { error: { field: string } }).error.field).toBe("password");
    expect(tickets.getEmployeeByEmail).not.toHaveBeenCalled();
  });

  it("serviço fora do ar: mensagem de indisponível e nenhum cookie", async () => {
    const { login } = handler("down");
    const response = await login(post({ email: "ana.souza@nexo.com.br", password: "x" }));
    expect(response.status).toBe(503);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(((await response.json()) as { error: { message: string } }).error.message).toMatch(/indisponível/);
  });
});

describe("POST /api/auth/logout", () => {
  it("apaga o cookie e redireciona para /login", async () => {
    const logout = createLogoutHandler({ secureCookies: false });
    const response = await logout(new Request("http://localhost:3000/api/auth/logout", { method: "POST" }));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
    expect(response.headers.get("set-cookie")).toMatch(/nexo_session=;.*Max-Age=0/);
  });
});
