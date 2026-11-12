import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import type { Db } from "./db/client";
import { registerErrorHandlers } from "./plugins/errors";
import { registerInstability } from "./plugins/instability";
import { registerServiceAuth } from "./plugins/service-auth";
import { registerEmployeeRoutes } from "./routes/employees";
import { registerKbRoutes } from "./routes/kb";

export type AppOptions = {
  db: Db;
  serviceToken: string;
  failureRate?: number;
  latencyMs?: number;
  /** Relógio injetável (testes usam um instante fixo). */
  now?: () => Date;
  random?: () => number;
  sleep?: (ms: number) => Promise<void>;
  logger?: FastifyServerOptions["logger"];
};

/** Dependências repassadas aos plugins de rotas. */
export type RouteDeps = {
  db: Db;
  now: () => Date;
};

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Cria a instância do Fastify sem abrir porta. Ordem: erros (raiz) → `/health` (raiz, livre) →
 * escopo protegido com instabilidade simulada e token de serviço, onde ficam as demais rotas.
 */
export function buildApp(options: AppOptions): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? false });
  const deps: RouteDeps = { db: options.db, now: options.now ?? (() => new Date()) };

  registerErrorHandlers(app);

  app.get("/health", async () => ({ status: "ok" as const }));

  void app.register(async (scope) => {
    registerInstability(scope, {
      failureRate: options.failureRate ?? 0,
      latencyMs: options.latencyMs ?? 0,
      random: options.random ?? Math.random,
      sleep: options.sleep ?? defaultSleep,
    });
    registerServiceAuth(scope, options.serviceToken);

    registerEmployeeRoutes(scope, deps);
    registerKbRoutes(scope, deps);
  });

  return app;
}
