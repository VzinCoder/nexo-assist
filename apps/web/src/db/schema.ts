import type {
  ChatPart,
  ConversationStatus,
  Decision,
  DraftKind,
  DraftStatus,
  MessageRole,
  TraceStep,
} from "@nexo/shared";
import * as t from "drizzle-orm/sqlite-core";

/** Conversas do funcionário com o agent. Datas em ms (UTC). */
export const conversations = t.sqliteTable(
  "conversations",
  {
    id: t.text().primaryKey(),
    employeeId: t.text().notNull(),
    employeeName: t.text(),
    status: t.text().$type<ConversationStatus>().notNull(),
    handoffReason: t.text(),
    handoffSummary: t.text(),
    analystId: t.text(),
    analystName: t.text(),
    userMessageCount: t.integer().notNull().default(0),
    createdAt: t.integer({ mode: "timestamp_ms" }).notNull(),
    updatedAt: t.integer({ mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    t.index("conversations_employee_created_idx").on(table.employeeId, table.createdAt),
    t.index("conversations_status_updated_idx").on(table.status, table.updatedAt),
  ],
);

/** Mensagens; `parts`, `trace` e `decision` em JSON texto (validados com zod na leitura). */
export const messages = t.sqliteTable(
  "messages",
  {
    id: t.text().primaryKey(),
    conversationId: t
      .text()
      .notNull()
      .references(() => conversations.id),
    role: t.text().$type<MessageRole>().notNull(),
    content: t.text().notNull(),
    parts: t.text({ mode: "json" }).$type<ChatPart[]>().notNull(),
    trace: t.text({ mode: "json" }).$type<TraceStep[]>().notNull(),
    decision: t.text({ mode: "json" }).$type<Decision>(),
    createdAt: t.integer({ mode: "timestamp_ms" }).notNull(),
  },
  (table) => [t.index("messages_conversation_created_idx").on(table.conversationId, table.createdAt)],
);

/** Rascunhos de criação/complemento/reabertura; só viram ação após "Confirmar". */
export const drafts = t.sqliteTable(
  "drafts",
  {
    id: t.text().primaryKey(),
    conversationId: t
      .text()
      .notNull()
      .references(() => conversations.id),
    kind: t.text().$type<DraftKind>().notNull(),
    payload: t.text({ mode: "json" }).$type<unknown>().notNull(),
    status: t.text().$type<DraftStatus>().notNull(),
    ticketId: t.text(),
    createdAt: t.integer({ mode: "timestamp_ms" }).notNull(),
    updatedAt: t.integer({ mode: "timestamp_ms" }).notNull(),
  },
  (table) => [t.index("drafts_conversation_idx").on(table.conversationId)],
);
