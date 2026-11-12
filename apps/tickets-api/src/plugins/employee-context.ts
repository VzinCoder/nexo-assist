import { employeeIdSchema } from "@nexo/shared";
import { eq } from "drizzle-orm";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Db } from "../db/client";
import { employees, type EmployeeRow } from "../db/schema";
import { AppError } from "./errors";

declare module "fastify" {
  interface FastifyRequest {
    /** Funcionário de `X-Employee-Id`; preenchido nas rotas de chamados. */
    employee: EmployeeRow | null;
  }
}

/**
 * Exige `X-Employee-Id` de um funcionário existente em todas as rotas do escopo e decora
 * `request.employee`. Ausente ou malformado → 400; inexistente → 401.
 */
export function registerEmployeeContext(scope: FastifyInstance, db: Db): void {
  scope.decorateRequest("employee", null);
  scope.addHook("preHandler", async (request) => {
    const parsed = employeeIdSchema.safeParse(request.headers["x-employee-id"]);
    if (!parsed.success) {
      throw new AppError(
        "invalid_request",
        "Header X-Employee-Id ausente ou inválido (formato emp-NNN).",
      );
    }
    const employee = db.select().from(employees).where(eq(employees.id, parsed.data)).get();
    if (!employee) {
      throw new AppError("unauthorized", "Funcionário de X-Employee-Id não encontrado.");
    }
    request.employee = employee;
  });
}

/** Funcionário da requisição; só use em rotas registradas após `registerEmployeeContext`. */
export function currentEmployee(request: FastifyRequest): EmployeeRow {
  if (!request.employee) {
    throw new Error("currentEmployee chamado fora do escopo de registerEmployeeContext.");
  }
  return request.employee;
}
