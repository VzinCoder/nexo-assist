import { z } from "zod";

/** Token padrão de desenvolvimento; nunca aceito com NODE_ENV=production. */
export const DEV_SERVICE_TOKEN = "dev-service-token";

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    HOST: z.string().min(1).default("0.0.0.0"),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    SERVICE_TOKEN: z.string().min(1).optional(),
    DATABASE_FILE: z.string().min(1).default("tickets.db"),
    FAILURE_RATE: z.coerce.number().min(0).max(1).default(0),
    LATENCY_MS: z.coerce.number().int().min(0).default(0),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV !== "production") return;
    if (value.SERVICE_TOKEN === undefined || value.SERVICE_TOKEN.length < 16) {
      ctx.addIssue({
        code: "custom",
        path: ["SERVICE_TOKEN"],
        message: "obrigatório em produção, com pelo menos 16 caracteres",
      });
    }
  })
  .transform((value) => ({
    ...value,
    SERVICE_TOKEN: value.SERVICE_TOKEN ?? DEV_SERVICE_TOKEN,
  }));

export type Env = z.infer<typeof envSchema>;

/** Valida as variáveis de ambiente; lança erro nomeando cada variável inválida. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Variáveis de ambiente inválidas no tickets-api:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export const env = parseEnv(process.env);
