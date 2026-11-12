import { createLogoutHandler } from "@/auth/login";
import { env } from "@/env";

export const POST = createLogoutHandler({ secureCookies: env.NODE_ENV === "production" });
