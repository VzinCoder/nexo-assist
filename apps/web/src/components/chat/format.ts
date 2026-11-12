import type { TicketAffected, TicketPriority, TicketStatus } from "@nexo/shared";

const TZ = "America/Sao_Paulo";

const timeFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const dayMonthFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "short" });
const dayKeyFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

/** "16 out" (sem ponto da abreviação). */
export function formatDayMonth(iso: string): string {
  return dayMonthFormat.format(new Date(iso)).replace(".", "").replace(" de ", " ");
}

/** "16 out, 14:20". */
export function formatDateTime(iso: string): string {
  return `${formatDayMonth(iso)}, ${timeFormat.format(new Date(iso))}`;
}

/** Prazo curto: "13:43" se for hoje, senão "16 out, 13:43". */
export function formatDue(iso: string, now: Date = new Date()): string {
  const due = new Date(iso);
  return dayKeyFormat.format(due) === dayKeyFormat.format(now) ? timeFormat.format(due) : formatDateTime(iso);
}

/** "há 5 dias", "há 3 h", "há 10 min". */
export function formatAgo(iso: string, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  return `há ${days} ${days === 1 ? "dia" : "dias"}`;
}

export function formatDuration(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
}

/** Cor do ponto de status (mesmas cores do protótipo). */
export const STATUS_DOT: Record<TicketStatus, string> = {
  open: "bg-info",
  waiting_analyst: "bg-amber",
  approved: "bg-green",
  in_progress: "bg-info",
  resolved: "bg-green",
  closed: "bg-ink/40",
};

export const PRIORITY_DOT: Record<TicketPriority, string> = {
  critical: "bg-danger",
  high: "bg-amber",
  medium: "bg-ink/40",
  low: "bg-ink/20",
};

/** Afetados na voz do card ("Somente você"), como no protótipo. */
export const AFFECTED_CARD_LABELS: Record<TicketAffected, string> = {
  me: "Somente você",
  team: "Sua equipe",
  company: "A empresa toda",
};

/** Primeira letra minúscula: "Consultou seus chamados" → "consultou seus chamados" (linha de status). */
export function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ""}${parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : ""}`.toUpperCase();
}
