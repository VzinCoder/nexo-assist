import { DatabaseSync } from "node:sqlite";
import { drizzle, type NodeSQLiteDatabase } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";
import { MIGRATIONS_DIR, resolveDatabaseFile } from "./paths";

export type Db = NodeSQLiteDatabase & { $client: DatabaseSync };

/** Abre o SQLite do web (`node:sqlite`), liga FKs e aplica migrações pendentes. `:memory:` nos testes. */
export function createDb(file: string): Db {
  const client = new DatabaseSync(resolveDatabaseFile(file));
  client.exec("PRAGMA foreign_keys = ON;");
  client.exec("PRAGMA journal_mode = WAL;");
  client.exec("PRAGMA busy_timeout = 3000;");
  const db = drizzle({ client });
  const failure = migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  if (failure) {
    client.close();
    throw new Error(`Falha ao aplicar as migrações do banco do web: ${JSON.stringify(failure)}`);
  }
  return db;
}
