import { z } from "zod";
import {
  createTicketBodySchema,
  ticketIdSchema,
  ticketPrioritySchema,
  ticketStatusSchema,
  ticketTypeSchema,
  ticketCategorySchema,
} from "./ticket";

/** Status da conversa: `agent` → `waiting_human` → `with_human` → (`agent` | `closed`). */
export const CONVERSATION_STATUSES = ["agent", "waiting_human", "with_human", "closed"] as const;
export const conversationStatusSchema = z.enum(CONVERSATION_STATUSES);
export type ConversationStatus = z.infer<typeof conversationStatusSchema>;

export const MESSAGE_ROLES = ["user", "assistant", "analyst", "system"] as const;
export const messageRoleSchema = z.enum(MESSAGE_ROLES);
export type MessageRole = z.infer<typeof messageRoleSchema>;

/** Limite de mensagens do funcionário por conversa (contado no banco). */
export const MAX_USER_MESSAGES = 30;

export const DRAFT_KINDS = ["create", "comment", "reopen"] as const;
export const draftKindSchema = z.enum(DRAFT_KINDS);
export type DraftKind = z.infer<typeof draftKindSchema>;

/** `confirming` é interno (claim atômico); a UI vê pending/confirmed/discarded. */
export const DRAFT_STATUSES = ["pending", "confirming", "confirmed", "discarded"] as const;
export const draftStatusSchema = z.enum(DRAFT_STATUSES);
export type DraftStatus = z.infer<typeof draftStatusSchema>;

/** Resumo de chamado exibido em cards (sem descrição longa nem comentários). */
export const ticketCardSchema = z.object({
  id: ticketIdSchema,
  type: ticketTypeSchema,
  title: z.string(),
  category: ticketCategorySchema,
  priority: ticketPrioritySchema,
  status: ticketStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  dueAt: z.string(),
  isOverdue: z.boolean(),
  /** Só quando o agent abriu o detalhe do chamado. */
  description: z.string().optional(),
});
export type TicketCard = z.infer<typeof ticketCardSchema>;

/** Resume um chamado do tickets-api para card (descarta descrição e comentários). */
export function toTicketCard(ticket: TicketCard & Record<string, unknown>): TicketCard {
  return {
    id: ticket.id,
    type: ticket.type,
    title: ticket.title,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    dueAt: ticket.dueAt,
    isOverdue: ticket.isOverdue,
  };
}

/** Conteúdo do rascunho de chamado novo: campos do chamado + prazo calculado. */
export const createDraftPayloadSchema = createTicketBodySchema.extend({
  dueAt: z.string(),
  slaLabel: z.string(),
});
export type CreateDraftPayload = z.infer<typeof createDraftPayloadSchema>;

/** Conteúdo do rascunho de complemento/reabertura. */
export const updateDraftPayloadSchema = z.object({
  ticketId: ticketIdSchema,
  ticketTitle: z.string(),
  text: z.string().trim().min(1).max(4000),
});
export type UpdateDraftPayload = z.infer<typeof updateDraftPayloadSchema>;

export const draftViewSchema = z.discriminatedUnion("kind", [
  z.object({
    id: z.string(),
    kind: z.literal("create"),
    payload: createDraftPayloadSchema,
    status: draftStatusSchema,
    ticketId: ticketIdSchema.nullable(),
  }),
  z.object({
    id: z.string(),
    kind: z.enum(["comment", "reopen"]),
    payload: updateDraftPayloadSchema,
    status: draftStatusSchema,
    ticketId: ticketIdSchema.nullable(),
  }),
]);
export type DraftView = z.infer<typeof draftViewSchema>;

/** Partes estruturadas de uma mensagem, derivadas dos resultados das tools (nunca do texto). */
export const chatPartSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("tickets"), tickets: z.array(ticketCardSchema) }),
  z.object({ type: z.literal("ticket"), ticket: ticketCardSchema }),
  z.object({ type: z.literal("draft"), draftId: z.string() }),
  z.object({
    type: z.literal("options"),
    question: z.string(),
    options: z.array(z.string()).min(2).max(6),
  }),
  z.object({ type: z.literal("handoff"), reason: z.string() }),
  z.object({
    type: z.literal("notice"),
    code: z.enum([
      "tickets_unavailable",
      "provider_rate_limited",
      "provider_unavailable",
      "not_configured",
    ]),
  }),
]);
export type ChatPart = z.infer<typeof chatPartSchema>;
export const chatPartListSchema = z.array(chatPartSchema);

export const CONVERSATION_STATUS_LABELS: Record<ConversationStatus, string> = {
  agent: "Assistente ativo",
  waiting_human: "Aguardando um analista",
  with_human: "Em atendimento com analista",
  closed: "Encerrada",
};
