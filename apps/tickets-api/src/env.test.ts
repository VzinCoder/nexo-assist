import { describe, expect, it } from "vitest";
import { DEV_SERVICE_TOKEN, parseEnv } from "./env";

describe("parseEnv (tickets-api)", () => {
  it("usa os padrões quando nada está definido", () => {
    expect(parseEnv({})).toEqual({
      NODE_ENV: "development",
      PORT: 3001,
      HOST: "0.0.0.0",
      LOG_LEVEL: "info",
      SERVICE_TOKEN: DEV_SERVICE_TOKEN,
      DATABASE_FILE: "tickets.db",
      FAILURE_RATE: 0,
      LATENCY_MS: 0,
    });
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

  it("converte FAILURE_RATE e LATENCY_MS", () => {
    const env = parseEnv({ FAILURE_RATE: "0.5", LATENCY_MS: "300" });
    expect(env.FAILURE_RATE).toBe(0.5);
    expect(env.LATENCY_MS).toBe(300);
  });

  it("rejeita FAILURE_RATE=1.5 citando a variável", () => {
    expect(() => parseEnv({ FAILURE_RATE: "1.5" })).toThrow(/FAILURE_RATE/);
  });

  it("rejeita LATENCY_MS=-10 citando a variável", () => {
    expect(() => parseEnv({ LATENCY_MS: "-10" })).toThrow(/LATENCY_MS/);
  });

  it("exige SERVICE_TOKEN em produção", () => {
    expect(() => parseEnv({ NODE_ENV: "production" })).toThrow(/SERVICE_TOKEN/);
  });

  it("rejeita SERVICE_TOKEN curto em produção", () => {
    expect(() => parseEnv({ NODE_ENV: "production", SERVICE_TOKEN: "curto" })).toThrow(
      /SERVICE_TOKEN/,
    );
  });

  it("aceita SERVICE_TOKEN forte em produção", () => {
    const token = "um-token-bem-longo-0123";
    expect(parseEnv({ NODE_ENV: "production", SERVICE_TOKEN: token }).SERVICE_TOKEN).toBe(token);
  });
});
