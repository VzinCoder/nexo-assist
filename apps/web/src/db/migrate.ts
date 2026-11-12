import { env } from "../env";
import { createDb } from "./client";
import { resolveDatabaseFile } from "./paths";

// `createDb` já aplica as migrações pendentes ao abrir o banco; aqui só abrimos e fechamos.
const db = createDb(env.WEB_DATABASE_FILE);
db.$client.close();
console.log(`Migrações do web aplicadas em ${resolveDatabaseFile(env.WEB_DATABASE_FILE)}.`);
