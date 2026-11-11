import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

describe("parseEnv (tickets-api)", () => {
  it("usa os padrões quando nada está definido", () => {
    expect(parseEnv({})).toEqual({ PORT: 3001, HOST: "0.0.0.0", LOG_LEVEL: "info" });
  });

  it("converte PORT para número", () => {
    expect(parseEnv({ PORT: "4001" }).PORT).toBe(4001);
  });

  it("rejeita PORT inválida citando a variável", () => {
    expect(() => parseEnv({ PORT: "abc" })).toThrow(/PORT/);
  });

  it("rejeita LOG_LEVEL fora do enum citando a variável", () => {
    expect(() => parseEnv({ LOG_LEVEL: "verbose" })).toThrow(/LOG_LEVEL/);
  });
});
