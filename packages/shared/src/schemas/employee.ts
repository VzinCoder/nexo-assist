import { z } from "zod";

export const EMPLOYEE_ROLES = ["employee", "analyst_n1", "analyst_n2"] as const;
export const employeeRoleSchema = z.enum(EMPLOYEE_ROLES);
export type EmployeeRole = z.infer<typeof employeeRoleSchema>;

export const EMPLOYEE_ROLE_LABELS: Record<EmployeeRole, string> = {
  employee: "Funcionário",
  analyst_n1: "Analista N1",
  analyst_n2: "Analista N2",
};

/** Id estável de funcionário/analista (ex.: `emp-001`). */
export const employeeIdSchema = z
  .string()
  .regex(/^emp-\d{3,}$/, "Id de funcionário deve seguir o padrão emp-NNN.");

export const employeeSchema = z.object({
  id: employeeIdSchema,
  name: z.string().min(1),
  email: z.email(),
  department: z.string().min(1),
  role: employeeRoleSchema,
});
export type Employee = z.infer<typeof employeeSchema>;

export const employeeEmailParamsSchema = z.object({
  email: z.email("E-mail inválido."),
});
