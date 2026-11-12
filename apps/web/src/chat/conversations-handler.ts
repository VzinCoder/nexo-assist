import { getSessionFromRequest } from "../auth/session";
import type { Db } from "../db/client";
import { MAX_USER_MESSAGES } from "@nexo/shared";
import { z } from "zod";
import { toConversationDto, toMessageDto } from "./dto";
import { appendUserMessage, createConversation, getOrCreateCurrentConversation, getOwnedConversation } from "./repository";

type Deps = { getDb: () => Db; sessionSecret: string; now?: () => Date };

const unauthorized = () =>
  Response.json({ error: { code: "unauthorized", message: "Sessão expirada. Entre novamente." } }, { status: 401 });

const fail = (status: number, code: string, message: string) =>
  Response.json({ error: { code, message } }, { status });

const messageBodySchema = z.object({ text: z.string().trim().min(1, "Escreva a mensagem.").max(2000) });

/**
 * `GET /api/conversations/current`, `POST /api/conversations`, `GET /api/conversations/:id` e
 * `POST /api/conversations/:id/messages` (só do funcionário da sessão).
 */
export function createConversationsHandlers(deps: Deps) {
  const now = deps.now ?? (() => new Date());
  return {
    async getCurrent(request: Request): Promise<Response> {
      const session = await getSessionFromRequest(request, deps.sessionSecret, now());
      if (!session) return unauthorized();
      const db = deps.getDb();
      const conversation = getOrCreateCurrentConversation(db, session.employeeId, now(), session.name);
      return Response.json(toConversationDto(db, conversation), { headers: { "cache-control": "no-store" } });
    },
    async create(request: Request): Promise<Response> {
      const session = await getSessionFromRequest(request, deps.sessionSecret, now());
      if (!session) return unauthorized();
      const db = deps.getDb();
      const conversation = createConversation(db, session.employeeId, now(), session.name);
      return Response.json(toConversationDto(db, conversation), { status: 201 });
    },
    /** Conversa pelo id (polling durante o atendimento humano; mostra também a encerrada). */
    async getById(request: Request, id: string): Promise<Response> {
      const session = await getSessionFromRequest(request, deps.sessionSecret, now());
      if (!session) return unauthorized();
      const db = deps.getDb();
      const conversation = getOwnedConversation(db, id, session.employeeId);
      if (!conversation) return fail(404, "not_found", "Conversa não encontrada.");
      return Response.json(toConversationDto(db, conversation), { headers: { "cache-control": "no-store" } });
    },
    /** Resposta do funcionário ao analista: só com a conversa `with_human`; nunca chama o LLM. */
    async postMessage(request: Request, id: string): Promise<Response> {
      const session = await getSessionFromRequest(request, deps.sessionSecret, now());
      if (!session) return unauthorized();
      const body = messageBodySchema.safeParse(await request.json().catch(() => null));
      if (!body.success) return fail(400, "invalid_body", body.error.issues[0]?.message ?? "Mensagem inválida.");
      const db = deps.getDb();
      const conversation = getOwnedConversation(db, id, session.employeeId);
      if (!conversation) return fail(404, "not_found", "Conversa não encontrada.");
      if (conversation.status !== "with_human") {
        return fail(409, "not_with_human", "Esta conversa não está com um analista.");
      }
      if (conversation.userMessageCount >= MAX_USER_MESSAGES) {
        return fail(409, "limit_reached", `Esta conversa atingiu o limite de ${MAX_USER_MESSAGES} mensagens.`);
      }
      const appended = appendUserMessage(db, conversation.id, body.data.text, now(), "with_human");
      if (!appended) return fail(409, "not_with_human", "Esta conversa não está mais com um analista.");
      return Response.json({ message: toMessageDto(appended.message) }, { status: 201 });
    },
  };
}
