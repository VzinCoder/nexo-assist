import { env } from "./env";
import { buildApp } from "./app";

const app = buildApp({ logger: { level: env.LOG_LEVEL } });

try {
  await app.listen({ port: env.PORT, host: env.HOST });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
