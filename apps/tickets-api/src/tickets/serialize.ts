import { isOverdue, type Ticket, type TicketSummary } from "@nexo/shared";
import type { TicketRow } from "../db/schema";
import type { CommentWithAuthor } from "./repository";

/** Linha do banco → DTO, com datas ISO e `isOverdue` calculado no instante da resposta. */
export function toTicketSummary(row: TicketRow, now: Date): TicketSummary {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    category: row.category,
    priority: row.priority,
    status: row.status,
    affected: row.affected,
    employeeId: row.employeeId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null,
    dueAt: row.dueAt.toISOString(),
    isOverdue: isOverdue(row, now),
  };
}

export function toTicket(row: TicketRow, comments: CommentWithAuthor[], now: Date): Ticket {
  return {
    ...toTicketSummary(row, now),
    comments: comments.map((comment) => ({
      ...comment,
      createdAt: comment.createdAt.toISOString(),
    })),
  };
}
