import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDb, type Db } from "../db/client";
import {
  appendMessage,
  appendUserMessage,
  claimDraft,
  createConversation,
  discardDraft,
  finishDraft,
  getCurrentConversation,
  getOrCreateCurrentConversation,
  getOwnedConversation,
  getOwnedDraft,
  insertDraft,
  lastMessages,
  listDraftViews,
  listMessages,
  releaseDraft,
  setStatus,
} from "./repository";

const A = "emp-001";
const B = "emp-002";
const t0 = new Date("2026-11-11T13:00:00.000Z");
const at = (minutes: number) => new Date(t0.getTime() + minutes * 60_000);

describe("repositório do chat", () => {
  let db: Db;
  beforeEach(() => {
    db = createDb(":memory:");
  });
  afterEach(() => db.$client.close());

  it("retoma a última conversa não encerrada", () => {
    const first = createConversation(db, A, at(0));
    expect(getCurrentConversation(db, A)?.id).toBe(first.id);
    setStatus(db, first.id, "waiting_human", at(1));
    const second = createConversation(db, A, at(2));
    expect(getCurrentConversation(db, A)?.id).toBe(second.id);
    expect(getCurrentConversation(db, B)).toBeUndefined();
    expect(getOrCreateCurrentConversation(db, A, at(3)).id).toBe(second.id);
  });

  it("nova conversa fecha a anterior com o agent e preserva a que aguarda analista", () => {
    const withAgent = createConversation(db, A, at(0));
    const next = createConversation(db, A, at(1));
    expect(getOwnedConversation(db, withAgent.id, A)?.status).toBe("closed");

    setStatus(db, next.id, "waiting_human", at(2), { reason: "pedido", summary: "resumo" });
    createConversation(db, A, at(3));
    const waiting = getOwnedConversation(db, next.id, A);
    expect(waiting?.status).toBe("waiting_human");
    expect(waiting?.handoffReason).toBe("pedido");
  });

  it("isola por funcionário", () => {
    const conversation = createConversation(db, A, at(0));
    expect(getOwnedConversation(db, conversation.id, B)).toBeUndefined();
    const draft = insertDraft(db, { conversationId: conversation.id, kind: "comment", payload: {} }, at(0));
    expect(getOwnedDraft(db, draft.id, B)).toBeUndefined();
    expect(getOwnedDraft(db, draft.id, A)?.draft.id).toBe(draft.id);
  });

  it("conta mensagens do funcionário e recusa a 31ª sem gravar", () => {
    const conversation = createConversation(db, A, at(0));
    for (let i = 1; i <= 30; i++) {
      const result = appendUserMessage(db, conversation.id, `msg ${i}`, at(i));
      expect(result?.userMessageCount).toBe(i);
    }
    expect(appendUserMessage(db, conversation.id, "msg 31", at(31))).toBeNull();
    expect(listMessages(db, conversation.id)).toHaveLength(30);
    expect(getOwnedConversation(db, conversation.id, A)?.userMessageCount).toBe(30);
  });

  it("lastMessages devolve só as últimas N em ordem cronológica", () => {
    const conversation = createConversation(db, A, at(0));
    for (let i = 1; i <= 25; i++) {
      appendMessage(
        db,
        { conversationId: conversation.id, role: i % 2 === 1 ? "user" : "assistant", content: `m${i}` },
        at(i),
      );
    }
    const last = lastMessages(db, conversation.id, 12);
    expect(last.map((m) => m.content)).toEqual(Array.from({ length: 12 }, (_, i) => `m${i + 14}`));
  });

  it("mantém a ordem mesmo com mensagens no mesmo milissegundo", () => {
    const conversation = createConversation(db, A, at(0));
    appendUserMessage(db, conversation.id, "primeira", at(1));
    appendMessage(db, { conversationId: conversation.id, role: "assistant", content: "segunda" }, at(1));
    appendMessage(db, { conversationId: conversation.id, role: "system", content: "terceira" }, at(1));
    expect(listMessages(db, conversation.id).map((m) => m.content)).toEqual([
      "primeira",
      "segunda",
      "terceira",
    ]);
  });

  it("grava e lê trace, decisão e partes", () => {
    const conversation = createConversation(db, A, at(0));
    appendMessage(
      db,
      {
        conversationId: conversation.id,
        role: "assistant",
        content: "ok",
        parts: [{ type: "options", question: "Quem?", options: ["Só eu", "Minha equipe"] }],
        trace: [{ tool: "offer_options", label: "Ofereceu opções", input: {}, output: {}, durationMs: 1 }],
        decision: { intent: "ticket_create", action: "Perguntou", confidence: "medium", reason: "Falta dado." },
      },
      at(1),
    );
    const [message] = listMessages(db, conversation.id);
    expect(message?.parts[0]).toMatchObject({ type: "options" });
    expect(message?.trace).toHaveLength(1);
    expect(message?.decision?.intent).toBe("ticket_create");
  });

  it("claimDraft concorrente só vence uma vez; release volta para pending", async () => {
    const conversation = createConversation(db, A, at(0));
    const draft = insertDraft(
      db,
      {
        conversationId: conversation.id,
        kind: "comment",
        payload: { ticketId: "INC-20311", ticketTitle: "x", text: "y" },
      },
      at(0),
    );
    const results = await Promise.all([
      Promise.resolve().then(() => claimDraft(db, draft.id, at(1))),
      Promise.resolve().then(() => claimDraft(db, draft.id, at(1))),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);

    releaseDraft(db, draft.id, at(2));
    expect(claimDraft(db, draft.id, at(3))).toBe(true);
    finishDraft(db, draft.id, "INC-20311", at(4));
    expect(claimDraft(db, draft.id, at(5))).toBe(false);
    expect(discardDraft(db, draft.id, at(5))).toBe(false);
    expect(listDraftViews(db, conversation.id)[0]).toMatchObject({
      status: "confirmed",
      ticketId: "INC-20311",
    });
  });
});
