import type {
  CommentKind,
  EmployeeRole,
  TicketAffected,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  TicketType,
} from "@nexo/shared";
import * as t from "drizzle-orm/sqlite-core";

/** Funcionários e analistas. `email` é guardado em minúsculas. */
export const employees = t.sqliteTable("employees", {
  id: t.text().primaryKey(),
  name: t.text().notNull(),
  email: t.text().notNull().unique(),
  department: t.text().notNull(),
  role: t.text().$type<EmployeeRole>().notNull(),
});

/** Artigos da central de ajuda; `tags` em texto JSON. */
export const articles = t.sqliteTable("articles", {
  id: t.text().primaryKey(),
  title: t.text().notNull(),
  content: t.text().notNull(),
  tags: t.text({ mode: "json" }).$type<string[]>().notNull(),
});

/** Chamados. Datas em ms (UTC). `dueAt` é recalculado em toda escrita; `isOverdue` nunca é salvo. */
export const tickets = t.sqliteTable(
  "tickets",
  {
    id: t.text().primaryKey(),
    type: t.text().$type<TicketType>().notNull(),
    title: t.text().notNull(),
    description: t.text().notNull(),
    category: t.text().$type<TicketCategory>().notNull(),
    priority: t.text().$type<TicketPriority>().notNull(),
    status: t.text().$type<TicketStatus>().notNull(),
    affected: t.text().$type<TicketAffected>().notNull(),
    employeeId: t
      .text("employee_id")
      .notNull()
      .references(() => employees.id),
    createdAt: t.integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: t.integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    resolvedAt: t.integer("resolved_at", { mode: "timestamp_ms" }),
    dueAt: t.integer("due_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [t.index("tickets_employee_id_idx").on(table.employeeId)],
);

export const ticketComments = t.sqliteTable(
  "ticket_comments",
  {
    id: t.integer().primaryKey({ autoIncrement: true }),
    ticketId: t
      .text("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    authorId: t
      .text("author_id")
      .notNull()
      .references(() => employees.id),
    kind: t.text().$type<CommentKind>().notNull(),
    text: t.text().notNull(),
    createdAt: t.integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [t.index("ticket_comments_ticket_id_idx").on(table.ticketId)],
);

export type EmployeeRow = typeof employees.$inferSelect;
export type ArticleRow = typeof articles.$inferSelect;
export type TicketRow = typeof tickets.$inferSelect;
export type NewTicketRow = typeof tickets.$inferInsert;
export type TicketCommentRow = typeof ticketComments.$inferSelect;
export type NewTicketCommentRow = typeof ticketComments.$inferInsert;
