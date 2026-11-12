import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDb, type Db } from "../db/client";
import { articles, employees, ticketComments, tickets } from "../db/schema";
import { applySeed, isDatabaseEmpty } from "./apply";
import { MAIN_EMPLOYEE_ID } from "./data";

const now = new Date("2026-11-11T10:00:00-03:00");

function snapshot(db: Db) {
  return {
    employees: db.select().from(employees).orderBy(employees.id).all(),
    articles: db.select().from(articles).orderBy(articles.id).all(),
    tickets: db.select().from(tickets).orderBy(tickets.id).all(),
    comments: db.select().from(ticketComments).orderBy(ticketComments.id).all(),
  };
}

describe("applySeed", () => {
  let db: Db;

  beforeEach(() => {
    db = createDb(":memory:");
  });

  afterEach(() => {
    db.$client.close();
  });

  it("detecta banco vazio antes do seed e populado depois", () => {
    expect(isDatabaseEmpty(db)).toBe(true);
    applySeed(db, now);
    expect(isDatabaseEmpty(db)).toBe(false);
  });

  it("é idempotente: duas aplicações geram o mesmo conteúdo e removem o que foi criado entre elas", () => {
    applySeed(db, now);
    const first = snapshot(db);

    db.insert(tickets)
      .values({
        id: "INC-20312",
        type: "INC",
        title: "Criado entre os seeds",
        description: "Deve sumir.",
        category: "other",
        priority: "low",
        status: "open",
        affected: "me",
        employeeId: MAIN_EMPLOYEE_ID,
        createdAt: now,
        updatedAt: now,
        dueAt: now,
      })
      .run();
    db.insert(ticketComments)
      .values({
        ticketId: "INC-20312",
        authorId: MAIN_EMPLOYEE_ID,
        kind: "comment",
        text: "Também deve sumir.",
        createdAt: now,
      })
      .run();

    applySeed(db, now);
    const second = snapshot(db);

    expect(second).toEqual(first);
    expect(second.tickets.some((t) => t.id === "INC-20312")).toBe(false);
  });
});
