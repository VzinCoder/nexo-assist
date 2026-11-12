import { describe, expect, it } from "vitest";
import {
  TICKET_CATEGORY_LABELS,
  TICKET_STATUS_LABELS,
  createTicketBodySchema,
  employeeSchema,
  errorBodySchema,
  escalateBodySchema,
  ticketIdSchema,
  ticketSchema,
} from "./index";

const validBody = {
  title: "VPN não conecta",
  description: "Erro 809 no Windows 11",
  type: "INC",
  category: "network_vpn",
  priority: "high",
  affected: "me",
};

const validTicket = {
  id: "INC-20311",
  type: "INC",
  title: "Notebook lento",
  description: "Lento após atualização",
  category: "hardware",
  priority: "medium",
  status: "waiting_analyst",
  affected: "me",
  employeeId: "emp-001",
  createdAt: "2026-11-04T13:00:00.000Z",
  updatedAt: "2026-11-05T13:00:00.000Z",
  resolvedAt: null,
  dueAt: "2026-11-10T13:00:00.000Z",
  isOverdue: true,
  comments: [
    {
      id: 1,
      authorId: "emp-001",
      authorName: "Mariana Costa",
      kind: "comment",
      text: "Continua lento.",
      createdAt: "2026-11-05T13:00:00.000Z",
    },
  ],
};

describe("schemas de chamado", () => {
  it("aceita um body de criação válido e remove espaços das pontas", () => {
    const parsed = createTicketBodySchema.parse({ ...validBody, title: "  VPN não conecta  " });
    expect(parsed.title).toBe("VPN não conecta");
  });

  it("rejeita body sem category citando o campo", () => {
    const { category: _omit, ...withoutCategory } = validBody;
    const result = createTicketBodySchema.safeParse(withoutCategory);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toContain("category");
  });

  it("rejeita título só com espaços", () => {
    expect(createTicketBodySchema.safeParse({ ...validBody, title: "   " }).success).toBe(false);
  });

  it("rejeita transferência sem summary", () => {
    expect(escalateBodySchema.safeParse({ reason: "Vencido" }).success).toBe(false);
  });

  it.each(["INC-20311", "REQ-10442"])("aceita id %s", (id) => {
    expect(ticketIdSchema.safeParse(id).success).toBe(true);
  });

  it.each(["abc", "INC-2031", "INC-203111", "ABC-12345", "inc-20311"])("rejeita id %s", (id) => {
    expect(ticketIdSchema.safeParse(id).success).toBe(false);
  });

  it("aceita um chamado completo com comentários", () => {
    expect(ticketSchema.parse(validTicket).comments).toHaveLength(1);
  });

  it("rejeita chamado com status desconhecido", () => {
    expect(ticketSchema.safeParse({ ...validTicket, status: "pending" }).success).toBe(false);
  });
});

describe("schemas gerais", () => {
  it("valida funcionário com role", () => {
    const employee = {
      id: "emp-001",
      name: "Mariana Costa",
      email: "mariana.costa@nexo.com.br",
      department: "Financeiro",
      role: "employee",
    };
    expect(employeeSchema.parse(employee)).toEqual(employee);
    expect(employeeSchema.safeParse({ ...employee, role: "admin" }).success).toBe(false);
  });

  it("valida o formato de erro", () => {
    expect(
      errorBodySchema.safeParse({ error: { code: "not_found", message: "Não encontrado." } }).success,
    ).toBe(true);
    expect(errorBodySchema.safeParse({ error: "not_found" }).success).toBe(false);
  });

  it("tem rótulos em português", () => {
    expect(TICKET_CATEGORY_LABELS.network_vpn).toBe("Rede e VPN");
    expect(TICKET_STATUS_LABELS.waiting_analyst).toBe("Aguardando analista");
  });
});
