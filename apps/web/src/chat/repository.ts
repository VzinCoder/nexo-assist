import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import {
  MAX_USER_MESSAGES,
  chatPartListSchema,
  decisionSchema,
  draftViewSchema,
  traceStepSchema,
  type ChatPart,
  type ConversationStatus,
  type Decision,
  type DraftKind,
  type DraftView,
  type MessageRole,
  type TraceStep,
} from "@nexo/shared";
import { z } from "zod";
import type { Db } from "../db/client";
import { conversations, drafts, messages } from "../db/schema";

export type Conversation = typeof conversations.$inferSelect;

export type ChatMessage = {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  parts: ChatPart[];
  trace: TraceStep[];
  decision: Decision | null;
  createdAt: Date;
};

export type NewMessage = {
  conversationId: string;
  role: MessageRole;
  content: string;
  parts?: ChatPart[];
  trace?: TraceStep[];
  decision?: Decision | null;
};

type DraftRow = typeof drafts.$inferSelect;

const traceListSchema = z.array(traceStepSchema);

/** Converte a linha do banco validando os campos JSON; dado corrompido vira vazio, não quebra a tela. */
function toMessage(row: typeof messages.$inferSelect): ChatMessage {
  const parts = chatPartListSchema.safeParse(row.parts);
  const trace = traceListSchema.safeParse(row.trace);
  const decision = row.decision === null ? null : decisionSchema.safeParse(row.decision);
  return {
    id: row.id,
    conversationId: row.conversationId,
    role: row.role,
    content: row.content,
    parts: parts.success ? parts.data : [],
    trace: trace.success ? trace.data : [],
    decision: decision?.success ? decision.data : null,
    createdAt: row.createdAt,
  };
}

/** Conversa mais recente não encerrada do funcionário. */
export function getCurrentConversation(db: Db, employeeId: string): Conversation | undefined {
  return db
    .select()
    .from(conversations)
    .where(and(eq(conversations.employeeId, employeeId), ne(conversations.status, "closed")))
    .orderBy(desc(conversations.createdAt), desc(sql`rowid`))
    .limit(1)
    .get();
}

/**
 * Cria uma nova conversa `agent`. A atual é encerrada só se estiver com o agent; se estiver com
 * analista (ou aguardando), fica como está.
 */
export function createConversation(
  db: Db,
  employeeId: string,
  now: Date,
  employeeName: string | null = null,
): Conversation {
  return db.transaction((tx) => {
    tx.update(conversations)
      .set({ status: "closed", updatedAt: now })
      .where(and(eq(conversations.employeeId, employeeId), eq(conversations.status, "agent")))
      .run();
    const row: Conversation = {
      id: randomUUID(),
      employeeId,
      employeeName,
      status: "agent",
      handoffReason: null,
      handoffSummary: null,
      analystId: null,
      analystName: null,
      userMessageCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    tx.insert(conversations).values(row).run();
    return row;
  });
}

/** Conversa atual ou, se não houver, uma nova. */
export function getOrCreateCurrentConversation(
  db: Db,
  employeeId: string,
  now: Date,
  employeeName: string | null = null,
): Conversation {
  return getCurrentConversation(db, employeeId) ?? createConversation(db, employeeId, now, employeeName);
}

/** Conversa só se pertencer ao funcionário; senão `undefined` (a rota responde 404). */
export function getOwnedConversation(
  db: Db,
  conversationId: string,
  employeeId: string,
): Conversation | undefined {
  return db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.employeeId, employeeId)))
    .get();
}

/** Grava a mensagem nova sempre depois das existentes (o `createdAt` nunca volta no tempo). */
export function insertMessage(tx: Pick<Db, "insert" | "select">, input: NewMessage, now: Date): ChatMessage {
  const last = tx
    .select({ createdAt: messages.createdAt })
    .from(messages)
    .where(eq(messages.conversationId, input.conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(1)
    .get();
  const createdAt =
    last && last.createdAt.getTime() >= now.getTime() ? new Date(last.createdAt.getTime() + 1) : now;
  const row = {
    id: randomUUID(),
    conversationId: input.conversationId,
    role: input.role,
    content: input.content,
    parts: input.parts ?? [],
    trace: input.trace ?? [],
    decision: input.decision ?? null,
    createdAt,
  };
  tx.insert(messages).values(row).run();
  return row;
}

/**
 * Grava a mensagem do funcionário e incrementa o contador na mesma transação. Devolve `null`
 * (sem gravar nada) se a conversa já atingiu o limite de mensagens ou não está em `requireStatus`.
 */
export function appendUserMessage(
  db: Db,
  conversationId: string,
  content: string,
  now: Date,
  requireStatus?: ConversationStatus,
): { message: ChatMessage; userMessageCount: number } | null {
  return db.transaction((tx) => {
    const result = tx
      .update(conversations)
      .set({ userMessageCount: sql`${conversations.userMessageCount} + 1`, updatedAt: now })
      .where(
        and(
          eq(conversations.id, conversationId),
          sql`${conversations.userMessageCount} < ${MAX_USER_MESSAGES}`,
          requireStatus ? eq(conversations.status, requireStatus) : undefined,
        ),
      )
      .run();
    if (result.changes === 0) return null;
    const message = insertMessage(tx, { conversationId, role: "user", content }, now);
    const row = tx
      .select({ count: conversations.userMessageCount })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .get();
    return { message, userMessageCount: row?.count ?? 0 };
  });
}

export function appendMessage(db: Db, input: NewMessage, now: Date): ChatMessage {
  return db.transaction((tx) => {
    const message = insertMessage(tx, input, now);
    tx.update(conversations)
      .set({ updatedAt: now })
      .where(eq(conversations.id, input.conversationId))
      .run();
    return message;
  });
}

/** Todas as mensagens em ordem cronológica. */
export function listMessages(db: Db, conversationId: string): ChatMessage[] {
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(asc(messages.createdAt), asc(sql`rowid`))
    .all()
    .map(toMessage);
}

/** Últimas `limit` mensagens em ordem cronológica (contexto enviado ao modelo). */
export function lastMessages(db: Db, conversationId: string, limit: number): ChatMessage[] {
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt), desc(sql`rowid`))
    .limit(limit)
    .all()
    .reverse()
    .map(toMessage);
}

