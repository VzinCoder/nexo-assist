import { fileURLToPath } from "node:url";
import { isAbsolute, join } from "node:path";

/**
 * Raiz do app (`apps/tickets-api`). Este módulo fica um nível abaixo dela tanto em `src/`
 * quanto no bundle `dist/server.js`, então `..` resolve para o mesmo lugar nos dois casos.
 */
export const APP_ROOT = fileURLToPath(new URL("..", import.meta.url));

/** Migrações SQL versionadas geradas pelo drizzle-kit. */
export const MIGRATIONS_DIR = join(APP_ROOT, "drizzle");

/** Caminho do banco: `:memory:` e absolutos ficam como estão; relativos partem da raiz do app. */
export function resolveDatabaseFile(file: string): string {
  if (file === ":memory:" || isAbsolute(file)) return file;
  return join(APP_ROOT, file);
}
