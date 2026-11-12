import { TicketsUnavailableError, type Article } from "@nexo/shared";
import { describe, expect, it } from "vitest";
import { createMemoryPorts } from "./memory-ports";
import { fakeTicketsClient, makeTicket, runTool, sessionContext } from "./test-helpers";
import { createNexoTools } from "./tools";

const MONDAY_10H = new Date("2026-11-09T10:00:00-03:00");

function setup(overrides: Parameters<typeof fakeTicketsClient>[0] = {}, now = MONDAY_10H) {
  const tickets = fakeTicketsClient(overrides);
  const ports = createMemoryPorts();
  const tools = createNexoTools({
    tickets,
    drafts: ports.draftStore,
    conversations: ports.conversationStore,
    now: () => now,
  });
  return { tickets, ports, tools };
}

type Result = { ok: boolean; data?: unknown; error?: string; trace: { label: string; error?: string; output: unknown } };

describe("tools de consulta", () => {
  it("list_my_tickets usa o employeeId do contexto e marca vencido", async () => {
    const { tools, tickets } = setup();
    const result = (await runTool(tools.list_my_tickets, {}, sessionContext("emp-003"))) as Result;
    expect(tickets.listTickets).toHaveBeenCalledWith("emp-003", {});
    expect(result.ok).toBe(true);
    expect(result.trace.label).toBe("Consultou seus chamados");
    expect(result.trace.output).toEqual([
      { id: "INC-20311", title: "Notebook lento após atualização", status: "open", isOverdue: true },
    ]);
    expect((result.data as { isOverdue: boolean }[])[0]?.isOverdue).toBe(true);
  });

  it("rejeita argumento employeeId vindo do modelo sem chamar o serviço", async () => {
    const { tools, tickets } = setup();
    const result = (await runTool(tools.list_my_tickets, { employeeId: "emp-002" })) as { error: boolean; message: string };
    expect(result.error).toBe(true);
    expect(result.message).toMatch(/employeeId/);
    expect(tickets.listTickets).not.toHaveBeenCalled();

    const other = (await runTool(tools.get_ticket, { ticketId: "INC-20311", employeeId: "emp-002" })) as {
      error: boolean;
    };
    expect(other.error).toBe(true);
    expect(tickets.getTicket).not.toHaveBeenCalled();
  });

  it("sem contexto de sessão a tool falha em vez de agir em nome de alguém", async () => {
    const { tools, tickets } = setup();
    const result = (await runTool(tools.list_my_tickets, {}, {})) as Result;
    expect(result.ok).toBe(false);
    expect(tickets.listTickets).not.toHaveBeenCalled();
  });

  it("get_ticket normaliza o id e rotula 'Abriu o chamado X'", async () => {
    const { tools, tickets } = setup();
    const result = (await runTool(tools.get_ticket, { ticketId: "inc-20311" })) as Result;
    expect(tickets.getTicket).toHaveBeenCalledWith("emp-001", "INC-20311");
    expect(result.trace.label).toBe("Abriu o chamado INC-20311");
    expect(result.data).toMatchObject({ id: "INC-20311", isOverdue: true, description: expect.any(String) });
  });

  it("find_similar_tickets e search_help_center", async () => {
    const article: Article = { id: "kb-001", title: "VPN erro 809", content: "Só Windows 10", tags: ["vpn"] };
    const { tools, tickets } = setup({
      findSimilarTickets: async () => [{ ...makeTicket(), reopenable: false }],
      searchArticles: async () => [article],
    });
    const similar = (await runTool(tools.find_similar_tickets, { text: "notebook lento" })) as Result;
    expect(similar.trace.label).toBe("Verificou chamados parecidos");
    expect(similar.trace.output).toEqual([expect.objectContaining({ id: "INC-20311", reopenable: false })]);

    const kb = (await runTool(tools.search_help_center, { query: "VPN 809" })) as Result;
    expect(kb.trace).toMatchObject({ label: "Buscou na central de ajuda", output: [{ id: "kb-001", title: "VPN erro 809" }] });
    expect(tickets.searchArticles).toHaveBeenCalledWith("VPN 809");
  });

  it("sistema de chamados indisponível: erro no trace, sem dados inventados", async () => {
    const { tools } = setup({
      listTickets: async () => {
        throw new TicketsUnavailableError(503, "unavailable", "x");
      },
    });
    const result = (await runTool(tools.list_my_tickets, {})) as Result & { code: string };
    expect(result).toMatchObject({ ok: false, code: "tickets_unavailable" });
    expect(result.trace.error).toMatch(/indisponível/);
    expect(result.data).toBeUndefined();
  });
});

