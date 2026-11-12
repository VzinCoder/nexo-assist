import { z } from "zod";

/** Um passo de trace: o que uma tool (ou o modelo) fez, exibido como chip na UI. */
export const traceStepSchema = z.object({
  tool: z.string().min(1),
  label: z.string().min(1),
  input: z.unknown(),
  output: z.unknown(),
  durationMs: z.number().int().min(0),
  error: z.string().min(1).optional(),
});
export type TraceStep = z.infer<typeof traceStepSchema>;

export const DECISION_INTENTS = [
  "question",
  "ticket_status",
  "ticket_update",
  "ticket_create",
  "handoff",
  "out_of_scope",
  "other",
] as const;
export const decisionIntentSchema = z.enum(DECISION_INTENTS);
export type DecisionIntent = z.infer<typeof decisionIntentSchema>;

export const DECISION_CONFIDENCES = ["high", "medium", "low"] as const;
export const decisionConfidenceSchema = z.enum(DECISION_CONFIDENCES);
export type DecisionConfidence = z.infer<typeof decisionConfidenceSchema>;

/** Decisão estruturada que encerra toda resposta do agent. */
export const decisionSchema = z.object({
  intent: decisionIntentSchema,
  action: z.string().trim().min(1).max(300),
  confidence: decisionConfidenceSchema,
  reason: z.string().trim().min(1).max(500),
});
export type Decision = z.infer<typeof decisionSchema>;

export const DECISION_INTENT_LABELS: Record<DecisionIntent, string> = {
  question: "Dúvida",
  ticket_status: "Status de chamado",
  ticket_update: "Atualização de chamado",
  ticket_create: "Abertura de chamado",
  handoff: "Transferência para analista",
  out_of_scope: "Fora do escopo de TI",
  other: "Outro",
};

export const DECISION_CONFIDENCE_LABELS: Record<DecisionConfidence, string> = {
  high: "Alta",
  medium: "Média",
  low: "Baixa",
};
