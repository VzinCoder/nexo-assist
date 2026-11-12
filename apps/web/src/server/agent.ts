import { createNexoAgent, type ConversationStore, type DraftStore } from "@nexo/agent";
import { env } from "../env";
import { tickets } from "../tickets";

/** Agent real: modelo do `LLM_MODEL` (model router do Mastra lê a chave do provedor do ambiente). */
export function createServerAgent(ports: { drafts: DraftStore; conversations: ConversationStore }) {
  return createNexoAgent({ model: env.LLM_MODEL, tickets, ...ports, now: () => new Date() });
}
