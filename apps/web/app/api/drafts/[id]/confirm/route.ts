import { draftHandlers } from "@/server/drafts";

export async function POST(request: Request, context: RouteContext<"/api/drafts/[id]/confirm">) {
  const { id } = await context.params;
  return draftHandlers.confirm(request, id);
}
