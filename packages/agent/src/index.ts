/**
 * @nexo/agent — agent Nexo Assist (Mastra).
 *
 * APIs confirmadas na doc embutida de @mastra/core 1.82 (dist/docs) e no Context7:
 * - `new Agent({ id, name, instructions, model, tools })`; `instructions` pode ser função
 *   `({ requestContext }) => string` (usada para injetar data/hora atual).
 * - `createTool({ id, description, inputSchema, outputSchema?, execute })`; `execute(input, context)`,
 *   com `context.requestContext.get(chave)` trazendo os ids da sessão.
 * - `agent.stream(messages, { requestContext, maxSteps, modelSettings: { maxOutputTokens, maxRetries } })`
 *   devolve `MastraModelOutput` (`fullStream`, `text`, `toolResults`, `error`, `getFullOutput()`).
 * - Model router: string `"provedor/modelo"` (ex.: `google/gemini-3.5-flash-lite`), chave lida de
 *   `GOOGLE_GENERATIVE_AI_API_KEY`. O id foi conferido no registro do Mastra e na API do Gemini.
 * - Web: `toAISdkStream(stream, { from: "agent", version: "v7" })` de `@mastra/ai-sdk` dentro de
 *   `createUIMessageStream` + `createUIMessageStreamResponse` do `ai@7`; cliente com `useChat`.
 * - Testes: `MastraLanguageModelV2Mock` de `@mastra/core/test-utils/llm-mock` com `doStream` roteirizado.
 */
import { PRODUCT_NAME } from "@nexo/shared";

export const AGENT_NAME = `${PRODUCT_NAME} Agent`;

export { createNexoRequestContext, getSessionIds, type NexoSessionIds, type NexoRequestContext } from "./context";
export type { ConversationStore, DraftStore, NexoAgentDeps } from "./ports";
export { withTrace, describeError, ToolRefusal, type ToolResult, type ToolErrorCode } from "./trace";
export { createNexoTools, TOOL_NAMES, type ToolName, type NexoTools } from "./tools";
export { createMemoryPorts, type MemoryDraft } from "./memory-ports";
