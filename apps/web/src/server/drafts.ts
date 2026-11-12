import { createDraftHandlers } from "../chat/drafts-handler";
import { env } from "../env";
import { tickets } from "../tickets";
import { getDb } from "./db";

export const draftHandlers = createDraftHandlers({ getDb, tickets, sessionSecret: env.SESSION_SECRET });
