import { createConversationsHandlers } from "@/chat/conversations-handler";
import { env } from "@/env";
import { getDb } from "@/server/db";

const handlers = createConversationsHandlers({ getDb, sessionSecret: env.SESSION_SECRET });

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: RouteContext<"/api/conversations/[id]">) {
  const { id } = await context.params;
  return handlers.getById(request, id);
}
