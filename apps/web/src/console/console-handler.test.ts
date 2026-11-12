import { TicketsUnavailableError, type ConversationStatus } from "@nexo/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE, newSession, signSession } from "../auth/session";
import { createDb, type Db } from "../db/client";
import { appendMessage, createConversation, getOwnedConversation, listMessages, setStatus } from "../chat/repository";
import { createConsoleHandlers, type ConsoleConversationDto, type ConsoleListItemDto } from "./console-handler";
import { nextStatus, type ConsoleAction } from "./transitions";

const SECRET = "segredo-de-teste-com-mais-de-32-caracteres";
const now = new Date("2026-11-11T13:00:00.000Z");
const ana = { id: "emp-001", role: "employee" as const, name: "Ana Souza", email: "ana.souza@nexo.com.br" };
const juliana = { id: "emp-101", role: "analyst_n1" as const, name: "Juliana Alves", email: "juliana.alves@nexo.com.br" };
type Who = typeof ana | typeof juliana;

describe("regras de transição", () => {
  const cases: [ConversationStatus, ConsoleAction, ConversationStatus | null][] = [
    ["waiting_human", "assume", "with_human"],
    ["agent", "assume", "with_human"],
    ["with_human", "assume", null],
    ["closed", "assume", null],
    ["with_human", "return", "agent"],
    ["waiting_human", "return", null],
    ["agent", "return", null],
    ["with_human", "close", "closed"],
    ["waiting_human", "close", "closed"],
    ["agent", "close", "closed"],
    ["closed", "close", null],
  ];
  it.each(cases)("%s + %s → %s", (from, action, to) => {
    expect(nextStatus(from, action)).toBe(to);
  });
});

describe("API do console", () => {
  let db: Db;
  const listTickets = vi.fn();
  let handlers: ReturnType<typeof createConsoleHandlers>;
  beforeEach(() => {
    db = createDb(":memory:");
    listTickets.mockReset();
    handlers = createConsoleHandlers({ getDb: () => db, tickets: { listTickets }, sessionSecret: SECRET, now: () => now });
  });
  afterEach(() => db.$client.close());

  async function req(path: string, who: Who | null, body?: unknown) {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (who) headers.cookie = `${SESSION_COOKIE}=${await signSession(newSession(who, now), SECRET)}`;
    return new Request(`http://localhost/api/console${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  function transferred(status: ConversationStatus = "waiting_human") {
    const conversation = createConversation(db, ana.id, now, ana.name);
    appendMessage(db, { conversationId: conversation.id, role: "user", content: "Quero falar com um analista" }, now);
    setStatus(db, conversation.id, status, now, { reason: "Pedido do funcionário", summary: "VPN erro 809 no Windows 11." });
    return conversation.id;
  }

  const act = async (id: string, action: ConsoleAction, who: Who = juliana) =>
    handlers.action(await req(`/conversations/${id}/actions`, who, { action }), id);

  it("sem sessão → 401; funcionário → 403 em todas as rotas", async () => {
    const id = transferred();
    expect((await handlers.list(await req("/conversations", null))).status).toBe(401);
    expect((await handlers.list(await req("/conversations", ana))).status).toBe(403);
    expect((await handlers.detail(await req(`/conversations/${id}`, ana), id)).status).toBe(403);
    expect((await act(id, "assume", ana)).status).toBe(403);
    expect((await handlers.message(await req(`/conversations/${id}/messages`, ana, { text: "oi" }), id)).status).toBe(403);
    expect((await handlers.tickets(await req(`/conversations/${id}/tickets`, ana), id)).status).toBe(403);
    expect(getOwnedConversation(db, id, ana.id)?.status).toBe("waiting_human");
  });

  it("lista por padrão aguardando + em atendimento, com motivo e última mensagem", async () => {
    const waiting = transferred("waiting_human");
    createConversation(db, "emp-002", now, "Carla Mendes");
    const body = (await (await handlers.list(await req("/conversations", juliana))).json()) as {
      conversations: ConsoleListItemDto[];
    };
    expect(body.conversations.map((item) => item.id)).toEqual([waiting]);
    expect(body.conversations[0]).toMatchObject({
      employeeName: "Ana Souza",
      handoffReason: "Pedido do funcionário",
      lastMessage: { role: "user", content: "Quero falar com um analista" },
    });
    const all = (await (await handlers.list(await req("/conversations?status=all", juliana))).json()) as {
      conversations: ConsoleListItemDto[];
    };
    expect(all.conversations).toHaveLength(2);
    expect((await handlers.list(await req("/conversations?status=xyz", juliana))).status).toBe(400);
  });

  it("fluxo assumir → responder → devolver grava mensagens system e analyst", async () => {
    const id = transferred();
    const assumed = (await (await act(id, "assume")).json()) as ConsoleConversationDto;
    expect(assumed.status).toBe("with_human");
    expect(assumed.analystName).toBe("Juliana Alves");
    expect(assumed.handoffSummary).toBe("VPN erro 809 no Windows 11.");

    const sent = await handlers.message(await req(`/conversations/${id}/messages`, juliana, { text: "Olá, Ana!" }), id);
    expect(sent.status).toBe(201);

    const returned = (await (await act(id, "return")).json()) as ConsoleConversationDto;
    expect(returned.status).toBe("agent");
    expect(listMessages(db, id).map((message) => [message.role, message.content])).toEqual([
      ["user", "Quero falar com um analista"],
      ["system", "Juliana Alves assumiu o atendimento."],
      ["analyst", "Olá, Ana!"],
      ["system", "Juliana Alves devolveu a conversa ao assistente virtual. Você pode continuar por aqui."],
    ]);
  });

  it("transição inválida → 409 sem gravar mensagem", async () => {
    const id = transferred();
    expect((await act(id, "return")).status).toBe(409);
    await act(id, "close");
    expect((await act(id, "assume")).status).toBe(409);
    expect((await act(id, "close")).status).toBe(409);
    expect(listMessages(db, id).filter((message) => message.role === "system")).toHaveLength(1);
    expect((await act("nao-existe", "assume")).status).toBe(404);
  });

  it("analista só envia mensagem com a conversa assumida", async () => {
    const id = transferred();
    const response = await handlers.message(await req(`/conversations/${id}/messages`, juliana, { text: "oi" }), id);
    expect(response.status).toBe(409);
    expect(listMessages(db, id).some((message) => message.role === "analyst")).toBe(false);
  });

  it("chamados do funcionário da conversa via cliente do tickets-api; 503 se indisponível", async () => {
    const id = transferred();
    listTickets.mockResolvedValueOnce([]);
    expect((await handlers.tickets(await req(`/conversations/${id}/tickets`, juliana), id)).status).toBe(200);
    expect(listTickets).toHaveBeenCalledWith(ana.id);
    listTickets.mockRejectedValueOnce(new TicketsUnavailableError(503, "unavailable", "fora"));
    expect((await handlers.tickets(await req(`/conversations/${id}/tickets`, juliana), id)).status).toBe(503);
  });
});
