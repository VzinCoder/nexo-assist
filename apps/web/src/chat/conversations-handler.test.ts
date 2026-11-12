import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SESSION_COOKIE, newSession, signSession } from "../auth/session";
import { createDb, type Db } from "../db/client";
import { createConversationsHandlers } from "./conversations-handler";
import type { ConversationDto } from "./dto";
import { appendMessage, appendUserMessage, createConversation, getOwnedConversation } from "./repository";

const SECRET = "segredo-de-teste-com-mais-de-32-caracteres";
const now = new Date("2026-11-11T13:00:00.000Z");
const ana = { id: "emp-001", role: "employee" as const, name: "Ana Souza", email: "ana.souza@nexo.com.br" };
const carla = { id: "emp-002", role: "employee" as const, name: "Carla Mendes", email: "carla.mendes@nexo.com.br" };

describe("API de conversas", () => {
  let db: Db;
  let handlers: ReturnType<typeof createConversationsHandlers>;
  beforeEach(() => {
    db = createDb(":memory:");
    handlers = createConversationsHandlers({ getDb: () => db, sessionSecret: SECRET, now: () => now });
  });
  afterEach(() => db.$client.close());

  async function request(method: "GET" | "POST", who: typeof ana | null = ana) {
    const headers: Record<string, string> = {};
    if (who) headers.cookie = `${SESSION_COOKIE}=${await signSession(newSession(who, now), SECRET)}`;
    return new Request("http://localhost/api/conversations", { method, headers });
  }

  it("sem sessão → 401", async () => {
    expect((await handlers.getCurrent(await request("GET", null))).status).toBe(401);
    expect((await handlers.create(await request("POST", null))).status).toBe(401);
  });

  it("devolve só a conversa do dono, com contador e mensagens em ordem", async () => {
    const mine = createConversation(db, ana.id, now);
    createConversation(db, carla.id, new Date(now.getTime() + 1000));
    appendUserMessage(db, mine.id, "primeira", now);
    appendMessage(db, { conversationId: mine.id, role: "assistant", content: "segunda" }, now);

    const response = await handlers.getCurrent(await request("GET"));
    const body = (await response.json()) as ConversationDto;
    expect(body.id).toBe(mine.id);
    expect(body.status).toBe("agent");
    expect(body.userMessageCount).toBe(1);
    expect(body.maxUserMessages).toBe(30);
    expect(body.messages.map((message) => message.content)).toEqual(["primeira", "segunda"]);
  });

  it("primeira visita cria uma conversa vazia", async () => {
    const body = (await (await handlers.getCurrent(await request("GET"))).json()) as ConversationDto;
    expect(body.messages).toEqual([]);
    expect(body.status).toBe("agent");
  });

  it("nova conversa fecha a anterior com o agent e zera o contador", async () => {
    const previous = createConversation(db, ana.id, now);
    appendUserMessage(db, previous.id, "oi", now);
    const response = await handlers.create(await request("POST"));
    expect(response.status).toBe(201);
    const body = (await response.json()) as ConversationDto;
    expect(body.id).not.toBe(previous.id);
    expect(body.userMessageCount).toBe(0);
    expect(getOwnedConversation(db, previous.id, ana.id)?.status).toBe("closed");
  });
});
