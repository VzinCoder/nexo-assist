import type { Ticket, TicketsClient } from "@nexo/shared";
import { vi } from "vitest";
import { createNexoRequestContext } from "./context";

/** Chamado de exemplo para os fakes (Ana, emp-001). */
export function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: "INC-20311",
    type: "INC",
    title: "Notebook lento após atualização",
    description: "Lentidão desde a atualização.",
    category: "hardware",
    priority: "medium",
    status: "open",
    affected: "me",
    employeeId: "emp-001",
    createdAt: "2026-10-16T17:20:00.000Z",
    updatedAt: "2026-10-16T17:20:00.000Z",
    resolvedAt: null,
    dueAt: "2026-10-21T17:20:00.000Z",
    isOverdue: true,
    comments: [],
    ...overrides,
  };
}

/** Cliente falso com `vi.fn` em todos os métodos (sobrescreva o que o teste precisar). */
export function fakeTicketsClient(overrides: Partial<TicketsClient> = {}) {
  const ticket = makeTicket();
  const client = {
    getEmployeeByEmail: vi.fn<TicketsClient["getEmployeeByEmail"]>(),
    searchArticles: vi.fn<TicketsClient["searchArticles"]>(async () => []),
    listTickets: vi.fn<TicketsClient["listTickets"]>(async () => [ticket]),
    getTicket: vi.fn<TicketsClient["getTicket"]>(async () => ticket),
    findSimilarTickets: vi.fn<TicketsClient["findSimilarTickets"]>(async () => []),
    createTicket: vi.fn<TicketsClient["createTicket"]>(async () => ticket),
    addComment: vi.fn<TicketsClient["addComment"]>(async () => ticket),
    reopenTicket: vi.fn<TicketsClient["reopenTicket"]>(async () => ticket),
    escalateTicket: vi.fn<TicketsClient["escalateTicket"]>(async () => ticket),
  };
  for (const [name, impl] of Object.entries(overrides)) {
    if (typeof impl === "function") client[name as keyof typeof client].mockImplementation(impl as never);
  }
  return client;
}

export const sessionContext = (employeeId = "emp-001", conversationId = "conv-1") => ({
  requestContext: createNexoRequestContext({ employeeId, conversationId }),
});

type Executable = { execute?: (input: never, context: never) => Promise<unknown> };

/** Executa uma tool como o Mastra faria (validação de entrada inclusa). */
export async function runTool(tool: Executable, input: unknown, context: unknown = sessionContext()) {
  if (!tool.execute) throw new Error("tool sem execute");
  return tool.execute(input as never, context as never);
}
