import { z } from "zod";
import { employeeIdSchema } from "./employee";

export const TICKET_TYPES = ["INC", "REQ"] as const;
export const ticketTypeSchema = z.enum(TICKET_TYPES);
export type TicketType = z.infer<typeof ticketTypeSchema>;

export const TICKET_CATEGORIES = [
  "access",
  "network_vpn",
  "hardware",
  "software",
  "email",
  "other",
] as const;
export const ticketCategorySchema = z.enum(TICKET_CATEGORIES);
export type TicketCategory = z.infer<typeof ticketCategorySchema>;

export const TICKET_PRIORITIES = ["critical", "high", "medium", "low"] as const;
export const ticketPrioritySchema = z.enum(TICKET_PRIORITIES);
export type TicketPriority = z.infer<typeof ticketPrioritySchema>;

export const TICKET_STATUSES = [
  "open",
  "waiting_analyst",
  "approved",
  "in_progress",
  "resolved",
  "closed",
] as const;
export const ticketStatusSchema = z.enum(TICKET_STATUSES);
export type TicketStatus = z.infer<typeof ticketStatusSchema>;

export const TICKET_AFFECTED = ["me", "team", "company"] as const;
export const ticketAffectedSchema = z.enum(TICKET_AFFECTED);
export type TicketAffected = z.infer<typeof ticketAffectedSchema>;

export const COMMENT_KINDS = ["comment", "reopen", "escalation"] as const;
export const commentKindSchema = z.enum(COMMENT_KINDS);
export type CommentKind = z.infer<typeof commentKindSchema>;

export const TICKET_TYPE_LABELS: Record<TicketType, string> = {
  INC: "Incidente",
  REQ: "Requisição",
};

export const TICKET_CATEGORY_LABELS: Record<TicketCategory, string> = {
  access: "Acesso",
  network_vpn: "Rede e VPN",
  hardware: "Hardware",
  software: "Software",
  email: "E-mail",
  other: "Outros",
};

export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  critical: "Crítica",
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  open: "Aberto",
  waiting_analyst: "Aguardando analista",
  approved: "Aprovado",
  in_progress: "Em atendimento",
  resolved: "Resolvido",
  closed: "Fechado",
};

export const TICKET_AFFECTED_LABELS: Record<TicketAffected, string> = {
  me: "Só eu",
  team: "Minha equipe",
  company: "A empresa toda",
};

export const COMMENT_KIND_LABELS: Record<CommentKind, string> = {
  comment: "Comentário",
  reopen: "Reabertura",
  escalation: "Transferência",
};

/** `INC-NNNNN` ou `REQ-NNNNN`, sempre com 5 dígitos. */
export const ticketIdSchema = z
  .string()
  .regex(/^(INC|REQ)-\d{5}$/, "Id de chamado deve seguir o padrão INC-NNNNN ou REQ-NNNNN.");
export type TicketId = z.infer<typeof ticketIdSchema>;

const isoDateTime = z.iso.datetime({ offset: true });

/** Texto obrigatório: espaços nas pontas são removidos e não pode sobrar vazio. */
const requiredText = (max: number) => z.string().trim().min(1, "Não pode ficar vazio.").max(max);

export const commentSchema = z.object({
  id: z.number().int().positive(),
  authorId: employeeIdSchema,
  authorName: z.string().min(1),
  kind: commentKindSchema,
  text: z.string(),
  createdAt: isoDateTime,
});
export type Comment = z.infer<typeof commentSchema>;

/** Chamado sem comentários (listagens). Datas em ISO 8601 UTC. */
export const ticketSummarySchema = z.object({
  id: ticketIdSchema,
  type: ticketTypeSchema,
  title: z.string(),
  description: z.string(),
  category: ticketCategorySchema,
  priority: ticketPrioritySchema,
  status: ticketStatusSchema,
  affected: ticketAffectedSchema,
  employeeId: employeeIdSchema,
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
  resolvedAt: isoDateTime.nullable(),
  dueAt: isoDateTime,
  isOverdue: z.boolean(),
});
export type TicketSummary = z.infer<typeof ticketSummarySchema>;
export const ticketSummaryListSchema = z.array(ticketSummarySchema);

/** Chamado com comentários em ordem cronológica (detalhe e respostas de escrita). */
export const ticketSchema = ticketSummarySchema.extend({
  comments: z.array(commentSchema),
});
export type Ticket = z.infer<typeof ticketSchema>;

export const similarTicketSchema = ticketSummarySchema.extend({
  reopenable: z.boolean(),
});
export type SimilarTicket = z.infer<typeof similarTicketSchema>;
export const similarTicketListSchema = z.array(similarTicketSchema);

export const ticketParamsSchema = z.object({ id: ticketIdSchema });

export const ticketListQuerySchema = z.object({
  status: ticketStatusSchema.optional(),
});
export type TicketListQuery = z.infer<typeof ticketListQuerySchema>;

export const createTicketBodySchema = z.object({
  title: requiredText(120),
  description: requiredText(4000),
  type: ticketTypeSchema,
  category: ticketCategorySchema,
  priority: ticketPrioritySchema,
  affected: ticketAffectedSchema,
});
export type CreateTicketBody = z.infer<typeof createTicketBodySchema>;

export const commentBodySchema = z.object({
  text: requiredText(4000),
});
export type CommentBody = z.infer<typeof commentBodySchema>;

export const reopenBodySchema = z.object({
  comment: z.string().trim().max(4000).optional(),
});
export type ReopenBody = z.infer<typeof reopenBodySchema>;

export const escalateBodySchema = z.object({
  reason: requiredText(500),
  summary: requiredText(4000),
});
export type EscalateBody = z.infer<typeof escalateBodySchema>;

export const similarBodySchema = z.object({
  text: requiredText(4000),
});
export type SimilarBody = z.infer<typeof similarBodySchema>;
