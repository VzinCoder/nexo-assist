import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { createDb, type Db } from "./client";
import { employees, ticketComments, tickets } from "./schema";

describe("createDb", () => {
  let db: Db | undefined;

  afterEach(() => {
    db?.$client.close();
    db = undefined;
  });

  it("cria banco em memória, aplica as migrações e persiste um chamado com comentário", () => {
    db = createDb(":memory:");
    const createdAt = new Date("2026-11-11T13:00:00.000Z");

    db.insert(employees)
      .values({
        id: "emp-001",
        name: "Mariana Costa",
        email: "mariana.costa@nexo.com.br",
        department: "Financeiro",
        role: "employee",
      })
      .run();
    db.insert(tickets)
      .values({
        id: "INC-20311",
        type: "INC",
        title: "Notebook lento",
        description: "Lento após atualização",
        category: "hardware",
        priority: "medium",
        status: "open",
        affected: "me",
        employeeId: "emp-001",
        createdAt,
        updatedAt: createdAt,
        resolvedAt: null,
        dueAt: new Date("2026-11-16T13:00:00.000Z"),
      })
      .run();
    db.insert(ticketComments)
      .values({
        ticketId: "INC-20311",
        authorId: "emp-001",
        kind: "comment",
        text: "Continua lento.",
        createdAt,
      })
      .run();

    const ticket = db.select().from(tickets).where(eq(tickets.id, "INC-20311")).get();
    expect(ticket?.createdAt).toBeInstanceOf(Date);
    expect(ticket?.createdAt.toISOString()).toBe(createdAt.toISOString());
    expect(ticket?.resolvedAt).toBeNull();

    const comments = db.select().from(ticketComments).all();
    expect(comments).toHaveLength(1);
    expect(comments[0]?.id).toBe(1);
  });

  it("aplica chaves estrangeiras", () => {
    db = createDb(":memory:");
    const now = new Date();
    expect(() =>
      db
        ?.insert(tickets)
        .values({
          id: "INC-00001",
          type: "INC",
          title: "x",
          description: "y",
          category: "other",
          priority: "low",
          status: "open",
          affected: "me",
          employeeId: "emp-999",
          createdAt: now,
          updatedAt: now,
          dueAt: now,
        })
        .run(),
    ).toThrow();
  });
});
