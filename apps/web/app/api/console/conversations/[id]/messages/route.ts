import { consoleHandlers } from "@/server/console";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: RouteContext<"/api/console/conversations/[id]/messages">) {
  const { id } = await context.params;
  return consoleHandlers.message(request, id);
}
