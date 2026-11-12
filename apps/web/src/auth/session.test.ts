import { describe, expect, it } from "vitest";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  getSessionFromRequest,
  homeFor,
  newSession,
  readCookie,
  sessionCookieHeader,
  signSession,
  verifySession,
} from "./session";

const SECRET = "segredo-de-teste-com-mais-de-32-caracteres";
const now = new Date("2026-11-11T13:00:00.000Z");
const ana = { id: "emp-001", role: "employee" as const, name: "Ana Souza", email: "ana.souza@nexo.com.br" };

describe("sessão em cookie assinado", () => {
  it("aceita cookie válido", async () => {
    const token = await signSession(newSession(ana, now), SECRET);
    const session = await verifySession(token, SECRET, now);
    expect(session).toMatchObject({ employeeId: "emp-001", role: "employee" });
    expect(session?.exp).toBe(now.getTime() + SESSION_TTL_MS);
  });

  it("rejeita cookie adulterado (outro employeeId)", async () => {
    const token = await signSession(newSession(ana, now), SECRET);
    const [, signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...newSession(ana, now), employeeId: "emp-002" })).toString(
      "base64url",
    );
    expect(await verifySession(`${forged}.${signature}`, SECRET, now)).toBeNull();
    expect(await verifySession(`${token}x`, SECRET, now)).toBeNull();
    expect(await verifySession("lixo", SECRET, now)).toBeNull();
    expect(await verifySession(undefined, SECRET, now)).toBeNull();
  });

  it("rejeita cookie expirado", async () => {
    const token = await signSession(newSession(ana, now), SECRET);
    const later = new Date(now.getTime() + SESSION_TTL_MS + 1);
    expect(await verifySession(token, SECRET, later)).toBeNull();
  });

  it("rejeita cookie assinado com outro segredo", async () => {
    const token = await signSession(newSession(ana, now), "outro-segredo-qualquer-com-32-caracteres!");
    expect(await verifySession(token, SECRET, now)).toBeNull();
  });

  it("monta o cookie httpOnly/SameSite=Lax e lê do request", async () => {
    const token = await signSession(newSession(ana, now), SECRET);
    const header = sessionCookieHeader(token, false);
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Lax");
    expect(header).not.toContain("Secure");
    expect(sessionCookieHeader(token, true)).toContain("Secure");

    const request = new Request("http://x/api", { headers: { cookie: `a=1; ${SESSION_COOKIE}=${token}` } });
    expect(readCookie(request.headers.get("cookie"), SESSION_COOKIE)).toBe(token);
    expect((await getSessionFromRequest(request, SECRET, now))?.employeeId).toBe("emp-001");
  });

  it("destino por papel", () => {
    expect(homeFor("employee")).toBe("/chat");
    expect(homeFor("analyst_n1")).toBe("/console");
    expect(homeFor("analyst_n2")).toBe("/console");
  });
});
