import { z } from "zod";

/** Mesmo token padrão de desenvolvimento do tickets-api; nunca aceito em produção. */
export const DEV_SERVICE_TOKEN = "dev-service-token";
const DEV_SESSION_SECRET = "dev-session-secret-nao-use-em-producao-0123456789";

export const DEFAULT_LLM_MODEL = "google/gemini-3.5-flash-lite";

const optionalNonEmpty = z
  .string()
  .optional()
  .transform((value) => (value === undefined || value.trim() === "" ? undefined : value.trim()));

// Só servidor: nada aqui é exposto como NEXT_PUBLIC_*.
const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    TICKETS_API_URL: z.url().default("http://localhost:3001"),
    SERVICE_TOKEN: optionalNonEmpty,
    SESSION_SECRET: optionalNonEmpty,
    WEB_DATABASE_FILE: z.string().min(1).default("web.db"),
    LLM_MODEL: z
      .string()
      .regex(/^[a-z0-9-]+\/[\w.-]+$/, "use o formato provedor/modelo (ex.: google/gemini-3.5-flash-lite)")
      .default(DEFAULT_LLM_MODEL),
    GOOGLE_GENERATIVE_AI_API_KEY: optionalNonEmpty,
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
    if (value.SESSION_SECRET === undefined || value.SESSION_SECRET.length < 32) {
      ctx.addIssue({
        code: "custom",
        path: ["SESSION_SECRET"],
        message: "obrigatório em produção, com pelo menos 32 caracteres",
      });
    }
  })
  .transform((value) => ({
    ...value,
    SERVICE_TOKEN: value.SERVICE_TOKEN ?? DEV_SERVICE_TOKEN,
    SESSION_SECRET: value.SESSION_SECRET ?? DEV_SESSION_SECRET,
  }));

export type Env = z.infer<typeof envSchema>;

/** Valida as variáveis de ambiente; lança erro nomeando cada variável inválida. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Variáveis de ambiente inválidas no web:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export const env = parseEnv(process.env);
