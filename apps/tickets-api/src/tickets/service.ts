import { computeDueAt, type CreateTicketBody, type Ticket } from "@nexo/shared";
import type { Db } from "../db/client";
import { insertTicket, listComments, nextTicketId, findTicket } from "./repository";
import { toTicket } from "./serialize";

/** Lê o chamado completo (com comentários) já serializado. Assume que ele existe para o dono. */
function readTicket(db: Db, employeeId: string, id: string, now: Date): Ticket {
  const row = findTicket(db, employeeId, id);
  if (!row) throw new Error(`Chamado ${id} sumiu durante a operação.`);
  return toTicket(row, listComments(db, employeeId, id), now);
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