export function setStatus(
  db: Db,
  conversationId: string,
  status: ConversationStatus,
  now: Date,
  handoff?: { reason: string; summary: string },
): void {
  db.update(conversations)
    .set({
      status,
      updatedAt: now,
      ...(handoff ? { handoffReason: handoff.reason, handoffSummary: handoff.summary } : {}),
    })
    .where(eq(conversations.id, conversationId))
    .run();
}

// ---------------------------------------------------------------- rascunhos

export function insertDraft(
  db: Db,
  input: { conversationId: string; kind: DraftKind; payload: unknown },
  now: Date,
): DraftRow {
  const row: DraftRow = {
    id: randomUUID(),
    conversationId: input.conversationId,
    kind: input.kind,
    payload: input.payload,
    status: "pending",
    ticketId: null,
    createdAt: now,
    updatedAt: now,
  };
  db.insert(drafts).values(row).run();
  return row;
}

export type OwnedDraft = { draft: DraftRow; conversation: Conversation };

/** Rascunho só se a conversa dele pertencer ao funcionário. */
export function getOwnedDraft(db: Db, draftId: string, employeeId: string): OwnedDraft | undefined {
  const row = db
    .select({ draft: drafts, conversation: conversations })
    .from(drafts)
    .innerJoin(conversations, eq(drafts.conversationId, conversations.id))
    .where(and(eq(drafts.id, draftId), eq(conversations.employeeId, employeeId)))
    .get();
  return row ?? undefined;
}

/** Transição atômica `pending → confirming`; só um chamador vence. */
export function claimDraft(db: Db, draftId: string, now: Date): boolean {
  const result = db
    .update(drafts)
    .set({ status: "confirming", updatedAt: now })
    .where(and(eq(drafts.id, draftId), eq(drafts.status, "pending")))
    .run();
  return result.changes === 1;
}

/** `confirming → confirmed` com o id do chamado resultante. */
export function finishDraft(db: Db, draftId: string, ticketId: string, now: Date): void {
  db.update(drafts)
    .set({ status: "confirmed", ticketId, updatedAt: now })
    .where(and(eq(drafts.id, draftId), eq(drafts.status, "confirming")))
    .run();
}

/** Falha ao confirmar: `confirming → pending`, para poder tentar de novo. */
export function releaseDraft(db: Db, draftId: string, now: Date): void {
  db.update(drafts)
    .set({ status: "pending", updatedAt: now })
    .where(and(eq(drafts.id, draftId), eq(drafts.status, "confirming")))
    .run();
}

/** `pending → discarded`; `false` se o rascunho não estava pendente. */
export function discardDraft(db: Db, draftId: string, now: Date): boolean {
  const result = db
    .update(drafts)
    .set({ status: "discarded", updatedAt: now })
    .where(and(eq(drafts.id, draftId), eq(drafts.status, "pending")))
    .run();
  return result.changes === 1;
}

/** Rascunhos da conversa em formato de exibição (inválidos são ignorados). */
export function listDraftViews(db: Db, conversationId: string): DraftView[] {
  return db
    .select()
    .from(drafts)
    .where(eq(drafts.conversationId, conversationId))
    .all()
    .flatMap((row) => {
      const view = toDraftView(row);
      return view ? [view] : [];
    });
}

export function toDraftView(row: DraftRow): DraftView | null {
  const parsed = draftViewSchema.safeParse({
    id: row.id,
    kind: row.kind,
    payload: row.payload,
    status: row.status,
    ticketId: row.ticketId,
  });
  return parsed.success ? parsed.data : null;
}
