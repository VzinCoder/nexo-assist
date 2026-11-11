import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";

/**
 * Cria a instância do Fastify com as rotas registradas, sem abrir porta.
 * `/health` fica na raiz, fora dos plugins de identificação/instabilidade que virão depois.
 */
export function buildApp(options: FastifyServerOptions = {}): FastifyInstance {
  const app = Fastify(options);

  app.get("/health", async () => ({ status: "ok" as const }));

  app.setNotFoundHandler((request, reply) => {
    void reply.code(404).send({
      error: "not_found",
      message: `Rota ${request.method} ${request.url} não existe.`,
    });
  });

  return app;
}
