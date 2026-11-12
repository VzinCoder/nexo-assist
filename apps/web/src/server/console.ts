import { createConsoleHandlers } from "../console/console-handler";
import { env } from "../env";
import { tickets } from "../tickets";
import { getDb } from "./db";

export const consoleHandlers = createConsoleHandlers({ getDb, tickets, sessionSecret: env.SESSION_SECRET });
