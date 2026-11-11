import { z } from "zod";

// Só servidor: nada aqui é exposto como NEXT_PUBLIC_*.
const envSchema = z.object({
  TICKETS_API_URL: z.url().default("http://localhost:3001"),
});

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
