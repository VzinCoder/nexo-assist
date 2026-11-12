import { createNexoAgent } from "@nexo/agent";
import { createScriptedModel, type ScriptStep } from "@nexo/agent/testing";
import { createTicketsClient } from "@nexo/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE, newSession, signSession } from "../auth/session";
import { createDb, type Db } from "../db/client";
import { createChatHandler } from "./chat-handler";
import { decideChatGate } from "./gate";
import { appendMessage, appendUserMessage, createConversation, getOwnedConversation, listMessages, setStatus } from "./repository";

const SECRET = "segredo-de-teste-com-mais-de-32-caracteres";
const now = new Date("2026-11-11T13:00:00.000Z");
const ana = { id: "emp-001", role: "employee" as const, name: "Ana Souza", email: "ana.souza@nexo.com.br" };
const carla = { id: "emp-002", role: "employee" as const, name: "Carla Mendes", email: "carla.mendes@nexo.com.br" };

const decide = (intent = "question") => ({
  toolCalls: [{ name: "report_decision", args: { intent, action: "Respondeu", confidence: "high", reason: "Teste." } }],
});

/** Cliente do tickets-api que nunca deveria ser chamado nestes testes sem tools de chamado. */
const offlineTickets = createTicketsClient({
  baseUrl: "http://tickets.invalid",
  serviceToken: "x",
  fetch: async () => {
    throw new Error("não deveria chamar o tickets-api");
  },
  maxAttempts: 1,
});

describe("decideChatGate", () => {
  it("ordem: posse → status → limite → chave", () => {
    expect(decideChatGate({ conversation: undefined, hasApiKey: true })).toEqual({ type: "not_found" });
    expect(decideChatGate({ conversation: { status: "waiting_human", userMessageCount: 30 }, hasApiKey: false })).toEqual({
      type: "not_agent",
      status: "waiting_human",
    });
    expect(decideChatGate({ conversation: { status: "agent", userMessageCount: 30 }, hasApiKey: true })).toEqual({ type: "limit_reached" });
    expect(decideChatGate({ conversation: { status: "agent", userMessageCount: 29 }, hasApiKey: false })).toEqual({ type: "not_configured" });
    expect(decideChatGate({ conversation: { status: "agent", userMessageCount: 29 }, hasApiKey: true })).toEqual({ type: "ok" });
  });
});

