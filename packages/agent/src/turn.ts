import {
  decisionSchema,
  ticketCardSchema,
  type ChatPart,
  type Decision,
  type TicketCard,
  type TraceStep,
} from "@nexo/shared";
import { z } from "zod";
import type { ToolName } from "./tools";

/** Resultado de uma chamada de tool, como sai do stream do Mastra (payload do chunk `tool-result`). */
export type RawToolResult = { toolName: string; args: unknown; result: unknown };

export type CollectedTurn = {
  text: string;
  trace: TraceStep[];
  decision: Decision;
  decisionMissing: boolean;
  parts: ChatPart[];
  handedOff: boolean;
};

/** Rótulo do chip quando a tool nem chegou a rodar (argumentos recusados pela validação). */
export const TOOL_LABELS: Record<ToolName, string> = {
  search_help_center: "Buscou na central de ajuda",
  list_my_tickets: "Consultou seus chamados",
  get_ticket: "Abriu um chamado",
  find_similar_tickets: "Verificou chamados parecidos",
  draft_ticket: "Montou o rascunho do chamado",
  draft_ticket_update: "Montou o rascunho de atualização",
  offer_options: "Ofereceu opções",
  handoff_to_human: "Transferiu para um analista",
  report_decision: "Registrou a decisão",
};

export const MISSING_DECISION: Decision = {
  intent: "other",
  action: "Respondeu sem registrar a decisão",
  confidence: "low",
  reason: "O agent não registrou a decisão desta resposta; trate com cautela e, se preciso, fale com um analista.",
};

const traceShape = z.object({
  tool: z.string(),
  label: z.string(),
  input: z.unknown(),
  output: z.unknown(),
  durationMs: z.number(),
  error: z.string().optional(),
});

/** Formato devolvido por `withTrace`. */
const toolResultSchema = z.union([
  z.object({ ok: z.literal(true), data: z.unknown(), trace: traceShape }),
  z.object({ ok: z.literal(false), error: z.string(), code: z.string(), trace: traceShape }),
]);

/** Formato de erro de validação de entrada do Mastra (tool não executada). */
const validationErrorSchema = z.object({ error: z.literal(true), message: z.string() });

const cardsSchema = z.array(ticketCardSchema.passthrough());
const optionsSchema = z.object({ question: z.string(), options: z.array(z.string()).min(2).max(6) });
const draftDataSchema = z.object({ draftId: z.string() });
const handoffDataSchema = z.object({ reason: z.string() });

function toCard(value: z.infer<typeof ticketCardSchema>): TicketCard {
  return ticketCardSchema.parse(value);
}

function ticketsPart(cards: TicketCard[]): ChatPart | null {
  if (cards.length === 0) return null;
  if (cards.length === 1 && cards[0]) return { type: "ticket", ticket: cards[0] };
  return { type: "tickets", tickets: cards };
}

function isToolName(name: string): name is ToolName {
  return name in TOOL_LABELS;
}

/** Primeira linha útil da mensagem de validação do Mastra (sem eco dos argumentos). */
function validationMessage(message: string): string {
  const lines = message.split("\n").map((line) => line.trim());
  const details = lines.filter((line) => line.startsWith("- ")).map((line) => line.slice(2));
  return `Argumentos recusados pela validação${details.length ? `: ${details.join("; ")}` : ""}.`;
}

/**
 * Extrai do turno, a partir dos resultados das tools (nunca do texto): os passos de trace, a decisão
 * (ou uma sintética `other/low` se o modelo não registrou) e as partes estruturadas para a UI.
 */
