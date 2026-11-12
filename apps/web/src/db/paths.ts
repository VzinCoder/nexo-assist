import { existsSync } from "node:fs";
import { isAbsolute, join } from "node:path";

/**
 * Raiz do app web. O Next roda com cwd em `apps/web`; vitest e scripts podem rodar da raiz do
 * monorepo. Procuramos a pasta `drizzle/` nos dois lugares em vez de depender de `import.meta.url`,
 * que muda depois do bundle do Next.
 */
function findAppRoot(): string {
  const candidates = [process.cwd(), join(process.cwd(), "apps", "web")];
  for (const dir of candidates) {
    if (existsSync(join(dir, "drizzle")) && existsSync(join(dir, "next.config.ts"))) return dir;
  }
  throw new Error("Não foi possível localizar apps/web (pasta drizzle/ com as migrações).");
}

export const APP_ROOT = findAppRoot();
export const MIGRATIONS_DIR = join(APP_ROOT, "drizzle");

/** `:memory:` e absolutos ficam como estão; relativos partem da raiz do app web. */
export function resolveDatabaseFile(file: string): string {
  if (file === ":memory:" || isAbsolute(file)) return file;
  return join(APP_ROOT, file);
}
