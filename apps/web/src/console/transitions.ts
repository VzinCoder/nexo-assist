import type { ConversationStatus } from "@nexo/shared";
import { z } from "zod";

/** Ações do analista sobre uma conversa. */
export const CONSOLE_ACTIONS = ["assume", "return", "close"] as const;
export const consoleActionSchema = z.enum(CONSOLE_ACTIONS);
export type ConsoleAction = z.infer<typeof consoleActionSchema>;

type Rule = { from: readonly ConversationStatus[]; to: ConversationStatus };

/**
 * Máquina de estados do atendimento humano:
 * - assumir: `waiting_human` ou `agent` → `with_human`
 * - devolver ao agent: `with_human` → `agent`
 * - encerrar: qualquer status aberto → `closed`
 */
export const TRANSITIONS: Record<ConsoleAction, Rule> = {
  assume: { from: ["waiting_human", "agent"], to: "with_human" },
  return: { from: ["with_human"], to: "agent" },
  close: { from: ["agent", "waiting_human", "with_human"], to: "closed" },
};

/** Próximo status ou `null` se a transição não é permitida (a rota responde 409). */
export function nextStatus(current: ConversationStatus, action: ConsoleAction): ConversationStatus | null {
  const rule = TRANSITIONS[action];
  return rule.from.includes(current) ? rule.to : null;
}

/** Analista só envia mensagem quando assumiu a conversa. */
export function canAnalystSend(status: ConversationStatus): boolean {
  return status === "with_human";
}

/** Texto da mensagem `system` gravada em cada transição (visível ao funcionário e ao analista). */
export function transitionMessage(action: ConsoleAction, analystName: string): string {
  if (action === "assume") return `${analystName} assumiu o atendimento.`;
  if (action === "return") return `${analystName} devolveu a conversa ao assistente virtual. Você pode continuar por aqui.`;
  return `${analystName} encerrou a conversa.`;
}

/** Filtro padrão da lista: o que precisa de atenção do analista. */
export const DEFAULT_STATUS_FILTER: readonly ConversationStatus[] = ["waiting_human", "with_human"];
