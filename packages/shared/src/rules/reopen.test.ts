import { describe, expect, it } from "vitest";
import { isReopenable } from "./reopen";

const now = new Date("2026-11-11T13:00:00.000Z");
const ago = (ms: number) => new Date(now.getTime() - ms);
const DAY = 24 * 60 * 60 * 1000;
const MINUTE = 60 * 1000;

describe("isReopenable", () => {
  it("resolvido há 4 dias é reabrível", () => {
    expect(isReopenable({ status: "resolved", resolvedAt: ago(4 * DAY) }, now)).toBe(true);
  });

  it("resolvido há exatamente 7 dias é reabrível", () => {
    expect(isReopenable({ status: "resolved", resolvedAt: ago(7 * DAY) }, now)).toBe(true);
  });

  it("resolvido há 7 dias e 1 minuto não é reabrível", () => {
    expect(isReopenable({ status: "resolved", resolvedAt: ago(7 * DAY + MINUTE) }, now)).toBe(
      false,
    );
  });

  it("fechado não reabre, mesmo resolvido há pouco", () => {
    expect(isReopenable({ status: "closed", resolvedAt: ago(DAY) }, now)).toBe(false);
  });

  it("chamado não resolvido não é reabrível", () => {
    expect(isReopenable({ status: "waiting_analyst", resolvedAt: null }, now)).toBe(false);
  });

  it("aceita resolvedAt como ISO string", () => {
    expect(isReopenable({ status: "resolved", resolvedAt: ago(DAY).toISOString() }, now)).toBe(
      true,
    );
  });
});
