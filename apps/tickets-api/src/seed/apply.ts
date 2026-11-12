import { sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { articles, employees, ticketComments, tickets } from "../db/schema";
import { buildSeed } from "./data";

/** Apaga todos os dados e insere o seed, numa única transação. */
export function applySeed(db: Db, now: Date): void {
  const seed = buildSeed(now);
  db.transaction((tx) => {
    tx.delete(ticketComments).run();
    tx.delete(tickets).run();
    tx.delete(articles).run();
    tx.delete(employees).run();
    // Zera o autoincremento para que reaplicar gere os mesmos ids de comentário.
    tx.run(sql`DELETE FROM sqlite_sequence WHERE name = 'ticket_comments'`);

    tx.insert(employees).values(seed.employees).run();
    tx.insert(articles).values(seed.articles).run();
    tx.insert(tickets).values(seed.tickets).run();
    tx.insert(ticketComments).values(seed.comments).run();
  });
}

/** `true` quando o banco ainda não tem nenhum funcionário (primeira execução). */
export function isDatabaseEmpty(db: Db): boolean {
  return db.select({ id: employees.id }).from(employees).limit(1).all().length === 0;
}
