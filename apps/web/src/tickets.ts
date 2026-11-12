import { createTicketsClient } from "@nexo/shared";
import { env } from "./env";

/** Cliente do tickets-api usado pelo web (só no servidor). */
export const tickets = createTicketsClient({
  baseUrl: env.TICKETS_API_URL,
  serviceToken: env.SERVICE_TOKEN,
});
