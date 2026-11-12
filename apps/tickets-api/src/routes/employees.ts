import { employeeEmailParamsSchema, type Employee } from "@nexo/shared";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { RouteDeps } from "../app";
import { employees } from "../db/schema";
import { AppError } from "../plugins/errors";

/** `GET /employees/by-email/:email` — e-mail comparado sem diferenciar maiúsculas. */
export function registerEmployeeRoutes(scope: FastifyInstance, { db }: RouteDeps): void {
  scope.get("/employees/by-email/:email", async (request): Promise<Employee> => {
    const { email } = employeeEmailParamsSchema.parse(request.params);
    const employee = db
      .select()
      .from(employees)
      .where(eq(employees.email, email.toLowerCase()))
      .get();
    if (!employee) {
      throw new AppError("not_found", "Nenhum funcionário com esse e-mail.");
    }
    return employee;
  });
}
