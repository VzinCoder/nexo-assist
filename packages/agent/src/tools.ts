import { createTool } from "@mastra/core/tools";
import {
  SLA_LABELS,
  TicketsUnavailableError,
  TICKET_AFFECTED,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TICKET_TYPES,
  DECISION_CONFIDENCES,
  DECISION_INTENTS,
  computeDueAt,
  createTicketBodySchema,
  decisionSchema,
  isFinished,
  isReopenable,
  ticketIdSchema,
  toTicketCard,
  type CreateDraftPayload,
  type Decision,
  type DraftKind,
  type Ticket,
  type TicketCard,
  type TicketSummary,
  type UpdateDraftPayload,
} from "@nexo/shared";
import { z } from "zod";
import { getSessionIds } from "./context";
import type { NexoAgentDeps } from "./ports";
import { ToolRefusal, withTrace } from "./trace";

/** Nomes das tools (ids usados pelo modelo, pelo trace e pela coleta do turno). */
export const TOOL_NAMES = [
  "search_help_center",
  "list_my_tickets",
  "get_ticket",
  "find_similar_tickets",
  "draft_ticket",
  "draft_ticket_update",
  "offer_options",
  "handoff_to_human",
  "report_decision",
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

type ExecuteContext = { requestContext?: { get(key: string): unknown } } | undefined;

const toCard = (ticket: TicketSummary): TicketCard => toTicketCard(ticket);

const traceCard = (ticket: TicketCard) => ({
  id: ticket.id,
  title: ticket.title,
  status: ticket.status,
  isOverdue: ticket.isOverdue,
});

/** O modelo pode escrever "inc-20311"; normalizamos antes de validar o formato. */
function parseTicketId(raw: string): string {
  return ticketIdSchema.parse(raw.trim().toUpperCase());
}

const ticketIdInput = z.string().min(1).describe("Id do chamado, ex.: INC-20311 ou REQ-10442");

export type TicketDetail = TicketCard & {
  description: string;
  affected: Ticket["affected"];
  resolvedAt: string | null;
  comments: { author: string; kind: string; text: string; createdAt: string }[];
};

export type DraftResult = {
  draftId: string;
  kind: DraftKind;
  payload: CreateDraftPayload | UpdateDraftPayload;
  note: string;
};

export type HandoffResult = {
  transferred: true;
  reason: string;
  ticketId: string | null;
  ticketEscalated: boolean;
};

export function createNexoTools(deps: NexoAgentDeps) {
  const { tickets, drafts, conversations, now } = deps;

  const searchHelpCenter = createTool({
    id: "search_help_center",
    description:
      "Busca artigos da central de ajuda por palavras-chave (ex.: 'VPN 809', 'senha SAP'). Use antes de abrir chamado quando o problema puder ter solução documentada.",
    inputSchema: z.object({ query: z.string().trim().min(2).max(200) }).strict(),
    execute: async (input) =>
      withTrace({
        tool: "search_help_center",
        label: "Buscou na central de ajuda",
        input,
        run: () => tickets.searchArticles(input.query),
        summarize: (articles) => articles.map(({ id, title }) => ({ id, title })),
      }),
  });

  const listMyTickets = createTool({
    id: "list_my_tickets",
    description:
      "Lista os chamados do funcionário logado (com indicação de vencido). Filtro opcional por status.",
    inputSchema: z.object({ status: z.enum(TICKET_STATUSES).optional() }).strict(),
    execute: async (input, context: ExecuteContext) =>
      withTrace({
        tool: "list_my_tickets",
        label: "Consultou seus chamados",
        input,
        run: async () => {
          const { employeeId } = getSessionIds(context?.requestContext);
          const rows = await tickets.listTickets(employeeId, input.status ? { status: input.status } : {});
          return rows.map(toCard);
        },
        summarize: (cards) => cards.map(traceCard),
      }),
  });

  const getTicket = createTool({
    id: "get_ticket",
    description: "Abre o detalhe de um chamado do funcionário logado (descrição, prazo, comentários).",
    inputSchema: z.object({ ticketId: ticketIdInput }).strict(),
    execute: async (input, context: ExecuteContext) => {
      const id = input.ticketId.trim().toUpperCase();
      return withTrace({
        tool: "get_ticket",
        label: `Abriu o chamado ${id}`,
        input,
        run: async (): Promise<TicketDetail> => {
          const { employeeId } = getSessionIds(context?.requestContext);
          const ticket = await tickets.getTicket(employeeId, parseTicketId(input.ticketId));
          return {
            ...toCard(ticket),
            description: ticket.description,
            affected: ticket.affected,
            resolvedAt: ticket.resolvedAt,
            comments: ticket.comments.slice(-5).map((comment) => ({
              author: comment.authorName,
              kind: comment.kind,
              text: comment.text,
              createdAt: comment.createdAt,
            })),
          };
        },
        summarize: (ticket) => ({ ...traceCard(ticket), priority: ticket.priority, dueAt: ticket.dueAt }),
      });
    },
  });

  const findSimilarTickets = createTool({
    id: "find_similar_tickets",
    description:
      "Verifica se o funcionário já tem chamado sobre o mesmo problema (aberto, ou resolvido há até 7 dias e reabrível). Obrigatório antes de draft_ticket.",
    inputSchema: z.object({ text: z.string().trim().min(3).max(1000) }).strict(),
    execute: async (input, context: ExecuteContext) =>
      withTrace({
        tool: "find_similar_tickets",
        label: "Verificou chamados parecidos",
        input,
        run: async () => {
          const { employeeId } = getSessionIds(context?.requestContext);
          const rows = await tickets.findSimilarTickets(employeeId, input.text);
          return rows.map((row) => ({ ...toCard(row), reopenable: row.reopenable }));
        },
        summarize: (rows) => rows.map((row) => ({ ...traceCard(row), reopenable: row.reopenable })),
      }),
  });

  const draftTicket = createTool({
    id: "draft_ticket",
    description:
      "Prepara um RASCUNHO de chamado novo (não cria nada). O funcionário precisa clicar em Confirmar no card. Exige todos os campos; pergunte o que faltar.",
    inputSchema: z
      .object({
        title: z.string().optional().describe("Título curto, até 120 caracteres"),
        description: z.string().optional().describe("O que acontece, desde quando e o que já foi tentado"),
        type: z.enum(TICKET_TYPES).optional().describe("INC: algo parou; REQ: pedido de acesso/equipamento/software"),
        category: z.enum(TICKET_CATEGORIES).optional(),
        priority: z.enum(TICKET_PRIORITIES).optional(),
        affected: z.enum(TICKET_AFFECTED).optional().describe("me: só a pessoa; team: a equipe; company: a empresa"),
      })
      .strict(),
    execute: async (input, context: ExecuteContext) =>
      withTrace({
        tool: "draft_ticket",
        label: "Montou o rascunho do chamado",
        input,
        run: async (): Promise<DraftResult> => {
          const { conversationId } = getSessionIds(context?.requestContext);
          const body = createTicketBodySchema.parse(input);
          const payload: CreateDraftPayload = {
            ...body,
            dueAt: computeDueAt(body.priority, now()).toISOString(),
            slaLabel: SLA_LABELS[body.priority],
          };
          const draft = await drafts.insertDraft({ conversationId, kind: "create", payload });
          return {
            draftId: draft.id,
            kind: "create",
            payload,
            note: "Rascunho pendente: o chamado só será criado quando o funcionário clicar em Confirmar no card.",
          };
        },
        summarize: (result) => ({ draftId: result.draftId, ...result.payload }),
      }),
  });

  const draftTicketUpdate = createTool({
    id: "draft_ticket_update",
    description:
      "Prepara um RASCUNHO de complemento (comment) num chamado aberto do funcionário, ou de reabertura (reopen) de chamado resolvido há até 7 dias. Não altera nada até a confirmação.",
    inputSchema: z
      .object({
        ticketId: ticketIdInput,
        kind: z.enum(["comment", "reopen"]),
        text: z.string().trim().min(1).max(4000).describe("Texto do complemento ou motivo da reabertura"),
      })
      .strict(),
    execute: async (input, context: ExecuteContext) =>
      withTrace({
        tool: "draft_ticket_update",
        label: input.kind === "reopen" ? "Montou o rascunho de reabertura" : "Montou o rascunho de complemento",
        input,
        run: async (): Promise<DraftResult> => {
          const { employeeId, conversationId } = getSessionIds(context?.requestContext);
          const ticket = await tickets.getTicket(employeeId, parseTicketId(input.ticketId));
          if (input.kind === "comment" && isFinished(ticket.status)) {
            throw new ToolRefusal(
              `O ${ticket.id} está ${ticket.status === "resolved" ? "resolvido" : "fechado"} e não recebe complemento. Ofereça reabrir (se resolvido há até 7 dias) ou abrir um chamado novo.`,
            );
          }
          if (input.kind === "reopen" && !isReopenable(ticket, now())) {
            throw new ToolRefusal(
              ticket.status === "resolved"
                ? `Passou o prazo de reabertura do ${ticket.id} (7 dias após a resolução). Ofereça abrir um chamado novo.`
                : `O ${ticket.id} não está resolvido, então não pode ser reaberto. Ofereça um complemento.`,
            );
          }
          const payload: UpdateDraftPayload = { ticketId: ticket.id, ticketTitle: ticket.title, text: input.text };
          const draft = await drafts.insertDraft({ conversationId, kind: input.kind, payload });
          return {
            draftId: draft.id,
            kind: input.kind,
            payload,
            note: "Rascunho pendente: nada muda no chamado até o funcionário clicar em Confirmar.",
          };
        },
        summarize: (result) => ({ draftId: result.draftId, kind: result.kind, ...result.payload }),
      }),
  });

  const offerOptions = createTool({
    id: "offer_options",
    description:
      "Mostra uma pergunta fechada com 2 a 6 opções curtas como botões (ex.: quem é afetado: 'Só eu', 'Minha equipe', 'A empresa toda', 'Não sei').",
    inputSchema: z
      .object({
        question: z.string().trim().min(3).max(200),
        options: z.array(z.string().trim().min(1).max(60)).min(2).max(6),
      })
      .strict(),
    execute: async (input) =>
      withTrace({
        tool: "offer_options",
        label: "Ofereceu opções",
        input,
        run: async () => ({ question: input.question, options: input.options }),
      }),
  });

  const handoffToHuman = createTool({
    id: "handoff_to_human",
    description:
      "Transfere a conversa para um analista humano, com motivo e resumo do caso. Informe ticketId quando houver chamado relacionado. Depois disso o assistente para de responder.",
    inputSchema: z
      .object({
        reason: z.string().trim().min(3).max(500),
        summary: z.string().trim().min(3).max(4000),
        ticketId: ticketIdInput.optional(),
      })
      .strict(),
    execute: async (input, context: ExecuteContext) => {
      let escalateError: string | undefined;
      const result = await withTrace({
        tool: "handoff_to_human",
        label: "Transferiu para um analista",
        input,
        run: async (): Promise<HandoffResult> => {
          const { employeeId, conversationId } = getSessionIds(context?.requestContext);
          const ticketId = input.ticketId ? parseTicketId(input.ticketId) : null;
          await conversations.markWaitingHuman(conversationId, { reason: input.reason, summary: input.summary });
          let ticketEscalated = false;
          if (ticketId) {
            try {
              await tickets.escalateTicket(employeeId, ticketId, { reason: input.reason, summary: input.summary });
              ticketEscalated = true;
            } catch (error) {
              const message =
                error instanceof TicketsUnavailableError ? "sistema de chamados indisponível" : "o chamado recusou o registro";
              escalateError = `Conversa transferida, mas não foi possível registrar a transferência no ${ticketId} (${message}).`;
            }
          }
          return { transferred: true, reason: input.reason, ticketId, ticketEscalated };
        },
      });
      if (escalateError && result.ok) result.trace.error = escalateError;
      return result;
    },
  });

  const reportDecision = createTool({
    id: "report_decision",
    description:
      "Registra a decisão desta resposta: intent, ação feita, confiança e motivo (1–2 frases citando a regra). Chame SEMPRE, como última ação de cada resposta.",
    inputSchema: z
      .object({
        intent: z.enum(DECISION_INTENTS),
        action: z.string().trim().min(1).max(300),
        confidence: z.enum(DECISION_CONFIDENCES),
        reason: z.string().trim().min(1).max(500),
      })
      .strict(),
    execute: async (input) =>
      withTrace({
        tool: "report_decision",
        label: "Registrou a decisão",
        input,
        run: async (): Promise<Decision> => decisionSchema.parse(input),
      }),
  });

  return {
    search_help_center: searchHelpCenter,
    list_my_tickets: listMyTickets,
    get_ticket: getTicket,
    find_similar_tickets: findSimilarTickets,
    draft_ticket: draftTicket,
    draft_ticket_update: draftTicketUpdate,
    offer_options: offerOptions,
    handoff_to_human: handoffToHuman,
    report_decision: reportDecision,
  } satisfies Record<ToolName, unknown>;
}

export type NexoTools = ReturnType<typeof createNexoTools>;
