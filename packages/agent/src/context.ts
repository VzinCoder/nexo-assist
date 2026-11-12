import { RequestContext } from "@mastra/core/request-context";

/**
 * Identidade da sessão que as tools usam. Vem só do `RequestContext` montado pela rota a partir do
 * cookie de sessão e do banco; nunca de argumento do modelo.
 */
export type NexoSessionIds = {
  employeeId: string;
  conversationId: string;
};

export type NexoRequestContext = RequestContext<NexoSessionIds>;

export function createNexoRequestContext(ids: NexoSessionIds): NexoRequestContext {
  const context = new RequestContext<NexoSessionIds>();
  context.set("employeeId", ids.employeeId);
  context.set("conversationId", ids.conversationId);
  return context;
}

export class MissingSessionContextError extends Error {
  override name = "MissingSessionContextError";
}

/** Lê os ids da sessão do contexto; lança se faltarem (nunca cai num funcionário "padrão"). */
export function getSessionIds(context: { get(key: string): unknown } | undefined): NexoSessionIds {
  const employeeId = context?.get("employeeId");
  const conversationId = context?.get("conversationId");
  if (typeof employeeId !== "string" || employeeId === "" || typeof conversationId !== "string" || conversationId === "") {
    throw new MissingSessionContextError("Contexto da sessão ausente: employeeId/conversationId não informados.");
  }
  return { employeeId, conversationId };
}
