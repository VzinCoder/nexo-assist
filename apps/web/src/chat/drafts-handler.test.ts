import { TicketConflictError, TicketsUnavailableError, type Ticket } from "@nexo/shared";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE, newSession, signSession } from "../auth/session";
import { createDb, type Db } from "../db/client";
import { createDraftHandlers } from "./drafts-handler";
import { createConversation, getOwnedDraft, insertDraft, listMessages, setStatus } from "./repository";

const SECRET = "segredo-de-teste-com-mais-de-32-caracteres";
const now = new Date("2026-11-11T13:00:00.000Z");
const ana = { id: "emp-001", role: "employee" as const, name: "Ana Souza", email: "ana.souza@nexo.com.br" };
const carla = { id: "emp-002", role: "employee" as const, name: "Carla Mendes", email: "carla.mendes@nexo.com.br" };

const created: Ticket = {
  id: "INC-20518",
  type: "INC",
  title: "VPN não conecta — erro 809",
  description: "Windows 11",
  category: "network_vpn",
  priority: "high",
  status: "open",
  affected: "me",
  employeeId: "emp-001",
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
  resolvedAt: null,
  dueAt: "2026-11-11T17:00:00.000Z",
  isOverdue: false,
  comments: [],
};

const createPayload = {
  title: created.title,
  description: created.description,
  type: "INC",
  category: "network_vpn",
  priority: "high",
  affected: "me",
  dueAt: created.dueAt,
  slaLabel: "4 horas úteis",
};

