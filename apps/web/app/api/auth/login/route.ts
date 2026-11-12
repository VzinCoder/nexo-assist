import { createLoginHandler } from "@/auth/login";
import { env } from "@/env";
import { tickets } from "@/tickets";

export const POST = createLoginHandler({
  tickets,
  sessionSecret: env.SESSION_SECRET,
  secureCookies: env.NODE_ENV === "production",
});
