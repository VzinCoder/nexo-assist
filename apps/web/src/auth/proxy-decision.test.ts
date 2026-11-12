import { describe, expect, it } from "vitest";
import { decideProxy } from "./proxy-decision";

const employee = { role: "employee" as const };
const analyst = { role: "analyst_n1" as const };

describe("decideProxy", () => {
  it("raiz redireciona conforme a sessão", () => {
    expect(decideProxy("/", null)).toEqual({ type: "redirect", to: "/login" });
    expect(decideProxy("/", employee)).toEqual({ type: "redirect", to: "/chat" });
    expect(decideProxy("/", analyst)).toEqual({ type: "redirect", to: "/console" });
  });

  it("páginas protegidas sem sessão vão para /login", () => {
    expect(decideProxy("/chat", null)).toEqual({ type: "redirect", to: "/login" });
    expect(decideProxy("/console", null)).toEqual({ type: "redirect", to: "/login" });
  });

  it("redireciona por papel", () => {
    expect(decideProxy("/chat", analyst)).toEqual({ type: "redirect", to: "/console" });
    expect(decideProxy("/console", employee)).toEqual({ type: "redirect", to: "/chat" });
    expect(decideProxy("/chat", employee)).toEqual({ type: "next" });
    expect(decideProxy("/console", analyst)).toEqual({ type: "next" });
  });

  it("login com sessão volta para a página do papel", () => {
    expect(decideProxy("/login", employee)).toEqual({ type: "redirect", to: "/chat" });
    expect(decideProxy("/login", null)).toEqual({ type: "next" });
  });

  it("APIs sem sessão respondem 401, exceto login/logout", () => {
    expect(decideProxy("/api/chat", null)).toEqual({ type: "unauthorized" });
    expect(decideProxy("/api/conversations/current", null)).toEqual({ type: "unauthorized" });
    expect(decideProxy("/api/auth/login", null)).toEqual({ type: "next" });
    expect(decideProxy("/api/auth/logout", null)).toEqual({ type: "next" });
    expect(decideProxy("/api/chat", employee)).toEqual({ type: "next" });
  });
});
