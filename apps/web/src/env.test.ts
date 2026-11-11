import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

describe("parseEnv (web)", () => {
  it("usa http://localhost:3001 quando TICKETS_API_URL não está definida", () => {
    expect(parseEnv({}).TICKETS_API_URL).toBe("http://localhost:3001");
  });

  it("aceita uma URL válida", () => {
    expect(parseEnv({ TICKETS_API_URL: "http://tickets:4001" }).TICKETS_API_URL).toBe("http://tickets:4001");
  });

  it("rejeita URL inválida citando a variável", () => {
    expect(() => parseEnv({ TICKETS_API_URL: "nao-e-url" })).toThrow(/TICKETS_API_URL/);
  });
});
