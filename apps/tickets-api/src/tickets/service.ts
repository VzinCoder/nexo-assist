import {
  REOPEN_WINDOW_HOURS,
  TICKET_STATUS_LABELS,
  computeDueAt,
  isFinished,
  isReopenable,
  type CreateTicketBody,
  type EscalateBody,
  type SimilarTicket,
  type Ticket,
} from "@nexo/shared";
import type { Db } from "../db/client";
import type { TicketRow } from "../db/schema";
import { AppError } from "../plugins/errors";
import { rankByKeywords } from "../search/keywords";
import {
  findTicket,
  insertComment,
  insertTicket,
  listComments,
  listTickets,
  nextTicketId,
  updateTicket,
  type Executor,
} from "./repository";
import { toTicket, toTicketSummary } from "./serialize";

/** Mesmo erro para inexistente e para chamado de outro funcionário. */
export const ticketNotFound = () => new AppError("not_found", "Chamado não encontrado.");

/** Busca o chamado do dono dentro da transação ou lança 404. */
function requireTicket(tx: Executor, employeeId: string, id: string): TicketRow {
  const row = findTicket(tx, employeeId, id);
  if (!row) throw ticketNotFound();
  return row;
}

/** Toda atualização renova `updatedAt` e recalcula o prazo a partir dele. */
function touch(row: TicketRow, now: Date) {
  return { updatedAt: now, dueAt: computeDueAt(row.priority, now) };
}

/** Complemento do funcionário em chamado ativo; resolvido/fechado → 409 sugerindo reabrir. */
export function addComment(db: Db, employeeId: string, id: string, text: string, now: Date): Ticket {
  db.transaction((tx) => {
    const row = requireTicket(tx, employeeId, id);
    if (isFinished(row.status)) {
      throw new AppError(
        "conflict",
        `O chamado ${id} está ${TICKET_STATUS_LABELS[row.status].toLowerCase()} e não recebe ` +
          "complementos. Reabra o chamado (até 7 dias após a resolução) ou abra um novo.",
      );
    }
    insertComment(tx, { ticketId: id, authorId: employeeId, kind: "comment", text, createdAt: now });
    updateTicket(tx, employeeId, id, touch(row, now));
  });
  return readTicket(db, employeeId, id, now);
}

/** Reabre chamado resolvido há no máximo 7 dias; fora disso → 409 sem alterar nada. */
export function reopenTicket(
  db: Db,
  employeeId: string,
  id: string,
  comment: string | undefined,
  now: Date,
): Ticket {
  db.transaction((tx) => {
    const row = requireTicket(tx, employeeId, id);
    if (row.status !== "resolved") {
      throw new AppError(
        "conflict",
        `Só chamados resolvidos podem ser reabertos; o ${id} está ` +
          `${TICKET_STATUS_LABELS[row.status].toLowerCase()}.`,
      );
    }
    if (!isReopenable(row, now)) {
      throw new AppError(
        "conflict",
        `O chamado ${id} foi resolvido há mais de ${REOPEN_WINDOW_HOURS / 24} dias e não pode ser ` +
          "reaberto. Abra um novo chamado.",
      );
    }
    insertComment(tx, {
      ticketId: id,
      authorId: employeeId,
      kind: "reopen",
      text: comment && comment.length > 0 ? comment : "Chamado reaberto pelo funcionário.",
      createdAt: now,
    });
    updateTicket(tx, employeeId, id, { status: "open", resolvedAt: null, ...touch(row, now) });
  });
  return readTicket(db, employeeId, id, now);
}

/** Transfere para analista (`waiting_analyst`) registrando motivo e resumo. */
export function escalateTicket(
  db: Db,
  employeeId: string,
  id: string,
  body: EscalateBody,
  now: Date,
): Ticket {
  db.transaction((tx) => {
    const row = requireTicket(tx, employeeId, id);
    if (isFinished(row.status)) {
      throw new AppError(
        "conflict",
        `O chamado ${id} está ${TICKET_STATUS_LABELS[row.status].toLowerCase()} e não pode ser ` +
          "transferido. Reabra o chamado ou abra um novo.",
      );
    }
    insertComment(tx, {
      ticketId: id,
      authorId: employeeId,
      kind: "escalation",
      text: `Motivo: ${body.reason}\nResumo: ${body.summary}`,
      createdAt: now,
    });
    updateTicket(tx, employeeId, id, { status: "waiting_analyst", ...touch(row, now) });
  });
  return readTicket(db, employeeId, id, now);
}

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
