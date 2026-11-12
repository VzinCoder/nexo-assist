// Prepara o projeto para rodar localmente: `pnpm setup` na raiz.
// Só usa módulos nativos do Node, pois roda antes do `pnpm install`.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const APPS = ["tickets-api", "web"];

function step(message) {
  console.log(`\n> ${message}`);
}

function fail(message) {
  console.error(`\n[setup] ${message}`);
  process.exit(1);
}

/** Roda o pnpm que disparou este script (npm_execpath) ou, na falta dele, o do PATH. */
function pnpm(args) {
  const execPath = process.env.npm_execpath;
  const result =
    execPath && /\.[cm]?js$/.test(execPath)
      ? spawnSync(process.execPath, [execPath, ...args], { cwd: ROOT, stdio: "inherit" })
      : spawnSync(execPath || "pnpm", args, { cwd: ROOT, stdio: "inherit", shell: !execPath });
  if (result.error) fail(`não foi possível executar "pnpm ${args.join(" ")}": ${result.error.message}`);
  if (result.status !== 0) fail(`"pnpm ${args.join(" ")}" terminou com código ${result.status}.`);
}

// 1. Versão do Node: o projeto usa node:sqlite, disponível a partir do Node 24.
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const required = Number(/(\d+)/.exec(pkg.engines?.node ?? ">=24")?.[1] ?? 24);
const current = Number(process.versions.node.split(".")[0]);
step(`Verificando o Node (exigido: ${required} ou superior)`);
if (current < required) {
  fail(`Node ${process.versions.node} encontrado; instale o Node ${required} ou superior e rode de novo.`);
}
console.log(`Node ${process.versions.node}: ok.`);

// 2. Dependências.
step("Instalando dependências (pnpm install)");
pnpm(["install"]);

// 3. .env de cada app, só quando ainda não existe (nunca sobrescreve).
step("Criando os arquivos .env a partir dos .env.example");
for (const app of APPS) {
  const example = join(ROOT, "apps", app, ".env.example");
  const target = join(ROOT, "apps", app, ".env");
  const shown = relative(ROOT, target).replaceAll("\\", "/");
  if (existsSync(target)) {
    console.log(`${shown} já existe: mantido.`);
  } else {
    copyFileSync(example, target);
    console.log(`${shown} criado.`);
  }
}

// 4. Bancos: seed do tickets-api (recria os dados de exemplo) e migrações do web.
step("Recriando os dados de exemplo do tickets-api (seed)");
pnpm(["--filter", "@nexo/tickets-api", "seed"]);

step("Aplicando as migrações do banco do web");
pnpm(["--filter", "@nexo/web", "db:migrate"]);

const webEnv = readFileSync(join(ROOT, "apps", "web", ".env"), "utf8");
const hasKey = /^GOOGLE_GENERATIVE_AI_API_KEY=\S+/m.test(webEnv);
console.log("\nPronto.");
if (!hasKey) {
  console.log(
    "Falta a chave do Gemini: gere uma em https://aistudio.google.com (nível gratuito) e cole em\n" +
      "GOOGLE_GENERATIVE_AI_API_KEY no arquivo apps/web/.env.",
  );
}
console.log("Depois rode: pnpm dev (web em http://localhost:3000, tickets-api em http://localhost:3001).");
