import { TicketNotFoundError, TicketsUnavailableError, type TicketsClient } from "@nexo/shared";
import { z } from "zod";
import { clearSessionCookieHeader, homeFor, newSession, sessionCookieHeader, signSession } from "./session";

export const loginBodySchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Informe um e-mail válido.")),
  password: z.string().min(1, "Informe a senha."),
});

export type LoginErrorBody = {
  error: { code: string; message: string; field?: "email" | "password" };
};
export type LoginSuccessBody = { redirectTo: "/chat" | "/console" };

type LoginDeps = {
  tickets: Pick<TicketsClient, "getEmployeeByEmail">;
  sessionSecret: string;
  secureCookies: boolean;
  now?: () => Date;
};

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers });
}

/**
 * `POST /api/auth/login`: valida e-mail/senha (qualquer senha não vazia), busca o funcionário no
 * tickets-api e grava o cookie de sessão. Nunca cria sessão em erro.
 */
export function createLoginHandler(deps: LoginDeps) {
  const now = deps.now ?? (() => new Date());
  return async function login(request: Request): Promise<Response> {
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return json({ error: { code: "invalid_body", message: "Requisição inválida." } } satisfies LoginErrorBody, 400);
    }
    const parsed = loginBodySchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue?.path[0] === "password" ? "password" : "email";
      return json(
        { error: { code: "invalid_field", field, message: issue?.message ?? "Campo inválido." } } satisfies LoginErrorBody,
        400,
      );
    }

    try {
      const employee = await deps.tickets.getEmployeeByEmail(parsed.data.email);
      const token = await signSession(newSession(employee, now()), deps.sessionSecret);
      return json({ redirectTo: homeFor(employee.role) } satisfies LoginSuccessBody, 200, {
        "set-cookie": sessionCookieHeader(token, deps.secureCookies),
      });
    } catch (error) {
      if (error instanceof TicketNotFoundError) {
        return json(
          {
            error: { code: "unknown_email", field: "email", message: "E-mail não encontrado. Confira o endereço corporativo." },
          } satisfies LoginErrorBody,
          401,
        );
      }
      if (error instanceof TicketsUnavailableError) {
        return json(
          {
            error: {
              code: "tickets_unavailable",
              message: "O sistema está indisponível no momento. Tente novamente em alguns minutos.",
            },
          } satisfies LoginErrorBody,
          503,
        );
      }
      return json(
        { error: { code: "internal_error", message: "Não foi possível entrar agora. Tente novamente." } } satisfies LoginErrorBody,
        500,
      );
    }
  };
}

/** `POST /api/auth/logout`: apaga o cookie e volta para o login (303 funciona com form sem JS). */
export function createLogoutHandler(deps: { secureCookies: boolean }) {
  return async function logout(request: Request): Promise<Response> {
    return new Response(null, {
      status: 303,
      headers: {
        location: new URL("/login", request.url).toString(),
        "set-cookie": clearSessionCookieHeader(deps.secureCookies),
      },
    });
  };
}
