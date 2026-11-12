import { createDb, type Db } from "../db/client";
import { env } from "../env";

/** Uma conexão por processo (sobrevive ao HMR do `next dev`). */
const globalForDb = globalThis as typeof globalThis & { __nexoWebDb?: Db };

export function getDb(): Db {
  globalForDb.__nexoWebDb ??= createDb(env.WEB_DATABASE_FILE);
  return globalForDb.__nexoWebDb;
}
