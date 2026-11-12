import { createDb } from "../db/client";
import { env } from "../env";
import { resolveDatabaseFile } from "../paths";
import { buildSeed } from "./data";
import { applySeed } from "./apply";

const now = new Date();
const db = createDb(env.DATABASE_FILE);
try {
  applySeed(db, now);
  const seed = buildSeed(now);
  console.log(
    `Seed aplicado em ${resolveDatabaseFile(env.DATABASE_FILE)}: ` +
      `${seed.employees.length} funcionários, ${seed.articles.length} artigos, ` +
      `${seed.tickets.length} chamados, ${seed.comments.length} comentários.`,
  );
} finally {
  db.$client.close();
}
