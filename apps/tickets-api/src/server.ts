import { env } from "./env";
import { buildApp } from "./app";
import { createDb } from "./db/client";
import { applySeed, isDatabaseEmpty } from "./seed/apply";

const db = createDb(env.DATABASE_FILE);
const app = buildApp({
  db,
  serviceToken: env.SERVICE_TOKEN,
  failureRate: env.FAILURE_RATE,
  latencyMs: env.LATENCY_MS,
  logger: { level: env.LOG_LEVEL },
});

if (isDatabaseEmpty(db)) {
  applySeed(db, new Date());
  app.log.info("Banco vazio: dados de exemplo aplicados.");
}
if (env.FAILURE_RATE > 0 || env.LATENCY_MS > 0) {
  app.log.warn(
    { failureRate: env.FAILURE_RATE, latencyMs: env.LATENCY_MS },
    "Simulação de instabilidade do legado ativa.",
  );
}

app.addHook("onClose", () => {
  db.$client.close();
});

try {
  await app.listen({ port: env.PORT, host: env.HOST });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
