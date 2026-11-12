import { DatabaseSync } from "node:sqlite";
import { drizzle, type NodeSQLiteDatabase } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";
import { MIGRATIONS_DIR, resolveDatabaseFile } from "../paths";

export type Db = NodeSQLiteDatabase & { $client: DatabaseSync };

/**
 * Abre o SQLite (`node:sqlite`, sem build nativo), liga as chaves estrangeiras e aplica as
 * migrações pendentes. Use `:memory:` nos testes.
 */
export function createDb(file: string): Db {
  const client = new DatabaseSync(resolveDatabaseFile(file));
  client.exec("PRAGMA foreign_keys = ON;");
  client.exec("PRAGMA journal_mode = WAL;");
  const db = drizzle({ client });
  const failure = migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  if (failure) {
    client.close();
    throw new Error(`Falha ao aplicar as migrações do banco: ${JSON.stringify(failure)}`);
  }
  return db;
}
