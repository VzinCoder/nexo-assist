import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import { registerErrorHandlers } from "./plugins/errors";

/**
 * Cria a instância do Fastify com as rotas registradas, sem abrir porta.
 * `/health` fica na raiz, fora dos plugins de identificação/instabilidade que virão depois.
 */
export function buildApp(options: FastifyServerOptions = {}): FastifyInstance {
  const app = Fastify(options);

  registerErrorHandlers(app);

  app.get("/health", async () => ({ status: "ok" as const }));

  return app;
}
