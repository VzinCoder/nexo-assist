import { MAX_USER_MESSAGES, type ConversationStatus } from "@nexo/shared";

export type ChatGate =
  | { type: "ok" }
  | { type: "not_found" }
  | { type: "not_agent"; status: Exclude<ConversationStatus, "agent"> }
  | { type: "limit_reached" }
  | { type: "not_configured" };

/**
 * Decide, antes de qualquer chamada ao modelo, se a mensagem pode ir para o agent. Função pura: a
 * rota só instancia o agent quando o resultado é `ok`.
 */
export function decideChatGate(input: {
  conversation: { status: ConversationStatus; userMessageCount: number } | undefined;
  hasApiKey: boolean;
}): ChatGate {
  const { conversation } = input;
  if (!conversation) return { type: "not_found" };
  if (conversation.status !== "agent") return { type: "not_agent", status: conversation.status };
  if (conversation.userMessageCount >= MAX_USER_MESSAGES) return { type: "limit_reached" };
  if (!input.hasApiKey) return { type: "not_configured" };
  return { type: "ok" };
}

export const GATE_MESSAGES = {
  not_found: "Conversa não encontrada.",
  waiting_human: "Esta conversa está aguardando um analista. Ele vai responder por aqui.",
  with_human: "Um analista está atendendo esta conversa.",
  closed: "Esta conversa foi encerrada. Inicie uma nova conversa.",
  limit_reached: `Esta conversa atingiu o limite de ${MAX_USER_MESSAGES} mensagens. Inicie uma nova conversa ou fale com um analista.`,
  not_configured: "O assistente não está configurado neste ambiente (falta a chave do modelo). Login e histórico continuam funcionando.",
} as const;
