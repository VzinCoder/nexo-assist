import {
  TicketConflictError,
  TicketNotFoundError,
  TicketsUnavailableError,
  toTicketCard,
  type DraftView,
  type Ticket,
  type TicketsClient,
} from "@nexo/shared";
import { getSessionFromRequest } from "../auth/session";
import type { Db } from "../db/client";
import { toMessageDto } from "./dto";
import {
  appendMessage,
  claimDraft,
  discardDraft,
  finishDraft,
  getOwnedDraft,
  releaseDraft,
  toDraftView,
} from "./repository";

type Deps = {
  getDb: () => Db;
  tickets: Pick<TicketsClient, "createTicket" | "addComment" | "reopenTicket">;
  sessionSecret: string;
  now?: () => Date;
};

const json = (status: number, body: unknown) => Response.json(body, { status });
const fail = (status: number, code: string, message: string, extra: Record<string, unknown> = {}) =>
  json(status, { error: { code, message }, ...extra });

function confirmationText(draft: DraftView, ticket: Ticket): string {
  if (draft.kind === "create") return `Chamado ${ticket.id} criado. Acompanhe o prazo no card abaixo.`;
  if (draft.kind === "comment") return `Complemento adicionado ao ${ticket.id}.`;
  return `${ticket.id} reaberto com o seu comentário.`;
}

/**
 * Confirmação e descarte de rascunhos: ação determinística no tickets-api, sem passar pelo modelo.
 * Este módulo não importa nada do agent.
 */
export function createDraftHandlers(deps: Deps) {
  const now = deps.now ?? (() => new Date());

  async function load(request: Request, draftId: string) {
    const session = await getSessionFromRequest(request, deps.sessionSecret, now());
    if (!session) return { ok: false, response: fail(401, "unauthorized", "Sessão expirada. Entre novamente.") } as const;
    const db = deps.getDb();
    const owned = getOwnedDraft(db, draftId, session.employeeId);
    if (!owned) return { ok: false, response: fail(404, "not_found", "Rascunho não encontrado.") } as const;
    if (owned.conversation.status === "closed") {
      return { ok: false, response: fail(409, "conversation_closed", "Esta conversa foi encerrada; o rascunho não pode mais ser usado.") } as const;
    }
    const view = toDraftView(owned.draft);
    if (!view) return { ok: false, response: fail(500, "invalid_draft", "Rascunho inválido.") } as const;
    return { ok: true, db, session, owned, view } as const;
  }

  return {
    async confirm(request: Request, draftId: string): Promise<Response> {
      const loaded = await load(request, draftId);
      if (!loaded.ok) return loaded.response;
      const { db, session, owned, view } = loaded;

      if (!claimDraft(db, draftId, now())) {
        return fail(409, "draft_not_pending", "Este rascunho já foi confirmado ou descartado.", { draft: view });
      }

      let ticket: Ticket;
      try {
        if (view.kind === "create") {
          const { dueAt: _dueAt, slaLabel: _slaLabel, ...body } = view.payload;
          ticket = await deps.tickets.createTicket(session.employeeId, body);
        } else if (view.kind === "comment") {
          ticket = await deps.tickets.addComment(session.employeeId, view.payload.ticketId, view.payload.text);
        } else {
          ticket = await deps.tickets.reopenTicket(session.employeeId, view.payload.ticketId, view.payload.text);
        }
      } catch (error) {
        releaseDraft(db, draftId, now());
        if (error instanceof TicketsUnavailableError) {
          return fail(503, "tickets_unavailable", "Sistema de chamados indisponível. Seu rascunho continua salvo; tente confirmar de novo em instantes.");
        }
        if (error instanceof TicketConflictError) return fail(409, "ticket_conflict", error.message);
        if (error instanceof TicketNotFoundError) return fail(404, "ticket_not_found", "Chamado não encontrado entre os seus chamados.");
        return fail(502, "tickets_error", "O sistema de chamados recusou a operação. Tente novamente.");
      }

      finishDraft(db, draftId, ticket.id, now());
      const message = appendMessage(
        db,
        {
          conversationId: owned.conversation.id,
          role: "system",
          content: confirmationText(view, ticket),
          parts: [{ type: "ticket", ticket: toTicketCard(ticket) }],
        },
        now(),
      );
      return json(200, {
        draft: { ...view, status: "confirmed", ticketId: ticket.id } satisfies DraftView,
        message: toMessageDto(message),
      });
    },

    async discard(request: Request, draftId: string): Promise<Response> {
      const loaded = await load(request, draftId);
      if (!loaded.ok) return loaded.response;
      const { db, view } = loaded;
      if (!discardDraft(db, draftId, now())) {
        return fail(409, "draft_not_pending", "Este rascunho já foi confirmado ou descartado.", { draft: view });
      }
      return json(200, { draft: { ...view, status: "discarded" } satisfies DraftView });
    },
  };
}
