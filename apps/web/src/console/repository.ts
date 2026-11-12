import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { ConversationStatus, MessageRole } from "@nexo/shared";
import type { Db } from "../db/client";
import { conversations, messages } from "../db/schema";
import { insertMessage, type ChatMessage, type Conversation } from "../chat/repository";
import { TRANSITIONS, transitionMessage, type ConsoleAction } from "./transitions";

export type ConsoleListItem = {
  conversation: Conversation;
  lastMessage: { role: MessageRole; content: string; createdAt: Date } | null;
};

const LIST_LIMIT = 100;

/** Conversas nos status pedidos, mais recentes primeiro, com a última mensagem. */
export function listConsoleConversations(db: Db, statuses: readonly ConversationStatus[]): ConsoleListItem[] {
  if (statuses.length === 0) return [];
  const rows = db
    .select()
    .from(conversations)
    .where(inArray(conversations.status, [...statuses]))
    .orderBy(desc(conversations.updatedAt))
    .limit(LIST_LIMIT)
    .all();
  return rows.map((conversation) => {
    const last = db
      .select({ role: messages.role, content: messages.content, createdAt: messages.createdAt })
      .from(messages)
      .where(eq(messages.conversationId, conversation.id))
      .orderBy(desc(messages.createdAt), desc(sql`rowid`))
      .limit(1)
      .get();
    return { conversation, lastMessage: last ?? null };
  });
}

export function getConversation(db: Db, conversationId: string): Conversation | undefined {
  return db.select().from(conversations).where(eq(conversations.id, conversationId)).get();
}

export type Analyst = { id: string; name: string };

export type TransitionResult =
  | { ok: true; conversation: Conversation; message: ChatMessage }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "invalid_transition"; status: ConversationStatus };

/**
 * Aplica a ação de forma atômica (o `UPDATE ... WHERE status IN (from)` só vence uma vez) e grava a
 * mensagem `system` da transição na mesma transação.
 */
export function applyConsoleAction(
  db: Db,
  conversationId: string,
  action: ConsoleAction,
  analyst: Analyst,
  now: Date,
): TransitionResult {
  return db.transaction((tx) => {
    const rule = TRANSITIONS[action];
    const assignment =
      action === "assume"
        ? { analystId: analyst.id, analystName: analyst.name }
        : action === "return"
          ? { analystId: null, analystName: null }
          : {};
    const result = tx
      .update(conversations)
      .set({ status: rule.to, updatedAt: now, ...assignment })
      .where(and(eq(conversations.id, conversationId), inArray(conversations.status, [...rule.from])))
      .run();
    const current = tx.select().from(conversations).where(eq(conversations.id, conversationId)).get();
    if (!current) return { ok: false, reason: "not_found" } as const;
    if (result.changes === 0) return { ok: false, reason: "invalid_transition", status: current.status } as const;
    const message = insertMessage(
      tx,
      { conversationId, role: "system", content: transitionMessage(action, analyst.name) },
      now,
    );
    return { ok: true, conversation: current, message } as const;
  });
}

export type AnalystMessageResult =
  | { ok: true; message: ChatMessage }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "invalid_status"; status: ConversationStatus };

/** Mensagem do analista; só grava se a conversa estiver `with_human` (checado na transação). */
export function appendAnalystMessage(db: Db, conversationId: string, content: string, now: Date): AnalystMessageResult {
  return db.transaction((tx) => {
    const result = tx
      .update(conversations)
      .set({ updatedAt: now })
      .where(and(eq(conversations.id, conversationId), eq(conversations.status, "with_human")))
      .run();
    if (result.changes === 0) {
      const current = tx.select().from(conversations).where(eq(conversations.id, conversationId)).get();
      if (!current) return { ok: false, reason: "not_found" } as const;
      return { ok: false, reason: "invalid_status", status: current.status } as const;
    }
    return { ok: true, message: insertMessage(tx, { conversationId, role: "analyst", content }, now) } as const;
  });
}
