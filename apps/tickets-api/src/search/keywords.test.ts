import { describe, expect, it } from "vitest";
import { normalize, rankByKeywords, score, tokenize } from "./keywords";

describe("normalize/tokenize", () => {
  it("remove acentos e maiúsculas", () => {
    expect(normalize("Horário de ATENÇÃO")).toBe("horario de atencao");
    expect([...tokenize("Horário")]).toEqual(["horario"]);
  });

  it("ignora palavras curtas e stopwords", () => {
    expect([...tokenize("de com para meu o a VPN")]).toEqual(["vpn"]);
  });

  it("consulta vazia ou só com stopwords não tem tokens", () => {
    expect(tokenize("").size).toBe(0);
    expect(tokenize("de com para").size).toBe(0);
    expect(tokenize("   !!! ").size).toBe(0);
  });

  it("mantém números com 3+ dígitos e remove duplicatas", () => {
    expect([...tokenize("erro 809, ERRO 809")]).toEqual(["erro", "809"]);
  });
});

describe("score/rankByKeywords", () => {
  const docs = [
    { title: "B - Impressora", text: "impressora não imprime" },
    { title: "A - VPN", text: "VPN com erro 809 no Windows" },
    { title: "C - Rede", text: "rede lenta e VPN instável" },
  ];
  const rank = (query: string) =>
    rankByKeywords(docs, query, (d) => `${d.title} ${d.text}`, (a, b) =>
      a.title.localeCompare(b.title),
    ).map((entry) => entry.item.title);

  it("conta palavras distintas em comum", () => {
    expect(score(tokenize("vpn erro 809"), "VPN com erro 809")).toBe(3);
  });

  it("ordena por pontuação: mais palavras em comum primeiro", () => {
    expect(rank("vpn erro 809")).toEqual(["A - VPN", "C - Rede"]);
  });

  it("empate segue o desempate", () => {
    expect(rank("vpn")).toEqual(["A - VPN", "C - Rede"]);
  });

  it("nada encontrado devolve lista vazia", () => {
    expect(rank("teclado")).toEqual([]);
    expect(rank("de com para")).toEqual([]);
  });
});
