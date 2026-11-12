import { consoleHandlers } from "@/server/console";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: RouteContext<"/api/console/conversations/[id]">) {
  const { id } = await context.params;
  return consoleHandlers.detail(request, id);
}
