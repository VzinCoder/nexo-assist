import type { TicketStatus } from "../schemas/ticket";

/** Janela de reabertura: 7 dias corridos (168 h) após a resolução. */
export const REOPEN_WINDOW_HOURS = 7 * 24;
const REOPEN_WINDOW_MS = REOPEN_WINDOW_HOURS * 60 * 60 * 1000;

/**
 * Reabrível somente se `resolved` e resolvido há no máximo 168 h. `closed` nunca reabre.
 * Aceita `Date` (linha do banco) ou ISO string (DTO).
 */
export function isReopenable(
  ticket: { status: TicketStatus; resolvedAt: Date | string | null },
  now: Date,
): boolean {
  if (ticket.status !== "resolved" || ticket.resolvedAt === null) return false;
  const elapsed = now.getTime() - new Date(ticket.resolvedAt).getTime();
  return elapsed <= REOPEN_WINDOW_MS;
}
