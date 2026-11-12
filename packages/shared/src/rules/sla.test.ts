import { afterEach, describe, expect, it } from "vitest";
import type { TicketPriority } from "../schemas/ticket";
import { addBusinessHours } from "./business-hours";
import { computeDueAt, isOverdue } from "./sla";

/** Instante a partir de data/hora local de São Paulo (UTC−03:00, sem horário de verão). */
const sp = (local: string) => new Date(`${local}:00-03:00`);

// Semana de referência: sáb 07/11/2026, dom 08, seg 09, ter 10, qua 11, qui 12, sex 13, seg 16.
const cases: Array<[string, TicketPriority, string, string]> = [
  ["crítica no sábado conta horas corridas", "critical", "2026-11-07T15:00", "2026-11-07T16:00"],
  ["alta dentro do expediente", "high", "2026-11-10T09:00", "2026-11-10T13:00"],
  ["média em dias úteis", "medium", "2026-11-09T10:00", "2026-11-12T10:00"],
  ["baixa em dias úteis", "low", "2026-11-09T10:00", "2026-11-16T10:00"],
  ["virada do dia", "high", "2026-11-10T16:00", "2026-11-11T10:00"],
  ["virada de fim de semana", "high", "2026-11-13T17:00", "2026-11-16T11:00"],
  ["antes do expediente", "high", "2026-11-11T06:00", "2026-11-11T12:00"],
  ["depois do expediente", "high", "2026-11-11T20:00", "2026-11-12T12:00"],
  ["no fim de semana", "medium", "2026-11-08T11:00", "2026-11-11T18:00"],
  ["exatamente às 18h", "high", "2026-11-11T18:00", "2026-11-12T12:00"],
];

describe("computeDueAt", () => {
  it.each(cases)("%s", (_name, priority, updatedAt, expected) => {
    expect(computeDueAt(priority, sp(updatedAt)).toISOString()).toBe(sp(expected).toISOString());
  });
});

describe("addBusinessHours", () => {
  it("termina às 18h quando o saldo zera no fim do dia", () => {
    expect(addBusinessHours(sp("2026-11-11T14:00"), 4).toISOString()).toBe(
      sp("2026-11-11T18:00").toISOString(),
    );
  });

  it("rejeita horas negativas", () => {
    expect(() => addBusinessHours(sp("2026-11-11T14:00"), -1)).toThrow(RangeError);
  });

  describe("independe do fuso da máquina", () => {
    const original = process.env.TZ;
    afterEach(() => {
      process.env.TZ = original;
    });

    it.each(["UTC", "Asia/Tokyo", "America/New_York"])("TZ=%s", (tz) => {
      process.env.TZ = tz;
      for (const [, priority, updatedAt, expected] of cases) {
        expect(computeDueAt(priority, sp(updatedAt)).toISOString()).toBe(
          sp(expected).toISOString(),
        );
      }
    });
  });
});

describe("isOverdue", () => {
  const dueAt = sp("2026-11-11T12:00");

  it("vencido quando o prazo passou", () => {
    expect(isOverdue({ status: "open", dueAt }, sp("2026-11-11T13:00"))).toBe(true);
  });

  it("não vencido exatamente no prazo", () => {
    expect(isOverdue({ status: "open", dueAt }, dueAt)).toBe(false);
  });

  it("não vencido antes do prazo", () => {
    expect(isOverdue({ status: "waiting_analyst", dueAt }, sp("2026-11-11T11:59"))).toBe(false);
  });

  it.each(["resolved", "closed"] as const)("%s nunca vence", (status) => {
    expect(isOverdue({ status, dueAt }, sp("2026-12-01T12:00"))).toBe(false);
  });

  it("aceita dueAt como ISO string", () => {
    expect(isOverdue({ status: "open", dueAt: dueAt.toISOString() }, sp("2026-11-11T13:00"))).toBe(
      true,
    );
  });
});
