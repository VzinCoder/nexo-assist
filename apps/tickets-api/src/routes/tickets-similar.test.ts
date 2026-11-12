import { similarTicketListSchema } from "@nexo/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SEED_TICKETS } from "../seed/data";
import { authHeaders, createTestApp, type TestApp } from "../testing";

describe("POST /tickets/similar", () => {
  let t: TestApp;
  beforeEach(() => {
    t = createTestApp();
  });
  afterEach(async () => {
    await t.close();
  });

  const similar = async (text: string) => {
    const response = await t.app.inject({
      method: "POST",
      url: "/tickets/similar",
      headers: authHeaders(),
      payload: { text },
    });
    expect(response.statusCode).toBe(200);
    return similarTicketListSchema.parse(response.json());
  };

  it("notebook lento: INC-20311 aparece, não reabrível, e o chamado alheio fica de fora", async () => {
    const results = await similar("meu notebook está muito lento");
    const overdue = results.find((ticket) => ticket.id === SEED_TICKETS.overdue);
    expect(overdue?.reopenable).toBe(false);
    expect(results.map((ticket) => ticket.id)).not.toContain(SEED_TICKETS.otherSimilar);
  });

  it("SAP bloqueado de novo: INC-20150 aparece como reabrível", async () => {
    const results = await similar("senha do SAP bloqueada de novo");
    expect(results[0]?.id).toBe(SEED_TICKETS.reopenable);
    expect(results[0]?.reopenable).toBe(true);
  });

  it("resolvido há mais de 7 dias fica de fora", async () => {
    expect(await similar("outlook não sincroniza no celular")).toEqual([]);
  });

  it("fechado fica de fora", async () => {
    expect(await similar("troca senha rede expirou portal")).not.toContainEqual(
      expect.objectContaining({ id: SEED_TICKETS.closed }),
    );
  });

  it("devolve no máximo 5 chamados", async () => {
    for (let i = 0; i < 6; i++) {
      await t.app.inject({
        method: "POST",
        url: "/tickets",
        headers: authHeaders(),
        payload: {
          title: `Teclado falhando ${i}`,
          description: "Teclado com teclas falhando.",
          type: "INC",
          category: "hardware",
          priority: "low",
          affected: "me",
        },
      });
    }
    expect(await similar("teclado falhando")).toHaveLength(5);
  });

  it("texto vazio responde 400", async () => {
    const response = await t.app.inject({
      method: "POST",
      url: "/tickets/similar",
      headers: authHeaders(),
      payload: { text: " " },
    });
    expect(response.statusCode).toBe(400);
  });
});
