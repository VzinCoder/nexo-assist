import type { ErrorBody, ErrorCode } from "@nexo/shared";
import type { FastifyInstance } from "fastify";
import { ZodError, z } from "zod";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  invalid_request: 400,
  unauthorized: 401,
  not_found: 404,
  conflict: 409,
  service_unavailable: 503,
  internal_error: 500,
};

/** Erro de domínio com código estável e mensagem em português para o cliente. */
export class AppError extends Error {
  readonly statusCode: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = STATUS_BY_CODE[code];
  }
}

export function errorBody(code: ErrorCode, message: string): ErrorBody {
  return { error: { code, message } };
}

function hasClientStatus(error: unknown): error is { statusCode: number; message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof error.statusCode === "number" &&
    error.statusCode >= 400 &&
    error.statusCode < 500
  );
}

/**
 * Registra, na instância raiz, o handler de erro e o de rota inexistente, ambos no formato
 * `{ error: { code, message } }`. Exceções não tratadas viram 500 sem stack no corpo.
 */
export function registerErrorHandlers(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send(errorBody(error.code, error.message));
    }
    if (error instanceof ZodError) {
      return reply
        .code(400)
        .send(errorBody("invalid_request", `Requisição inválida:\n${z.prettifyError(error)}`));
    }
    if (hasClientStatus(error)) {
      // Erros do próprio Fastify (JSON malformado, content-type não suportado, corpo grande).
      return reply
        .code(error.statusCode)
        .send(errorBody("invalid_request", `Requisição inválida: ${error.message}`));
    }
    request.log.error({ err: error }, "erro não tratado");
    return reply
      .code(500)
      .send(errorBody("internal_error", "Erro interno no sistema de chamados."));
  });

  app.setNotFoundHandler((request, reply) => {
    void reply
      .code(404)
      .send(errorBody("not_found", `Rota ${request.method} ${request.url} não existe.`));
  });
}
