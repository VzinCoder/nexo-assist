import { articleSearchQuerySchema, type Article } from "@nexo/shared";
import type { FastifyInstance } from "fastify";
import type { RouteDeps } from "../app";
import { articles } from "../db/schema";
import { rankByKeywords } from "../search/keywords";

const byTitle = (a: Article, b: Article) => a.title.localeCompare(b.title, "pt-BR");

/**
 * `GET /kb/articles?q=` — sem `q` (ou vazio), todos por título; com `q`, os que têm ao menos uma
 * palavra significativa em comum, do mais para o menos relevante.
 */
export function registerKbRoutes(scope: FastifyInstance, { db }: RouteDeps): void {
  scope.get("/kb/articles", async (request): Promise<Article[]> => {
    const { q } = articleSearchQuerySchema.parse(request.query);
    const all = db.select().from(articles).all();
    if (q === undefined || q.trim() === "") {
      return all.sort(byTitle);
    }
    return rankByKeywords(all, q, (a) => `${a.title} ${a.content} ${a.tags.join(" ")}`, byTitle).map(
      (entry) => entry.item,
    );
  });
}
