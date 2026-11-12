import type { DraftKind, TicketsClient } from "@nexo/shared";

/** Grava rascunhos `pending` (implementada pelo web com Drizzle; em memória nos testes e no eval). */
export interface DraftStore {
  insertDraft(input: { conversationId: string; kind: DraftKind; payload: unknown }): Promise<{ id: string }> | { id: string };
}

/** Muda o status da conversa (implementada pelo web). */
export interface ConversationStore {
  markWaitingHuman(conversationId: string, handoff: { reason: string; summary: string }): Promise<void> | void;
}

/** Dependências injetadas no agent. `model` é a string do model router ou um modelo de teste. */
export type NexoAgentDeps = {
  tickets: TicketsClient;
  drafts: DraftStore;
  conversations: ConversationStore;
  now: () => Date;
};
