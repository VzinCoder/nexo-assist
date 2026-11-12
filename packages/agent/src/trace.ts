import {
  TicketConflictError,
  TicketNotFoundError,
  TicketsClientError,
  TicketsUnavailableError,
  type TraceStep,
} from "@nexo/shared";
import { ZodError } from "zod";

/** Códigos de erro que a rota e a UI sabem tratar (ex.: aviso de sistema indisponível). */
export type ToolErrorCode =
  | "tickets_unavailable"
  | "not_found"
  | "conflict"
  | "invalid_input"
  | "refused"
  | "internal_error";

export type ToolResult<T> =
  | { ok: true; data: T; trace: TraceStep }
  | { ok: false; error: string; code: ToolErrorCode; trace: TraceStep };

/** Recusa por regra de negócio (ex.: reabrir fora da janela); a mensagem vai ao modelo e ao trace. */
export class ToolRefusal extends Error {
  override name = "ToolRefusal";
}

/** Converte qualquer erro numa mensagem legível em pt-BR, sem detalhes internos. */
export function describeError(error: unknown): { message: string; code: ToolErrorCode } {
  if (error instanceof TicketsUnavailableError) {
    return { code: "tickets_unavailable", message: "Sistema de chamados indisponível no momento." };
  }
  if (error instanceof TicketNotFoundError) {
    return { code: "not_found", message: "Chamado não encontrado entre os chamados deste funcionário." };
  }
  if (error instanceof TicketConflictError) {
    return { code: "conflict", message: error.message };
  }
  if (error instanceof ToolRefusal) {
    return { code: "refused", message: error.message };
  }
  if (error instanceof ZodError) {
    const fields = error.issues.map((issue) => issue.path.join(".") || "entrada").join(", ");
    return { code: "invalid_input", message: `Dados inválidos (${fields}). Pergunte ao funcionário o que falta.` };
  }
  if (error instanceof TicketsClientError) {
    return { code: "internal_error", message: "O sistema de chamados recusou a operação." };
  }
  return { code: "internal_error", message: "Erro inesperado ao executar a ação." };
}

type TraceOptions<T> = {
  tool: string;
  /** Rótulo curto do chip; pode depender do resultado ("Abriu o chamado INC-20311"). */
  label: string | ((data: T | undefined) => string);
  input: unknown;
  run: () => Promise<T>;
  /** Versão resumida do resultado para o trace (sem descrições longas). */
  summarize?: (data: T) => unknown;
  clock?: () => number;
};

/**
 * Envolve a execução de uma tool: mede a duração, captura erros (nunca relança para o modelo) e
 * devolve resultado + `TraceStep`.
 */
export async function withTrace<T>(options: TraceOptions<T>): Promise<ToolResult<T>> {
  const clock = options.clock ?? (() => performance.now());
  const started = clock();
  const labelFor = (data: T | undefined) =>
    typeof options.label === "function" ? options.label(data) : options.label;
  try {
    const data = await options.run();
    return {
      ok: true,
      data,
      trace: {
        tool: options.tool,
        label: labelFor(data),
        input: options.input,
        output: options.summarize ? options.summarize(data) : data,
        durationMs: Math.max(0, Math.round(clock() - started)),
      },
    };
  } catch (error) {
    const { message, code } = describeError(error);
    return {
      ok: false,
      error: message,
      code,
      trace: {
        tool: options.tool,
        label: labelFor(undefined),
        input: options.input,
        output: null,
        durationMs: Math.max(0, Math.round(clock() - started)),
        error: message,
      },
    };
  }
}