describe("rascunhos", () => {
  const fields = {
    title: "VPN não conecta — erro 809",
    description: "Windows 11, erro 809 desde ontem.",
    type: "INC",
    category: "network_vpn",
    priority: "high",
    affected: "me",
  };

  it("draft_ticket grava rascunho pendente com prazo e nunca cria o chamado", async () => {
    const { tools, tickets, ports } = setup();
    const result = (await runTool(tools.draft_ticket, fields)) as Result;
    expect(result.ok).toBe(true);
    expect(tickets.createTicket).not.toHaveBeenCalled();
    expect(ports.drafts).toHaveLength(1);
    expect(ports.drafts[0]).toMatchObject({ conversationId: "conv-1", kind: "create" });
    // Alta numa segunda às 10h (São Paulo) → 14h do mesmo dia.
    expect(ports.drafts[0]?.payload).toMatchObject({
      dueAt: new Date("2026-11-09T14:00:00-03:00").toISOString(),
      slaLabel: "4 horas úteis",
    });
  });

  it("draft_ticket sem categoria falha com erro de validação e não grava", async () => {
    const { tools, ports } = setup();
    const { category: _omit, ...withoutCategory } = fields;
    const result = (await runTool(tools.draft_ticket, withoutCategory)) as Result;
    expect(result.ok).toBe(false);
    expect(result.trace.error).toMatch(/category/);
    expect(ports.drafts).toHaveLength(0);
  });

  it("draft_ticket_update comment recusa chamado resolvido", async () => {
    const { tools, ports } = setup({
      getTicket: async () => makeTicket({ status: "resolved", resolvedAt: "2026-11-08T12:00:00.000Z" }),
    });
    const result = (await runTool(tools.draft_ticket_update, { ticketId: "INC-20311", kind: "comment", text: "x" })) as Result;
    expect(result.ok).toBe(false);
    expect(result.trace.error).toMatch(/resolvido/);
    expect(ports.drafts).toHaveLength(0);
  });

  it("reabertura dentro de 7 dias gera rascunho; fora da janela é recusada", async () => {
    const recent = setup({
      getTicket: async () =>
        makeTicket({ id: "INC-20150", status: "resolved", resolvedAt: "2026-11-06T12:00:00.000Z", isOverdue: false }),
    });
    const ok = (await runTool(recent.tools.draft_ticket_update, {
      ticketId: "INC-20150",
      kind: "reopen",
      text: "Bloqueou de novo",
    })) as Result;
    expect(ok.ok).toBe(true);
    expect(recent.ports.drafts[0]).toMatchObject({ kind: "reopen", payload: { ticketId: "INC-20150" } });
    expect(recent.tickets.reopenTicket).not.toHaveBeenCalled();

    const old = setup({
      getTicket: async () => makeTicket({ status: "resolved", resolvedAt: "2026-10-30T12:00:00.000Z" }),
    });
    const refused = (await runTool(old.tools.draft_ticket_update, {
      ticketId: "INC-20311",
      kind: "reopen",
      text: "x",
    })) as Result;
    expect(refused.ok).toBe(false);
    expect(refused.trace.error).toMatch(/prazo de reabertura/);
    expect(old.ports.drafts).toHaveLength(0);
  });
});

describe("opções, transferência e decisão", () => {
  it("offer_options aceita 2 a 6 opções", async () => {
    const { tools } = setup();
    const ok = (await runTool(tools.offer_options, {
      question: "Quem é afetado?",
      options: ["Só eu", "Minha equipe", "A empresa toda", "Não sei"],
    })) as Result;
    expect(ok.ok).toBe(true);
    const tooFew = (await runTool(tools.offer_options, { question: "Quem?", options: ["Só eu"] })) as { error: boolean };
    expect(tooFew.error).toBe(true);
  });

  it("handoff muda o status e escala só quando há ticketId", async () => {
    const { tools, tickets, ports } = setup();
    await runTool(tools.handoff_to_human, { reason: "Pedido do funcionário", summary: "Quer falar com alguém." });
    expect(ports.handoffs).toEqual([{ conversationId: "conv-1", reason: "Pedido do funcionário", summary: "Quer falar com alguém." }]);
    expect(tickets.escalateTicket).not.toHaveBeenCalled();

    const result = (await runTool(tools.handoff_to_human, {
      reason: "Chamado vencido",
      summary: "INC-20311 sem resposta há 5 dias.",
      ticketId: "INC-20311",
    })) as Result;
    expect(tickets.escalateTicket).toHaveBeenCalledWith("emp-001", "INC-20311", {
      reason: "Chamado vencido",
      summary: "INC-20311 sem resposta há 5 dias.",
    });
    expect(result.trace.error).toBeUndefined();
  });

  it("falha no escalate ainda transfere a conversa e registra o erro no trace", async () => {
    const { tools, ports } = setup({
      escalateTicket: async () => {
        throw new TicketsUnavailableError(503, "unavailable", "x");
      },
    });
    const result = (await runTool(tools.handoff_to_human, {
      reason: "Chamado vencido",
      summary: "Resumo",
      ticketId: "INC-20311",
    })) as Result;
    expect(ports.handoffs).toHaveLength(1);
    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ transferred: true, ticketEscalated: false });
    expect(result.trace.error).toMatch(/INC-20311/);
  });

  it("report_decision valida a decisão", async () => {
    const { tools } = setup();
    const ok = (await runTool(tools.report_decision, {
      intent: "question",
      action: "Respondeu com o artigo da VPN",
      confidence: "high",
      reason: "Artigo kb-001 cobre Windows 10.",
    })) as Result;
    expect(ok.ok).toBe(true);
    const bad = (await runTool(tools.report_decision, {
      intent: "smalltalk",
      action: "x",
      confidence: "high",
      reason: "y",
    })) as { error: boolean };
    expect(bad.error).toBe(true);
  });
});