describe("rascunhos: confirmar e descartar", () => {
  let db: Db;
  let tickets: {
    createTicket: ReturnType<typeof vi.fn>;
    addComment: ReturnType<typeof vi.fn>;
    reopenTicket: ReturnType<typeof vi.fn>;
  };
  let handlers: ReturnType<typeof createDraftHandlers>;

  beforeEach(() => {
    db = createDb(":memory:");
    tickets = {
      createTicket: vi.fn(async () => created),
      addComment: vi.fn(async () => ({ ...created, id: "INC-20311" })),
      reopenTicket: vi.fn(async () => ({ ...created, id: "INC-20150" })),
    };
    handlers = createDraftHandlers({ getDb: () => db, tickets: tickets as never, sessionSecret: SECRET, now: () => now });
  });
  afterEach(() => db.$client.close());

  async function req(who: typeof ana = ana) {
    const cookie = `${SESSION_COOKIE}=${await signSession(newSession(who, now), SECRET)}`;
    return new Request("http://localhost/api/drafts/x/confirm", { method: "POST", headers: { cookie } });
  }

  function draftFor(employeeId = ana.id, kind: "create" | "comment" | "reopen" = "create") {
    const conversation = createConversation(db, employeeId, now);
    const payload = kind === "create" ? createPayload : { ticketId: "INC-20150", ticketTitle: "Senha do SAP", text: "Bloqueou de novo" };
    return { conversation, draft: insertDraft(db, { conversationId: conversation.id, kind, payload }, now) };
  }

  it("cria uma única vez, marca confirmado e grava mensagem system com o card", async () => {
    const { conversation, draft } = draftFor();
    const response = await handlers.confirm(await req(), draft.id);
    expect(response.status).toBe(200);
    expect(tickets.createTicket).toHaveBeenCalledTimes(1);
    expect(tickets.createTicket).toHaveBeenCalledWith("emp-001", {
      title: created.title,
      description: created.description,
      type: "INC",
      category: "network_vpn",
      priority: "high",
      affected: "me",
    });
    expect(getOwnedDraft(db, draft.id, ana.id)?.draft).toMatchObject({ status: "confirmed", ticketId: "INC-20518" });
    const [system] = listMessages(db, conversation.id);
    expect(system).toMatchObject({ role: "system", content: expect.stringContaining("INC-20518") });
    expect(system?.parts[0]).toMatchObject({ type: "ticket", ticket: { id: "INC-20518", priority: "high" } });

    const again = await handlers.confirm(await req(), draft.id);
    expect(again.status).toBe(409);
    expect(tickets.createTicket).toHaveBeenCalledTimes(1);
  });

  it("duas confirmações paralelas → uma única chamada ao serviço", async () => {
    const { draft } = draftFor();
    const [first, second] = await Promise.all([handlers.confirm(await req(), draft.id), handlers.confirm(await req(), draft.id)]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);
    expect(tickets.createTicket).toHaveBeenCalledTimes(1);
  });

  it("rascunho de outro funcionário → 404 sem chamar o serviço", async () => {
    const { draft } = draftFor(carla.id);
    expect((await handlers.confirm(await req(ana), draft.id)).status).toBe(404);
    expect((await handlers.discard(await req(ana), draft.id)).status).toBe(404);
    expect(tickets.createTicket).not.toHaveBeenCalled();
  });

  it("serviço indisponível → 503 e o rascunho volta a pending (pode confirmar de novo)", async () => {
    const { draft } = draftFor();
    tickets.createTicket.mockRejectedValueOnce(new TicketsUnavailableError(503, "unavailable", "x"));
    const response = await handlers.confirm(await req(), draft.id);
    expect(response.status).toBe(503);
    expect(((await response.json()) as { error: { message: string } }).error.message).toMatch(/indisponível/);
    expect(getOwnedDraft(db, draft.id, ana.id)?.draft.status).toBe("pending");
    expect((await handlers.confirm(await req(), draft.id)).status).toBe(200);
  });

  it("409 do serviço repassa o motivo e não confirma", async () => {
    const { draft } = draftFor(ana.id, "reopen");
    tickets.reopenTicket.mockRejectedValueOnce(new TicketConflictError(409, "reopen_window_expired", "Passou o prazo de 7 dias para reabrir."));
    const response = await handlers.confirm(await req(), draft.id);
    expect(response.status).toBe(409);
    expect(((await response.json()) as { error: { message: string } }).error.message).toBe("Passou o prazo de 7 dias para reabrir.");
    expect(getOwnedDraft(db, draft.id, ana.id)?.draft.status).toBe("pending");
  });

  it("reabertura confirmada chama reopenTicket com o comentário", async () => {
    const { draft } = draftFor(ana.id, "reopen");
    expect((await handlers.confirm(await req(), draft.id)).status).toBe(200);
    expect(tickets.reopenTicket).toHaveBeenCalledWith("emp-001", "INC-20150", "Bloqueou de novo");
  });

  it("conversa aguardando analista ainda confirma; conversa encerrada → 409", async () => {
    const waiting = draftFor();
    setStatus(db, waiting.conversation.id, "waiting_human", now);
    expect((await handlers.confirm(await req(), waiting.draft.id)).status).toBe(200);

    const closed = draftFor();
    setStatus(db, closed.conversation.id, "closed", now);
    expect((await handlers.confirm(await req(), closed.draft.id)).status).toBe(409);
    expect(tickets.createTicket).toHaveBeenCalledTimes(1);
  });

  it("descartar: discarded sem chamar o serviço; já confirmado → 409", async () => {
    const { draft } = draftFor();
    const response = await handlers.discard(await req(), draft.id);
    expect(response.status).toBe(200);
    expect(getOwnedDraft(db, draft.id, ana.id)?.draft.status).toBe("discarded");
    expect(tickets.createTicket).not.toHaveBeenCalled();
    expect((await handlers.confirm(await req(), draft.id)).status).toBe(409);

    const other = draftFor();
    await handlers.confirm(await req(), other.draft.id);
    expect((await handlers.discard(await req(), other.draft.id)).status).toBe(409);
  });

  it("não referencia o agent", () => {
    const source = readFileSync(fileURLToPath(new URL("./drafts-handler.ts", import.meta.url)), "utf8");
    expect(source).not.toMatch(/@nexo\/agent|@mastra/);
  });
});
