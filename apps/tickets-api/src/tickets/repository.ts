import type { TicketStatus, TicketType } from "@nexo/shared";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import {
  employees,
  ticketComments,
  tickets,
  type NewTicketCommentRow,
  type NewTicketRow,
  type TicketRow,
} from "../db/schema";

/**
 * Acesso a chamados. Toda função recebe `employeeId` e o inclui no `WHERE`: não existe busca de
 * chamado só por id, então o chamado de outro funcionário é indistinguível de um inexistente.
 * A única exceção é `nextTicketId`, que olha a sequência global do tipo sem devolver chamados.
 */

/** Transação síncrona do driver ou o próprio banco (mesma API de consulta). */
type Executor = Pick<Db, "select" | "insert" | "update">;

export type CommentWithAuthor = {
  id: number;
  authorId: string;
  authorName: string;
  kind: NewTicketCommentRow["kind"];
  text: string;
  createdAt: Date;
};

export function listTickets(
  db: Executor,
  employeeId: string,
  status?: TicketStatus,
): TicketRow[] {
  const where = status
    ? and(eq(tickets.employeeId, employeeId), eq(tickets.status, status))
    : eq(tickets.employeeId, employeeId);
  return db
    .select()
    .from(tickets)
    .where(where)
    .orderBy(desc(tickets.updatedAt), desc(tickets.id))
    .all();
}

export function findTicket(db: Executor, employeeId: string, id: string): TicketRow | undefined {
  return db
    .select()
    .from(tickets)
    .where(and(eq(tickets.id, id), eq(tickets.employeeId, employeeId)))
    .get();
}

/** Comentários em ordem cronológica, só se o chamado for do funcionário. */
export function listComments(db: Executor, employeeId: string, id: string): CommentWithAuthor[] {
  return db
    .select({
      id: ticketComments.id,
      authorId: ticketComments.authorId,
      authorName: employees.name,
      kind: ticketComments.kind,
      text: ticketComments.text,
      createdAt: ticketComments.createdAt,
    })
    .from(ticketComments)
    .innerJoin(tickets, eq(tickets.id, ticketComments.ticketId))
    .innerJoin(employees, eq(employees.id, ticketComments.authorId))
    .where(and(eq(ticketComments.ticketId, id), eq(tickets.employeeId, employeeId)))
    .orderBy(asc(ticketComments.createdAt), asc(ticketComments.id))
    .all();
}

/**
 * Próximo id do tipo, considerando os chamados de todos os funcionários: maior número + 1, com
 * 5 dígitos. Chamar dentro da mesma transação da inserção.
 */
export function nextTicketId(db: Executor, type: TicketType): string {
  const row = db
    .select({ max: sql<number | null>`max(cast(substr(${tickets.id}, 5) as integer))` })
    .from(tickets)
    .where(eq(tickets.type, type))
    .get();
  const next = (row?.max ?? 0) + 1;
  return `${type}-${String(next).padStart(5, "0")}`;
}

export function insertTicket(db: Executor, ticket: NewTicketRow): void {
  db.insert(tickets).values(ticket).run();
}

export function insertComment(db: Executor, comment: Omit<NewTicketCommentRow, "id">): void {
  db.insert(ticketComments).values(comment).run();
}

/** Atualiza campos do chamado, sempre restrito ao dono. */
export function updateTicket(
  db: Executor,
  employeeId: string,
  id: string,
  patch: Partial<Pick<TicketRow, "status" | "updatedAt" | "dueAt" | "resolvedAt">>,
): void {
  db.update(tickets)
    .set(patch)
    .where(and(eq(tickets.id, id), eq(tickets.employeeId, employeeId)))
    .run();
}
