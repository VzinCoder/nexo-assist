import { createChatHandler } from "@/chat/chat-handler";
import { env } from "@/env";
import { createServerAgent } from "@/server/agent";
import { getDb } from "@/server/db";

export const POST = createChatHandler({
  getDb,
  sessionSecret: env.SESSION_SECRET,
  hasApiKey: env.GOOGLE_GENERATIVE_AI_API_KEY !== undefined,
  modelId: env.LLM_MODEL,
  createAgent: createServerAgent,
});
