import { describe, expect, it, vi } from "vitest";
import type { TicketSummary } from "../schemas/ticket";
import {
  TicketConflictError,
  TicketNotFoundError,
  TicketsClientError,
  TicketsUnavailableError,
} from "./errors";
import { createTicketsClient, type FetchLike } from "./tickets-client";

const summary: TicketSummary = {
  id: "INC-20311",
  type: "INC",
  title: "Notebook lento",
  description: "Lento após atualização",
  category: "hardware",
  priority: "medium",
  status: "waiting_analyst",
  affected: "me",
  employeeId: "emp-001",
  createdAt: "2026-11-04T13:00:00.000Z",
  updatedAt: "2026-11-05T13:00:00.000Z",
  resolvedAt: null,
  dueAt: "2026-11-10T13:00:00.000Z",
  isOverdue: true,
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const errorJson = (status: number, code: string, message: string) =>
  json(status, { error: { code, message } });

/** `fetch` falso que devolve as respostas na ordem e registra as chamadas. */
function fakeFetch(...responses: Array<() => Response | Promise<Response>>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fn: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const next = responses[Math.min(calls.length - 1, responses.length - 1)];
    if (!next) throw new Error("sem resposta configurada");
    return next();
  };
  return { fn, calls };
}

function makeClient(fetch: FetchLike, timeoutMs = 1000) {
  const sleep = vi.fn(async (_ms: number) => {});
  const client = createTicketsClient({
    baseUrl: "http://tickets.test/",
    serviceToken: "token-de-teste",
    fetch,
    sleep,
    timeoutMs,
  });
  return { client, sleep };
}

describe("createTicketsClient", () => {
  it("envia token de serviço e id do funcionário e devolve dados validados", async () => {
    const { fn, calls } = fakeFetch(() => json(200, [summary]));
    const { client } = makeClient(fn);

    const tickets = await client.listTickets("emp-001", { status: "waiting_analyst" });

    expect(tickets).toEqual([summary]);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("http://tickets.test/tickets?status=waiting_analyst");
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers["x-service-token"]).toBe("token-de-teste");
    expect(headers["x-employee-id"]).toBe("emp-001");
  });

  it("não envia X-Employee-Id em rotas que não são de chamados", async () => {
    const { fn, calls } = fakeFetch(() => json(200, []));
    const { client } = makeClient(fn);

    await client.searchArticles("vpn 809");

    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers["x-employee-id"]).toBeUndefined();
    expect(calls[0]?.url).toBe("http://tickets.test/kb/articles?q=vpn+809");
  });

  it("503 seguido de 200: devolve o resultado após 2 chamadas", async () => {
    const { fn, calls } = fakeFetch(
      () => errorJson(503, "service_unavailable", "Instável."),
      () => json(200, [summary]),
    );
    const { client, sleep } = makeClient(fn);

    await expect(client.listTickets("emp-001")).resolves.toEqual([summary]);
    expect(calls).toHaveLength(2);
    expect(sleep.mock.calls).toEqual([[200]]);
  });

  it("3× 503: faz 3 chamadas com backoff exponencial e lança TicketsUnavailableError", async () => {
    const { fn, calls } = fakeFetch(() => errorJson(503, "service_unavailable", "Instável."));
    const { client, sleep } = makeClient(fn);

    await expect(client.listTickets("emp-001")).rejects.toBeInstanceOf(TicketsUnavailableError);
    expect(calls).toHaveLength(3);
    expect(sleep.mock.calls).toEqual([[200], [400]]);
  });

  it("timeout em todas as tentativas: lança TicketsUnavailableError", async () => {
    const hang: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      });
    const spy = vi.fn(hang);
    const { client } = makeClient(spy, 20);

    const error = await client.getTicket("emp-001", "INC-20311").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(TicketsUnavailableError);
    expect((error as TicketsUnavailableError).code).toBe("timeout");
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it("404 não é repetido e vira TicketNotFoundError", async () => {
    const { fn, calls } = fakeFetch(() => errorJson(404, "not_found", "Chamado não encontrado."));
    const { client } = makeClient(fn);

    const error = await client.getTicket("emp-001", "INC-99999").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(TicketNotFoundError);
    expect((error as TicketNotFoundError).code).toBe("not_found");
    expect(calls).toHaveLength(1);
  });

  it("409 vira TicketConflictError com a mensagem do serviço", async () => {
    const { fn, calls } = fakeFetch(() =>
      errorJson(409, "conflict", "Fora da janela de reabertura de 7 dias."),
    );
    const { client } = makeClient(fn);

    const error = await client.reopenTicket("emp-001", "INC-20001").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(TicketConflictError);
    expect((error as TicketConflictError).message).toBe("Fora da janela de reabertura de 7 dias.");
    expect(calls).toHaveLength(1);
  });

  it("conexão recusada vira TicketsUnavailableError sem retry", async () => {
    const refused = vi.fn<FetchLike>(async () => {
      throw new TypeError("fetch failed");
    });
    const { client } = makeClient(refused);

    await expect(client.listTickets("emp-001")).rejects.toBeInstanceOf(TicketsUnavailableError);
    expect(refused).toHaveBeenCalledTimes(1);
  });

  it("corpo fora do schema lança erro do cliente", async () => {
    const { fn } = fakeFetch(() => json(200, [{ ...summary, status: "pending" }]));
    const { client } = makeClient(fn);

    const error = await client.listTickets("emp-001").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(TicketsClientError);
    expect(error).not.toBeInstanceOf(TicketsUnavailableError);
    expect((error as TicketsClientError).code).toBe("invalid_response");
  });

  it("400 vira erro base com code e message do corpo", async () => {
    const { fn } = fakeFetch(() => errorJson(400, "invalid_request", "category: obrigatório"));
    const { client } = makeClient(fn);

    const error = await client
      .createTicket("emp-001", {
        title: "x",
        description: "y",
        type: "INC",
        category: "other",
        priority: "low",
        affected: "me",
      })
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(TicketsClientError);
    expect((error as TicketsClientError).status).toBe(400);
    expect((error as TicketsClientError).code).toBe("invalid_request");
  });

  it("envia o body em JSON nas operações de escrita", async () => {
    const { fn, calls } = fakeFetch(() => json(200, []));
    const { client } = makeClient(fn);

    await client.findSimilarTickets("emp-001", "notebook lento");

    expect(calls[0]?.init.method).toBe("POST");
    expect(calls[0]?.init.body).toBe(JSON.stringify({ text: "notebook lento" }));
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers["content-type"]).toBe("application/json");
  });
});
