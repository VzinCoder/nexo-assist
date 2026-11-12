import { z } from "zod";

export const articleSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
  tags: z.array(z.string()),
});
export type Article = z.infer<typeof articleSchema>;

export const articleListSchema = z.array(articleSchema);

export const articleSearchQuerySchema = z.object({
  q: z.string().max(200).optional(),
});
