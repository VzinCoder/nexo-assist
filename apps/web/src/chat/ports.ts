import type { ConversationStore, DraftStore } from "@nexo/agent";
import type { Db } from "../db/client";
import { insertDraft, setStatus } from "./repository";

/** Implementações das portas do agent sobre o banco do web. */
export function createDbPorts(db: Db, now: () => Date): { drafts: DraftStore; conversations: ConversationStore } {
  return {
    drafts: {
      insertDraft: (input) => ({ id: insertDraft(db, input, now()).id }),
    },
    conversations: {
      markWaitingHuman: (conversationId, handoff) => setStatus(db, conversationId, "waiting_human", now(), handoff),
    },
  };
}
