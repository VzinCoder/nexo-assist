import type { z } from "zod";
import { articleListSchema, type Article } from "../schemas/article";
import { employeeSchema, type Employee } from "../schemas/employee";
import { errorBodySchema } from "../schemas/errors";
import {
  similarTicketListSchema,
  ticketSchema,
  ticketSummaryListSchema,
  type CreateTicketBody,
  type EscalateBody,
  type SimilarTicket,
  type Ticket,
  type TicketListQuery,
  type TicketSummary,
} from "../schemas/ticket";
import {
  TicketConflictError,
  TicketNotFoundError,
  TicketsClientError,
  TicketsUnavailableError,
} from "./errors";

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export type TicketsClientOptions = {
  baseUrl: string;
  serviceToken: string;
  /** Timeout de cada tentativa (padrão 5000 ms). */
  timeoutMs?: number;
  /** Máximo de tentativas por operação (padrão 3). */
  maxAttempts?: number;
  /** Espera antes da 2ª tentativa; dobra a cada nova tentativa (padrão 200 ms). */
  baseDelayMs?: number;
  fetch?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
};

export type TicketsClient = {
  getEmployeeByEmail(email: string): Promise<Employee>;
  searchArticles(query?: string): Promise<Article[]>;
  listTickets(employeeId: string, query?: TicketListQuery): Promise<TicketSummary[]>;
  getTicket(employeeId: string, ticketId: string): Promise<Ticket>;
  findSimilarTickets(employeeId: string, text: string): Promise<SimilarTicket[]>;
  createTicket(employeeId: string, body: CreateTicketBody): Promise<Ticket>;
  addComment(employeeId: string, ticketId: string, text: string): Promise<Ticket>;
  reopenTicket(employeeId: string, ticketId: string, comment?: string): Promise<Ticket>;
  escalateTicket(employeeId: string, ticketId: string, body: EscalateBody): Promise<Ticket>;
};

type RequestSpec<T> = {
  method: "GET" | "POST";
  path: string;
  employeeId?: string;
  body?: unknown;
  schema: z.ZodType<T>;
};

const UNAVAILABLE_MESSAGE =
  "O sistema de chamados está indisponível no momento. Tente novamente em alguns minutos.";

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function isTimeout(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error.name === "TimeoutError" || error.name === "AbortError")
  );
}

async function readErrorBody(response: Response): Promise<{ code: string; message: string }> {
  const fallback = { code: `http_${response.status}`, message: `Erro HTTP ${response.status}.` };
  try {
    const parsed = errorBodySchema.safeParse(await response.json());
    return parsed.success ? parsed.data.error : fallback;
  } catch {
    return fallback;
  }
}

/** Cliente tipado do tickets-api com timeout por tentativa, retry (503/timeout) e erros tipados. */
export function createTicketsClient(options: TicketsClientOptions): TicketsClient {
  const {
    serviceToken,
    timeoutMs = 5000,
    maxAttempts = 3,
    baseDelayMs = 200,
    fetch: fetchImpl = globalThis.fetch.bind(globalThis),
    sleep = defaultSleep,
  } = options;
  const baseUrl = options.baseUrl.replace(/\/+$/, "");

  async function request<T>(spec: RequestSpec<T>): Promise<T> {
    const headers: Record<string, string> = {
      accept: "application/json",
      "x-service-token": serviceToken,
    };
    if (spec.employeeId !== undefined) headers["x-employee-id"] = spec.employeeId;
    if (spec.body !== undefined) headers["content-type"] = "application/json";

    let lastError: TicketsUnavailableError | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (attempt > 1) await sleep(baseDelayMs * 2 ** (attempt - 2));

      let response: Response;
      try {
        response = await fetchImpl(`${baseUrl}${spec.path}`, {
          method: spec.method,
          headers,
          body: spec.body === undefined ? undefined : JSON.stringify(spec.body),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        if (isTimeout(error)) {
          lastError = new TicketsUnavailableError(null, "timeout", UNAVAILABLE_MESSAGE, {
            cause: error,
          });
          continue;
        }
        // Conexão recusada/DNS: o serviço está inalcançável; não adianta repetir.
        throw new TicketsUnavailableError(null, "network_error", UNAVAILABLE_MESSAGE, {
          cause: error,
        });
      }

      if (response.status === 503) {
        const body = await readErrorBody(response);
        lastError = new TicketsUnavailableError(503, body.code, UNAVAILABLE_MESSAGE);
        continue;
      }

      if (!response.ok) {
        const { code, message } = await readErrorBody(response);
        if (response.status === 404) throw new TicketNotFoundError(404, code, message);
        if (response.status === 409) throw new TicketConflictError(409, code, message);
        throw new TicketsClientError(response.status, code, message);
      }

      let json: unknown;
      try {
        json = await response.json();
      } catch (error) {
        throw new TicketsClientError(response.status, "invalid_response", "Resposta não é JSON.", {
          cause: error,
        });
      }
      const parsed = spec.schema.safeParse(json);
      if (!parsed.success) {
        throw new TicketsClientError(
          response.status,
          "invalid_response",
          "Resposta do sistema de chamados fora do formato esperado.",
          { cause: parsed.error },
        );
      }
      return parsed.data;
    }

    throw lastError ?? new TicketsUnavailableError(null, "unavailable", UNAVAILABLE_MESSAGE);
  }

  const ticketPath = (ticketId: string, suffix = "") =>
    `/tickets/${encodeURIComponent(ticketId)}${suffix}`;

  return {
    getEmployeeByEmail: (email) =>
      request({
        method: "GET",
        path: `/employees/by-email/${encodeURIComponent(email)}`,
        schema: employeeSchema,
      }),
    searchArticles: (query) =>
      request({
        method: "GET",
        path: query ? `/kb/articles?${new URLSearchParams({ q: query }).toString()}` : "/kb/articles",
        schema: articleListSchema,
      }),
    listTickets: (employeeId, query = {}) =>
      request({
        method: "GET",
        path: query.status
          ? `/tickets?${new URLSearchParams({ status: query.status }).toString()}`
          : "/tickets",
        employeeId,
        schema: ticketSummaryListSchema,
      }),
    getTicket: (employeeId, ticketId) =>
      request({ method: "GET", path: ticketPath(ticketId), employeeId, schema: ticketSchema }),
    findSimilarTickets: (employeeId, text) =>
      request({
        method: "POST",
        path: "/tickets/similar",
        employeeId,
        body: { text },
        schema: similarTicketListSchema,
      }),
    createTicket: (employeeId, body) =>
      request({ method: "POST", path: "/tickets", employeeId, body, schema: ticketSchema }),
    addComment: (employeeId, ticketId, text) =>
      request({
        method: "POST",
        path: ticketPath(ticketId, "/comments"),
        employeeId,
        body: { text },
        schema: ticketSchema,
      }),
    reopenTicket: (employeeId, ticketId, comment) =>
      request({
        method: "POST",
        path: ticketPath(ticketId, "/reopen"),
        employeeId,
        body: comment === undefined ? {} : { comment },
        schema: ticketSchema,
      }),
    escalateTicket: (employeeId, ticketId, body) =>
      request({
        method: "POST",
        path: ticketPath(ticketId, "/escalate"),
        employeeId,
        body,
        schema: ticketSchema,
      }),
  };
}