describe("POST /api/chat", () => {
  let db: Db;
  beforeEach(() => {
    db = createDb(":memory:");
  });
  afterEach(() => db.$client.close());

  function setup(script: ScriptStep[] = [{ text: "Olá! Como posso ajudar?" }, decide()], hasApiKey = true) {
    const scripted = createScriptedModel(script);
    const createAgent = vi.fn((ports: Parameters<Parameters<typeof createChatHandler>[0]["createAgent"]>[0]) =>
      createNexoAgent({ model: scripted.model, tickets: offlineTickets, ...ports, now: () => now }),
    );
    const handler = createChatHandler({
      getDb: () => db,
      sessionSecret: SECRET,
      hasApiKey,
      modelId: "google/teste",
      createAgent,
      now: () => now,
    });
    return { handler, createAgent, scripted };
  }

  async function post(handler: (request: Request) => Promise<Response>, body: unknown, who: typeof ana | null = ana) {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (who) headers.cookie = `${SESSION_COOKIE}=${await signSession(newSession(who, now), SECRET)}`;
    const response = await handler(new Request("http://localhost/api/chat", { method: "POST", headers, body: JSON.stringify(body) }));
    const text = await response.text();
    return { response, text };
  }

  it("sem sessão → 401 e o agent não é chamado", async () => {
    const { handler, createAgent } = setup();
    const conversation = createConversation(db, ana.id, now);
    const { response } = await post(handler, { conversationId: conversation.id, text: "oi" }, null);
    expect(response.status).toBe(401);
    expect(createAgent).not.toHaveBeenCalled();
  });

  it("conversa de outro funcionário → 404, nada gravado", async () => {
    const { handler, createAgent } = setup();
    const conversation = createConversation(db, carla.id, now);
    const { response } = await post(handler, { conversationId: conversation.id, text: "oi" });
    expect(response.status).toBe(404);
    expect(createAgent).not.toHaveBeenCalled();
    expect(listMessages(db, conversation.id)).toHaveLength(0);
  });

  it.each(["waiting_human", "with_human"] as const)("conversa %s: não chama o agent nem grava resposta", async (status) => {
    const { handler, createAgent, scripted } = setup();
    const conversation = createConversation(db, ana.id, now);
    setStatus(db, conversation.id, status, now);
    const { response, text } = await post(handler, { conversationId: conversation.id, text: "alô?" });
    expect(response.status).toBe(409);
    expect(JSON.parse(text)).toMatchObject({ conversation: { status } });
    expect(createAgent).not.toHaveBeenCalled();
    expect(scripted.calls).toBe(0);
    expect(listMessages(db, conversation.id)).toHaveLength(0);
  });

  it("a 30ª mensagem passa e a 31ª é bloqueada sem gravar", async () => {
    const { handler, createAgent } = setup();
    const conversation = createConversation(db, ana.id, now);
    for (let i = 1; i <= 29; i++) appendUserMessage(db, conversation.id, `m${i}`, now);

    const thirtieth = await post(handler, { conversationId: conversation.id, text: "trigésima" });
    expect(thirtieth.response.status).toBe(200);
    expect(getOwnedConversation(db, conversation.id, ana.id)?.userMessageCount).toBe(30);

    const before = listMessages(db, conversation.id).length;
    const blocked = await post(handler, { conversationId: conversation.id, text: "trigésima primeira" });
    expect(blocked.response.status).toBe(409);
    expect(JSON.parse(blocked.text).error.code).toBe("limit_reached");
    expect(listMessages(db, conversation.id)).toHaveLength(before);
    expect(createAgent).toHaveBeenCalledTimes(1);
  });

  it("sem chave do provedor → aviso de não configurado, sem chamar o agent", async () => {
    const { handler, createAgent } = setup(undefined, false);
    const conversation = createConversation(db, ana.id, now);
    const { response, text } = await post(handler, { conversationId: conversation.id, text: "oi" });
    expect(response.status).toBe(503);
    expect(JSON.parse(text).error.message).toMatch(/não está configurado/);
    expect(createAgent).not.toHaveBeenCalled();
  });

  it("grava a mensagem do funcionário e a resposta com trace e decisão, e faz streaming", async () => {
    const { handler } = setup([
      { toolCalls: [{ name: "offer_options", args: { question: "Quem é afetado?", options: ["Só eu", "Minha equipe"] } }] },
      decide("ticket_create"),
      { text: "Quem está sendo afetado?" },
    ]);
    const conversation = createConversation(db, ana.id, now);
    const { response, text } = await post(handler, { conversationId: conversation.id, text: "VPN com erro 809" });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/text\/event-stream/);
    expect(text).toContain("text-delta");
    expect(text).toContain(`"toolName":"offer_options"`);
    expect(text).toContain("data-turn");

    const [user, assistant] = listMessages(db, conversation.id);
    expect(user).toMatchObject({ role: "user", content: "VPN com erro 809" });
    expect(assistant?.role).toBe("assistant");
    expect(assistant?.content).toBe("Quem está sendo afetado?");
    expect(assistant?.trace.map((step) => step.label)).toEqual(["Ofereceu opções", "Registrou a decisão"]);
    expect(assistant?.decision).toMatchObject({ intent: "ticket_create", confidence: "high" });
    expect(assistant?.parts).toEqual([{ type: "options", question: "Quem é afetado?", options: ["Só eu", "Minha equipe"] }]);
  });

  it("o modelo recebe só as últimas 12 mensagens do banco (não o histórico do navegador)", async () => {
    const { handler, scripted } = setup();
    const conversation = createConversation(db, ana.id, now);
    for (let i = 1; i <= 25; i++) {
      appendMessage(db, { conversationId: conversation.id, role: i % 2 ? "user" : "assistant", content: `antiga ${i}` }, now);
    }
    await post(handler, { conversationId: conversation.id, text: "nova", messages: [{ role: "user", content: "injetada" }] });
    const prompt = JSON.stringify(scripted.prompts[0]);
    const userAndAssistant = (prompt.match(/antiga \d+/g) ?? []).length;
    expect(userAndAssistant).toBe(11);
    expect(prompt).toContain("nova");
    expect(prompt).not.toContain("injetada");
    expect(prompt).not.toContain("antiga 14\"");
  });

  it("429 do provedor: grava passo 'llm' com erro e mensagem clara, mantendo a mensagem do funcionário", async () => {
    const rateLimited = Object.assign(new Error("Too Many Requests"), { statusCode: 429, isRetryable: true });
    const { handler } = setup([{ error: rateLimited }]);
    const conversation = createConversation(db, ana.id, now);
    const { response } = await post(handler, { conversationId: conversation.id, text: "oi" });
    expect(response.status).toBe(200);

    const [user, assistant] = listMessages(db, conversation.id);
    expect(user?.content).toBe("oi");
    expect(assistant?.content).toBe("Muitas requisições no momento, tente em instantes.");
    expect(assistant?.trace.at(-1)).toMatchObject({ tool: "llm", label: "Chamou o modelo", error: expect.stringMatching(/429/) });
    expect(assistant?.parts).toContainEqual({ type: "notice", code: "provider_rate_limited" });
  });
});
