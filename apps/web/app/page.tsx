import { redirect } from "next/navigation";
import { getSession } from "@/auth/server-session";
import { homeFor } from "@/auth/session";

/** `/` é só ponto de entrada: o proxy já redireciona; isto cobre o caso de ele não rodar. */
export default async function RootPage() {
  const session = await getSession();
  redirect(session ? homeFor(session.role) : "/login");
}
