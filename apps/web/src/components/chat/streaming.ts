import { TOOL_LABELS, traceStepSchema, type AgentToolName } from "@nexo/shared";
import { z } from "zod";
import type { ChipStep } from "./trace-panel";

/** Parte de tool de uma mensagem do `useChat` (estática `tool-<nome>` ou `dynamic-tool`). */
const toolPartSchema = z.object({
  type: z.string(),
  toolName: z.string().optional(),
  state: z.string().optional(),
  input: z.unknown().optional(),
  output: z.unknown().optional(),
  errorText: z.string().optional(),
});

const toolOutputSchema = z.object({ trace: traceStepSchema });

function labelFor(toolName: string): string {
  return toolName in TOOL_LABELS ? TOOL_LABELS[toolName as AgentToolName] : toolName;
}

/**
 * Converte as partes de tool em streaming em chips: rodando (sem saída ainda) ou concluídos, com o
 * `TraceStep` que a própria tool devolveu.
 */
export function streamingSteps(parts: readonly unknown[]): ChipStep[] {
  const steps: ChipStep[] = [];
  for (const raw of parts) {
    const part = toolPartSchema.safeParse(raw);
    if (!part.success) continue;
    const { type } = part.data;
    if (!type.startsWith("tool-") && type !== "dynamic-tool") continue;
    const toolName = type === "dynamic-tool" ? (part.data.toolName ?? "tool") : type.slice("tool-".length);
    const traced = toolOutputSchema.safeParse(part.data.output);
    if (traced.success) {
      steps.push(traced.data.trace);
      continue;
    }
    const finished = part.data.state === "output-available" || part.data.state === "output-error";
    steps.push({
      tool: toolName,
      label: labelFor(toolName),
      input: part.data.input ?? null,
      output: finished ? (part.data.output ?? null) : null,
      durationMs: 0,
      running: !finished,
      ...(part.data.state === "output-error" ? { error: part.data.errorText ?? "Falhou." } : {}),
    });
  }
  return steps;
}

/** Texto acumulado das partes de texto. */
export function streamingText(parts: readonly unknown[]): string {
  return parts
    .map((part) =>
      typeof part === "object" && part !== null && "type" in part && part.type === "text" && "text" in part && typeof part.text === "string"
        ? part.text
        : "",
    )
    .join("");
}
