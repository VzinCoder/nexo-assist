import type { FastifyInstance } from "fastify";
import { AppError } from "./errors";

export type InstabilityOptions = {
  /** Fração das requisições que recebem 503 (0 a 1). */
  failureRate: number;
  /** Atraso em ms aplicado antes de cada requisição. */
  latencyMs: number;
  random: () => number;
  sleep: (ms: number) => Promise<void>;
};

/**
 * Simula o legado instável no escopo em que for registrado: primeiro a latência, depois o descarte
 * de requisições cujo cliente desistiu durante a espera, e por fim a falha 503 aleatória. Tudo
 * ocorre em `onRequest`, antes de qualquer efeito da rota.
 */
export function registerInstability(scope: FastifyInstance, options: InstabilityOptions): void {
  const { failureRate, latencyMs, random, sleep } = options;
  if (failureRate <= 0 && latencyMs <= 0) return;

  scope.addHook("onRequest", async (request) => {
    if (latencyMs > 0) {
      await sleep(latencyMs);
      if (request.raw.destroyed || request.socket.destroyed) {
        // O cliente já desistiu (ex.: timeout do retry): não executa a rota para não duplicar efeitos.
        throw new AppError("service_unavailable", "Requisição descartada: o cliente desconectou.");
      }
    }
    if (failureRate > 0 && random() < failureRate) {
      throw new AppError(
        "service_unavailable",
        "Sistema de chamados temporariamente indisponível. Tente novamente.",
      );
    }
  });
}
