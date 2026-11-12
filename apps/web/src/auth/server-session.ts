import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "../env";
import { SESSION_COOKIE, homeFor, isAnalyst, verifySession, type Session } from "./session";

/** Sessão atual em Server Components; `null` sem cookie válido. */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value, env.SESSION_SECRET, new Date());
}

/** Exige sessão do papel certo; senão redireciona (defesa em profundidade além do proxy). */
export async function requireSession(area: "chat" | "console"): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  const analyst = isAnalyst(session.role);
  if ((area === "chat" && analyst) || (area === "console" && !analyst)) redirect(homeFor(session.role));
  return session;
}
