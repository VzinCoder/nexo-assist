import { describe, expect, it } from "vitest";
import { DEFAULT_LLM_MODEL, DEV_SERVICE_TOKEN, parseEnv } from "./env";

describe("parseEnv (web)", () => {
  it("usa padrões de desenvolvimento quando nada está definido", () => {
    const env = parseEnv({});
    expect(env.TICKETS_API_URL).toBe("http://localhost:3001");
    expect(env.SERVICE_TOKEN).toBe(DEV_SERVICE_TOKEN);
    expect(env.SESSION_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(env.WEB_DATABASE_FILE).toBe("web.db");
    expect(env.LLM_MODEL).toBe(DEFAULT_LLM_MODEL);
    expect(env.GOOGLE_GENERATIVE_AI_API_KEY).toBeUndefined();
  });

  it("aceita uma URL válida", () => {
    expect(parseEnv({ TICKETS_API_URL: "http://tickets:4001" }).TICKETS_API_URL).toBe("http://tickets:4001");
  });

  it("rejeita URL inválida citando a variável", () => {
    expect(() => parseEnv({ TICKETS_API_URL: "nao-e-url" })).toThrow(/TICKETS_API_URL/);
  });

  it("rejeita LLM_MODEL fora do formato provedor/modelo", () => {
    expect(() => parseEnv({ LLM_MODEL: "gemini" })).toThrow(/LLM_MODEL/);
    expect(parseEnv({ LLM_MODEL: "google/gemini-3.1-flash-lite" }).LLM_MODEL).toBe(
      "google/gemini-3.1-flash-lite",
    );
  });

  it("trata chave vazia como ausente", () => {
    expect(parseEnv({ GOOGLE_GENERATIVE_AI_API_KEY: "  " }).GOOGLE_GENERATIVE_AI_API_KEY).toBeUndefined();
  });

  it("exige SESSION_SECRET em produção", () => {
    expect(() =>
      parseEnv({ NODE_ENV: "production", SERVICE_TOKEN: "token-de-producao-123456" }),
    ).toThrow(/SESSION_SECRET/);
  });

  it("exige SERVICE_TOKEN em produção", () => {
    expect(() =>
      parseEnv({ NODE_ENV: "production", SESSION_SECRET: "s".repeat(32) }),
    ).toThrow(/SERVICE_TOKEN/);
  });

  it("aceita produção com os segredos definidos", () => {
    const env = parseEnv({
      NODE_ENV: "production",
      SERVICE_TOKEN: "token-de-producao-123456",
      SESSION_SECRET: "s".repeat(32),
    });
    expect(env.SESSION_SECRET).toBe("s".repeat(32));
  });
});
