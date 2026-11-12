/**
 * Erro base do cliente do tickets-api. `status` é o HTTP recebido (ou `null` quando não houve
 * resposta); `code` vem do corpo de erro do serviço quando existir.
 */
export class TicketsClientError extends Error {
  override name = "TicketsClientError";

  constructor(
    readonly status: number | null,
    readonly code: string,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}

/** Serviço fora do ar, instável (503 após as tentativas) ou sem resposta dentro do timeout. */
export class TicketsUnavailableError extends TicketsClientError {
  override name = "TicketsUnavailableError";
}

/** 404: chamado (ou funcionário) inexistente ou de outro funcionário. */
export class TicketNotFoundError extends TicketsClientError {
  override name = "TicketNotFoundError";
}

/** 409: operação incompatível com o estado do chamado (ex.: reabrir fora da janela). */
export class TicketConflictError extends TicketsClientError {
  override name = "TicketConflictError";
}
