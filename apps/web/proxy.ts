import { NextResponse, type NextRequest } from "next/server";
import { decideProxy } from "./src/auth/proxy-decision";
import { SESSION_COOKIE, verifySession } from "./src/auth/session";
import { env } from "./src/env";

export async function proxy(request: NextRequest) {
  const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value, env.SESSION_SECRET, new Date());
  const decision = decideProxy(request.nextUrl.pathname, session);
  if (decision.type === "unauthorized") {
    return NextResponse.json({ error: { code: "unauthorized", message: "Sessão expirada. Entre novamente." } }, { status: 401 });
  }
  if (decision.type === "redirect") return NextResponse.redirect(new URL(decision.to, request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico|webp)$).*)"],
};
