import { getSessionFromRequest } from "../auth/session";
import type { Db } from "../db/client";
import { toConversationDto } from "./dto";
import { createConversation, getOrCreateCurrentConversation } from "./repository";

type Deps = { getDb: () => Db; sessionSecret: string; now?: () => Date };

const unauthorized = () =>
  Response.json({ error: { code: "unauthorized", message: "Sessão expirada. Entre novamente." } }, { status: 401 });

/** `GET /api/conversations/current` e `POST /api/conversations` (só do funcionário da sessão). */
export function createConversationsHandlers(deps: Deps) {
  const now = deps.now ?? (() => new Date());
  return {
    async getCurrent(request: Request): Promise<Response> {
      const session = await getSessionFromRequest(request, deps.sessionSecret, now());
      if (!session) return unauthorized();
      const db = deps.getDb();
      const conversation = getOrCreateCurrentConversation(db, session.employeeId, now());
      return Response.json(toConversationDto(db, conversation), { headers: { "cache-control": "no-store" } });
    },
    async create(request: Request): Promise<Response> {
      const session = await getSessionFromRequest(request, deps.sessionSecret, now());
      if (!session) return unauthorized();
      const db = deps.getDb();
      const conversation = createConversation(db, session.employeeId, now());
      return Response.json(toConversationDto(db, conversation), { status: 201 });
    },
  };
}
