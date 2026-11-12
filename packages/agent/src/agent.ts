import { Agent } from "@mastra/core/agent";
import type { MastraModelConfig } from "@mastra/core/llm";
import { StreamErrorRetryProcessor } from "@mastra/core/processors";
import { AGENT_ID, AGENT_DISPLAY_NAME } from "./constants";
import { createNexoRequestContext, type NexoSessionIds } from "./context";
import { buildInstructions } from "./instructions";
import type { NexoAgentDeps } from "./ports";
import { createNexoTools } from "./tools";

/** Limites de custo por resposta (README: "Escolha do modelo"). */
export const MAX_STEPS = 6;
export const MAX_OUTPUT_TOKENS = 800;
/** Mensagens da conversa enviadas ao modelo (o histórico completo fica no banco). */
export const CONTEXT_MESSAGES = 12;

export type NexoAgentOptions = NexoAgentDeps & { model: MastraModelConfig };

export function createNexoAgent(options: NexoAgentOptions) {
  const { model, ...deps } = options;
  return new Agent({
    id: AGENT_ID,
    name: AGENT_DISPLAY_NAME,
    instructions: () => buildInstructions(deps.now()),
    model,
    tools: createNexoTools(deps),
    // Sem retry automático no provedor (D7): um 429 repetido só gastaria mais cota do free tier.
    // Mesmo id do processador padrão, então ele substitui o default; os de reparo continuam.
    errorProcessors: [new StreamErrorRetryProcessor({ maxRetries: 0 })],
  });
}

export type NexoAgent = ReturnType<typeof createNexoAgent>;

/** Mensagem do histórico no formato que vai ao modelo. */
export type HistoryMessage = { role: "user" | "assistant" | "analyst" | "system"; content: string };

/** Converte o histórico do banco: mensagens de analista/sistema viram contexto do lado do assistente. */
export type ModelMessage = { role: "user"; content: string } | { role: "assistant"; content: string };

export function toModelMessages(history: HistoryMessage[]): ModelMessage[] {
  return history
    .filter((message) => message.content.trim() !== "")
    .slice(-CONTEXT_MESSAGES)
    .map((message): ModelMessage => {
      if (message.role === "user") return { role: "user", content: message.content };
      if (message.role === "analyst") return { role: "assistant", content: `[Analista] ${message.content}` };
      if (message.role === "system") return { role: "assistant", content: `[Sistema] ${message.content}` };
      return { role: "assistant", content: message.content };
    });
}

/**
 * Gera a resposta em streaming com os limites aplicados: até 6 passos, `maxOutputTokens` moderado e
 * sem retry no provedor (um 429 viraria mais cota gasta). Identidade só pelo `RequestContext`.
 */
export function streamNexoReply(
  agent: NexoAgent,
  input: { history: HistoryMessage[]; session: NexoSessionIds; abortSignal?: AbortSignal },
) {
  return agent.stream(toModelMessages(input.history), {
    requestContext: createNexoRequestContext(input.session),
    maxSteps: MAX_STEPS,
    modelSettings: { maxOutputTokens: MAX_OUTPUT_TOKENS, maxRetries: 0 },
    ...(input.abortSignal ? { abortSignal: input.abortSignal } : {}),
  });
}
