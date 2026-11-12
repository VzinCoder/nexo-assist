import { SLA_LABELS, TICKET_CATEGORY_LABELS } from "@nexo/shared";
import { describe, expect, it } from "vitest";
import { buildInstructions } from "./instructions";

describe("buildInstructions", () => {
  const text = buildInstructions(new Date("2026-11-09T13:00:00.000Z"));

  it("cita todas as categorias, os 4 prazos e a janela de 7 dias", () => {
    for (const label of Object.values(TICKET_CATEGORY_LABELS)) expect(text).toContain(label);
    for (const label of Object.values(SLA_LABELS)) expect(text).toContain(label);
    expect(text).toContain("até 7 dias");
  });

  it("injeta a data/hora atual em São Paulo", () => {
    expect(text).toMatch(/segunda-feira, 09\/11\/2026.*10:00/);
  });

  it("traz as regras de conduta que não podem faltar", () => {
    expect(text).toMatch(/Só TI/);
    expect(text).toMatch(/NUNCA diga que criou/);
    expect(text).toMatch(/find_similar_tickets/);
    expect(text).toMatch(/report_decision \(a ÚLTIMA ferramenta/);
    expect(text).toMatch(/Confiança low: ofereça falar com um analista/);
    expect(text).toMatch(/PERGUNTE antes de rascunhar/);
  });

  it("snapshot", () => {
    expect(text).toMatchSnapshot();
  });
});
