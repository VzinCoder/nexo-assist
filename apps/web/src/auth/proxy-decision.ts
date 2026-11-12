import type { EmployeeRole } from "@nexo/shared";
import { homeFor, isAnalyst } from "./session";

export type ProxyDecision =
  | { type: "next" }
  | { type: "redirect"; to: string }
  | { type: "unauthorized" };

const PUBLIC_API = new Set(["/api/auth/login", "/api/auth/logout"]);

/**
 * Decide o que o proxy faz com a requisição (função pura). É uma checagem otimista: as rotas de
 * API revalidam a sessão por conta própria (defesa em profundidade).
 */
export function decideProxy(pathname: string, session: { role: EmployeeRole } | null): ProxyDecision {
  if (pathname.startsWith("/api/")) {
    if (PUBLIC_API.has(pathname)) return { type: "next" };
    return session ? { type: "next" } : { type: "unauthorized" };
  }
  if (pathname === "/") return { type: "redirect", to: session ? homeFor(session.role) : "/login" };
  if (pathname === "/login") return session ? { type: "redirect", to: homeFor(session.role) } : { type: "next" };

  const inChat = pathname === "/chat" || pathname.startsWith("/chat/");
  const inConsole = pathname === "/console" || pathname.startsWith("/console/");
  if (!inChat && !inConsole) return { type: "next" };
  if (!session) return { type: "redirect", to: "/login" };
  if (inChat && isAnalyst(session.role)) return { type: "redirect", to: "/console" };
  if (inConsole && !isAnalyst(session.role)) return { type: "redirect", to: "/chat" };
  return { type: "next" };
}
