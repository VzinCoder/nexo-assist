import { createConversationsHandlers } from "@/chat/conversations-handler";
import { env } from "@/env";
import { getDb } from "@/server/db";

const handlers = createConversationsHandlers({ getDb, sessionSecret: env.SESSION_SECRET });

export async function POST(request: Request, context: RouteContext<"/api/conversations/[id]/messages">) {
  const { id } = await context.params;
  return handlers.postMessage(request, id);
}
