import {
  computeDueAt,
  isFinished,
  isReopenable,
  type CreateTicketBody,
  type SimilarTicket,
  type Ticket,
} from "@nexo/shared";
import type { Db } from "../db/client";
import { rankByKeywords } from "../search/keywords";
import { findTicket, insertTicket, listComments, listTickets, nextTicketId } from "./repository";
import { toTicket, toTicketSummary } from "./serialize";

/** Lê o chamado completo (com comentários) já serializado. Assume que ele existe para o dono. */
function readTicket(db: Db, employeeId: string, id: string, now: Date): Ticket {
  const row = findTicket(db, employeeId, id);
  if (!row) throw new Error(`Chamado ${id} sumiu durante a operação.`);
  return toTicket(row, listComments(db, employeeId, id), now);
}

export const SIMILAR_LIMIT = 5;

/**
 * Chamados do funcionário parecidos com o texto: ativos ou resolvidos dentro da janela de
 * reabertura, com ao menos uma palavra significativa em comum, do mais para o menos parecido.
 */
export function findSimilarTickets(
  db: Db,
  employeeId: string,
  text: string,
  now: Date,
): SimilarTicket[] {
  const candidates = listTickets(db, employeeId).filter(
    (row) => !isFinished(row.status) || isReopenable(row, now),
  );
  return rankByKeywords(
    candidates,
    text,
    (row) => `${row.title} ${row.description}`,
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
  )
    .slice(0, SIMILAR_LIMIT)
    .map(({ item }) => ({ ...toTicketSummary(item, now), reopenable: isReopenable(item, now) }));
}

/** Cria o chamado `open` do funcionário com id sequencial do tipo e prazo pela prioridade. */
export function createTicket(db: Db, employeeId: string, body: CreateTicketBody, now: Date): Ticket {
  const id = db.transaction((tx) => {
    const ticketId = nextTicketId(tx, body.type);
    insertTicket(tx, {
      id: ticketId,
      ...body,
      status: "open",
      employeeId,
      createdAt: now,
      updatedAt: now,
      resolvedAt: null,
      dueAt: computeDueAt(body.priority, now),
    });
    return ticketId;
  });
  return readTicket(db, employeeId, id, now);
}