export function collectTurn(input: { text: string; toolResults: RawToolResult[] }): CollectedTurn {
  const trace: TraceStep[] = [];
  const parts: ChatPart[] = [];
  let decision: Decision | null = null;
  let handedOff = false;
  let ticketsUnavailable = false;

  for (const raw of input.toolResults) {
    const parsed = toolResultSchema.safeParse(raw.result);
    if (!parsed.success) {
      const validation = validationErrorSchema.safeParse(raw.result);
      trace.push({
        tool: raw.toolName,
        label: isToolName(raw.toolName) ? TOOL_LABELS[raw.toolName] : raw.toolName,
        input: raw.args ?? null,
        output: null,
        durationMs: 0,
        error: validation.success ? validationMessage(validation.data.message) : "Resultado inválido da ação.",
      });
      continue;
    }
    const result = parsed.data;
    trace.push(result.trace);
    if (!result.ok) {
      if (result.code === "tickets_unavailable") ticketsUnavailable = true;
      continue;
    }

    switch (raw.toolName) {
      case "list_my_tickets":
      case "find_similar_tickets": {
        const cards = cardsSchema.safeParse(result.data);
        const part = cards.success ? ticketsPart(cards.data.map(toCard)) : null;
        if (part) parts.push(part);
        break;
      }
      case "get_ticket": {
        const card = ticketCardSchema.passthrough().safeParse(result.data);
        if (card.success) parts.push({ type: "ticket", ticket: toCard(card.data) });
        break;
      }
      case "draft_ticket":
      case "draft_ticket_update": {
        const draft = draftDataSchema.safeParse(result.data);
        if (draft.success) parts.push({ type: "draft", draftId: draft.data.draftId });
        break;
      }
      case "offer_options": {
        const options = optionsSchema.safeParse(result.data);
        if (options.success) parts.push({ type: "options", ...options.data });
        break;
      }
      case "handoff_to_human": {
        const handoff = handoffDataSchema.safeParse(result.data);
        handedOff = true;
        parts.push({ type: "handoff", reason: handoff.success ? handoff.data.reason : "Transferência" });
        break;
      }
      case "report_decision": {
        const parsedDecision = decisionSchema.safeParse(result.data);
        if (parsedDecision.success) decision = parsedDecision.data;
        break;
      }
    }
  }

  if (ticketsUnavailable) parts.push({ type: "notice", code: "tickets_unavailable" });

  let text = input.text.trim();
  if (text === "") {
    if (handedOff) text = "Transferi a conversa para um analista. Ele vai continuar o atendimento por aqui.";
    else if (parts.some((part) => part.type === "draft")) text = "Preparei o rascunho abaixo. Confira e confirme se estiver certo.";
    else if (ticketsUnavailable) text = "O sistema de chamados está indisponível no momento. Tente novamente em alguns minutos.";
  }

  return {
    text,
    trace,
    decision: decision ?? MISSING_DECISION,
    decisionMissing: decision === null,
    parts,
    handedOff,
  };
}

export type ProviderErrorCode = "provider_rate_limited" | "provider_unavailable";

export const PROVIDER_ERROR_MESSAGES: Record<ProviderErrorCode, string> = {
  provider_rate_limited: "Muitas requisições no momento, tente em instantes.",
  provider_unavailable: "O assistente está indisponível no momento. Tente novamente em instantes.",
};

function findStatus(error: unknown, depth = 0): number | null {
  if (depth > 6 || typeof error !== "object" || error === null) return null;
  const record = error as Record<string, unknown>;
  for (const key of ["statusCode", "status"]) {
    const value = record[key];
    if (typeof value === "number" && value >= 100 && value < 600) return value;
  }
  for (const key of ["cause", "lastError", "error", "details"]) {
    const nested = findStatus(record[key], depth + 1);
    if (nested !== null) return nested;
  }
  if (Array.isArray(record.errors)) {
    for (const item of record.errors) {
      const nested = findStatus(item, depth + 1);
      if (nested !== null) return nested;
    }
  }
  return null;
}

function mentionsRateLimit(error: unknown): boolean {
  const text = error instanceof Error ? `${error.message} ${String(error.cause ?? "")}` : String(error);
  return /\b429\b|rate.?limit|quota|RESOURCE_EXHAUSTED|too many requests/i.test(text);
}

/** 429 → limite do provedor; 5xx, rede ou desconhecido → provedor indisponível. */
export function classifyProviderError(error: unknown): ProviderErrorCode {
  const status = findStatus(error);
  if (status === 429 || (status === null && mentionsRateLimit(error))) return "provider_rate_limited";
  return "provider_unavailable";
}
