import type { TicketPriority, TicketStatus } from "../schemas/ticket";
import { BUSINESS_HOURS_PER_DAY, addBusinessHours } from "./business-hours";

const HOUR_MS = 60 * 60 * 1000;

/** Prazo por prioridade. Crítica conta horas corridas; as demais, horas úteis. */
export const SLA_BY_PRIORITY: Record<TicketPriority, { hours: number; businessHours: boolean }> = {
  critical: { hours: 1, businessHours: false },
  high: { hours: 4, businessHours: true },
  medium: { hours: 3 * BUSINESS_HOURS_PER_DAY, businessHours: true },
  low: { hours: 5 * BUSINESS_HOURS_PER_DAY, businessHours: true },
};

/** Texto do prazo para a UI e para o agent ("4 horas úteis"). */
export const SLA_LABELS: Record<TicketPriority, string> = {
  critical: "1 hora",
  high: "4 horas úteis",
  medium: "3 dias úteis",
  low: "5 dias úteis",
};

/** Calcula o prazo (`dueAt`) a partir do instante da última atualização e da prioridade. */
export function computeDueAt(priority: TicketPriority, updatedAt: Date): Date {
  const sla = SLA_BY_PRIORITY[priority];
  return sla.businessHours
    ? addBusinessHours(updatedAt, sla.hours)
    : new Date(updatedAt.getTime() + sla.hours * HOUR_MS);
}

const CLOSED_STATUSES: ReadonlySet<TicketStatus> = new Set(["resolved", "closed"]);

/** Chamado resolvido ou fechado (não vence, não recebe comentário nem transferência). */
export function isFinished(status: TicketStatus): boolean {
  return CLOSED_STATUSES.has(status);
}

/**
 * Vencido quando o instante atual é posterior ao prazo. Chamados `resolved`/`closed` nunca vencem.
 * Aceita `Date` (linha do banco) ou ISO string (DTO).
 */
export function isOverdue(
  ticket: { status: TicketStatus; dueAt: Date | string },
  now: Date,
): boolean {
  if (isFinished(ticket.status)) return false;
  return now.getTime() > new Date(ticket.dueAt).getTime();
}
