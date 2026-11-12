import type { DraftKind } from "@nexo/shared";
import type { ConversationStore, DraftStore } from "./ports";

export type MemoryDraft = { id: string; conversationId: string; kind: DraftKind; payload: unknown };

/** Portas em memória: usadas nos testes e no eval (não tocam o banco do web). */
export function createMemoryPorts() {
  const drafts: MemoryDraft[] = [];
  const handoffs: { conversationId: string; reason: string; summary: string }[] = [];
  let sequence = 0;

  const draftStore: DraftStore = {
    insertDraft(input) {
      const draft = { id: `draft-${++sequence}`, ...input };
      drafts.push(draft);
      return { id: draft.id };
    },
  };
  const conversationStore: ConversationStore = {
    markWaitingHuman(conversationId, handoff) {
      handoffs.push({ conversationId, ...handoff });
    },
  };
  return { drafts, handoffs, draftStore, conversationStore };
}
