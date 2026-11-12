import { isOverdue, isReopenable } from "@nexo/shared";
import { describe, expect, it } from "vitest";
import { MAIN_EMPLOYEE_ID, SEED_TICKETS, buildSeed } from "./data";

function situations(now: Date) {
  const seed = buildSeed(now);
  const ticket = (id: string) => {
    const found = seed.tickets.find((t) => t.id === id);
    if (!found) throw new Error(`${id} não está no seed`);
    return { status: found.status, dueAt: found.dueAt, resolvedAt: found.resolvedAt ?? null };
  };
  return {
    overdue: isOverdue(ticket(SEED_TICKETS.overdue), now),
    onTimeOverdue: isOverdue(ticket(SEED_TICKETS.onTime), now),
    reopenable: isReopenable(ticket(SEED_TICKETS.reopenable), now),
    longAgoReopenable: isReopenable(ticket(SEED_TICKETS.resolvedLongAgo), now),
    highOverdue: isOverdue(ticket(SEED_TICKETS.highOpen), now),
  };
}

const expected = {
  overdue: true,
  onTimeOverdue: false,
  reopenable: true,
  longAgoReopenable: false,
  highOverdue: false,
};

describe("buildSeed", () => {
  it("tem 4–5 funcionários de áreas distintas e um analista N1 e um N2", () => {
    const { employees } = buildSeed(new Date());
    const staff = employees.filter((e) => e.role === "employee");
    expect(staff.length).toBeGreaterThanOrEqual(4);
    expect(staff.length).toBeLessThanOrEqual(5);
    expect(new Set(staff.map((e) => e.department)).size).toBe(staff.length);
    expect(employees.filter((e) => e.role === "analyst_n1")).toHaveLength(1);
    expect(employees.filter((e) => e.role === "analyst_n2")).toHaveLength(1);
    expect(employees.every((e) => e.email.endsWith("@nexo.com.br"))).toBe(true);
  });

  it("tem 8 artigos, incluindo VPN 809 (Windows 10 e 11) e horário do service desk", () => {
    const { articles } = buildSeed(new Date());
    expect(articles).toHaveLength(8);
    const vpn = articles.find((a) => a.title === "VPN com erro 809");
    expect(vpn?.content).toMatch(/Windows 10/);
    expect(vpn?.content).toMatch(/Windows 11/);
    expect(articles.some((a) => a.title === "Horário do service desk")).toBe(true);
  });

  it("tem chamados de pelo menos dois outros funcionários, um deles sobre notebook lento", () => {
    const { tickets } = buildSeed(new Date());
    const others = tickets.filter((t) => t.employeeId !== MAIN_EMPLOYEE_ID);
    expect(new Set(others.map((t) => t.employeeId)).size).toBeGreaterThanOrEqual(2);
    expect(others.some((t) => /notebook lento/i.test(t.title))).toBe(true);
  });

  it("todo comentário pertence a um chamado do seed", () => {
    const { tickets, comments } = buildSeed(new Date());
    const ids = new Set(tickets.map((t) => t.id));
    expect(comments.every((c) => ids.has(c.ticketId))).toBe(true);
  });

  it("seed na sexta às 19h: REQ-10442 no prazo e INC-20311 vencido", () => {
    expect(situations(new Date("2026-11-13T19:00:00-03:00"))).toEqual(expected);
  });

  it("as situações valem em todas as 168 horas cheias de uma semana", () => {
    const start = new Date("2026-11-09T00:00:00-03:00").getTime(); // segunda 0h
    const failures: string[] = [];
    for (let hour = 0; hour < 168; hour++) {
      const now = new Date(start + hour * 60 * 60 * 1000);
      const got = situations(now);
      if (JSON.stringify(got) !== JSON.stringify(expected)) {
        failures.push(`${now.toISOString()}: ${JSON.stringify(got)}`);
      }
    }
    expect(failures).toEqual([]);
  });
});
