import { createHash, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { AppError } from "./errors";

const digest = (value: string) => createHash("sha256").update(value).digest();

/** Compara em tempo constante; o hash garante buffers do mesmo tamanho. */
export function tokensMatch(received: string, expected: string): boolean {
  return timingSafeEqual(digest(received), digest(expected));
}

/** Exige `X-Service-Token` igual ao token configurado em todas as rotas do escopo. */
export function registerServiceAuth(scope: FastifyInstance, serviceToken: string): void {
  const expected = serviceToken;
  scope.addHook("onRequest", async (request) => {
    const received = request.headers["x-service-token"];
    if (typeof received !== "string" || !tokensMatch(received, expected)) {
      throw new AppError("unauthorized", "Token de serviço ausente ou inválido.");
    }
  });
}
