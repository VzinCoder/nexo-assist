import { createConversationsHandlers } from "@/chat/conversations-handler";
import { env } from "@/env";
import { getDb } from "@/server/db";

const handlers = createConversationsHandlers({ getDb, sessionSecret: env.SESSION_SECRET });

export const dynamic = "force-dynamic";
export const GET = handlers.getCurrent;
