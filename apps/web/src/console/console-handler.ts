import {
  CONVERSATION_STATUSES,
  TicketsUnavailableError,
  conversationStatusSchema,
  type ConversationStatus,
  type MessageRole,
  type TicketSummary,
  type TicketsClient,
} from "@nexo/shared";
import { z } from "zod";
import { getSessionFromRequest, isAnalyst, type Session } from "../auth/session";
import type { Db } from "../db/client";
import { toConversationDto, toMessageDto, type ConversationDto, type MessageDto } from "../chat/dto";
import type { Conversation } from "../chat/repository";
import { appendAnalystMessage, applyConsoleAction, getConversation, listConsoleConversations } from "./repository";
import { DEFAULT_STATUS_FILTER, consoleActionSchema } from "./transitions";

type Deps = {
  getDb: () => Db;
  tickets: Pick<TicketsClient, "listTickets">;
  sessionSecret: string;
  now?: () => Date;
};

export type ConsoleListItemDto = {
  id: string;
  status: ConversationStatus;
  employeeId: string;
  employeeName: string | null;
  handoffReason: string | null;
  analystName: string | null;
  updatedAt: string;
  lastMessage: { role: MessageRole; content: string; createdAt: string } | null;
};

export type ConsoleConversationDto = ConversationDto & {
  employeeId: string;
  employeeName: string | null;
  handoffSummary: string | null;
  analystId: string | null;
  analystName: string | null;
  updatedAt: string;
};

export type ConsoleTicketsDto = { tickets: TicketSummary[] };

const json = (status: number, body: unknown) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });
const fail = (status: number, code: string, message: string, extra: Record<string, unknown> = {}) =>
  json(status, { error: { code, message }, ...extra });

const statusFilterSchema = z
  .string()
  .transform((value) => value.split(",").filter(Boolean))
  .pipe(z.array(z.union([conversationStatusSchema, z.literal("all")])));

const actionBodySchema = z.object({ action: consoleActionSchema });
const messageBodySchema = z.object({ text: z.string().trim().min(1, "Escreva a mensagem.").max(2000) });

function toConsoleDto(db: Db, conversation: Conversation): ConsoleConversationDto {
  return {
    ...toConversationDto(db, conversation),
    employeeId: conversation.employeeId,
    employeeName: conversation.employeeName,
    handoffSummary: conversation.handoffSummary,
    analystId: conversation.analystId,
    analystName: conversation.analystName,
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/** Rotas do console: só analistas (401 sem sessão, 403 para funcionário). */
export function createConsoleHandlers(deps: Deps) {
  const now = deps.now ?? (() => new Date());

  async function authorize(request: Request): Promise<{ ok: true; session: Session } | { ok: false; response: Response }> {
    const session = await getSessionFromRequest(request, deps.sessionSecret, now());
    if (!session) return { ok: false, response: fail(401, "unauthorized", "Sessão expirada. Entre novamente.") };
    if (!isAnalyst(session.role)) return { ok: false, response: fail(403, "forbidden", "Acesso restrito a analistas.") };
    return { ok: true, session };
  }

  const notFound = () => fail(404, "not_found", "Conversa não encontrada.");

  return {
    /** `GET /api/console/conversations?status=waiting_human,with_human` (ou `all`). */
    async list(request: Request): Promise<Response> {
      const auth = await authorize(request);
      if (!auth.ok) return auth.response;
      const raw = new URL(request.url).searchParams.get("status");
      let statuses: readonly ConversationStatus[] = DEFAULT_STATUS_FILTER;
      if (raw) {
        const parsed = statusFilterSchema.safeParse(raw);
        if (!parsed.success) return fail(400, "invalid_status", "Filtro de status inválido.");
        statuses = parsed.data.includes("all")
          ? CONVERSATION_STATUSES
          : parsed.data.filter((value): value is ConversationStatus => value !== "all");
      }
      const items: ConsoleListItemDto[] = listConsoleConversations(deps.getDb(), statuses).map(
        ({ conversation, lastMessage }) => ({
          id: conversation.id,
          status: conversation.status,
          employeeId: conversation.employeeId,
          employeeName: conversation.employeeName,
          handoffReason: conversation.handoffReason,
          analystName: conversation.analystName,
          updatedAt: conversation.updatedAt.toISOString(),
          lastMessage: lastMessage && { ...lastMessage, createdAt: lastMessage.createdAt.toISOString() },
        }),
      );
      return json(200, { conversations: items });
    },

    /** `GET /api/console/conversations/:id`: mensagens com trace e decisão, resumo da transferência. */
    async detail(request: Request, id: string): Promise<Response> {
      const auth = await authorize(request);
      if (!auth.ok) return auth.response;
      const db = deps.getDb();
      const conversation = getConversation(db, id);
      if (!conversation) return notFound();
      return json(200, toConsoleDto(db, conversation));
    },

    /** `POST /api/console/conversations/:id/actions` com `{ action: "assume" | "return" | "close" }`. */
    async action(request: Request, id: string): Promise<Response> {
      const auth = await authorize(request);
      if (!auth.ok) return auth.response;
      const body = actionBodySchema.safeParse(await readJson(request));
      if (!body.success) return fail(400, "invalid_body", "Ação inválida.");
      const db = deps.getDb();
      const result = applyConsoleAction(
        db,
        id,
        body.data.action,
        { id: auth.session.employeeId, name: auth.session.name },
        now(),
      );
      if (!result.ok) {
        if (result.reason === "not_found") return notFound();
        return fail(409, "invalid_transition", "Esta ação não é possível no status atual da conversa.", {
          status: result.status,
        });
      }
      return json(200, toConsoleDto(db, result.conversation));
    },

    /** `POST /api/console/conversations/:id/messages` com `{ text }`; só com a conversa assumida. */
    async message(request: Request, id: string): Promise<Response> {
      const auth = await authorize(request);
      if (!auth.ok) return auth.response;
      const body = messageBodySchema.safeParse(await readJson(request));
      if (!body.success) return fail(400, "invalid_body", body.error.issues[0]?.message ?? "Mensagem inválida.");
      const result = appendAnalystMessage(deps.getDb(), id, body.data.text, now());
      if (!result.ok) {
        if (result.reason === "not_found") return notFound();
        return fail(409, "invalid_status", "Assuma a conversa antes de responder.", { status: result.status });
      }
      const message: MessageDto = toMessageDto(result.message);
      return json(201, { message });
    },

    /** `GET /api/console/conversations/:id/tickets`: chamados do funcionário da conversa. */
    async tickets(request: Request, id: string): Promise<Response> {
      const auth = await authorize(request);
      if (!auth.ok) return auth.response;
      const conversation = getConversation(deps.getDb(), id);
      if (!conversation) return notFound();
      try {
        const tickets = await deps.tickets.listTickets(conversation.employeeId);
        return json(200, { tickets } satisfies ConsoleTicketsDto);
      } catch (error) {
        if (error instanceof TicketsUnavailableError) return fail(503, "tickets_unavailable", error.message);
        throw error;
      }
    },
  };
}
