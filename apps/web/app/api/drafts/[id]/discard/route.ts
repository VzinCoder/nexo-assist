import { draftHandlers } from "@/server/drafts";

export async function POST(request: Request, context: RouteContext<"/api/drafts/[id]/discard">) {
  const { id } = await context.params;
  return draftHandlers.discard(request, id);
}
