/** Palavras comuns do português sem significado próprio (já normalizadas, com 3+ letras). */
const STOPWORDS: ReadonlySet<string> = new Set([
  "ate", "com", "como", "das", "dos", "ela", "elas", "ele", "eles", "essa", "esse", "esta",
  "estao", "estou", "este", "isso", "isto", "mais", "mas", "meu", "meus", "minha", "minhas",
  "muito", "muita", "nao", "nas", "nos", "nossa", "nosso", "onde", "para", "pela", "pelas",
  "pelo", "pelos", "por", "porque", "pra", "qual", "quando", "que", "sem", "ser", "seu", "seus",
  "sim", "sobre", "sua", "suas", "tem", "ter", "uma", "umas", "uns", "voce", "foi", "estava", "fica", "ficou", "tambem", "aqui", "ainda", "the", "and",
]);

const MIN_TOKEN_LENGTH = 3;

/** Minúsculas e sem acentos. */
export function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Palavras significativas distintas: `[a-z0-9]+`, 3+ caracteres, fora das stopwords. */
export function tokenize(text: string): Set<string> {
  const tokens = new Set<string>();
  for (const token of normalize(text).match(/[a-z0-9]+/g) ?? []) {
    if (token.length >= MIN_TOKEN_LENGTH && !STOPWORDS.has(token)) tokens.add(token);
  }
  return tokens;
}

/** Número de palavras distintas da consulta presentes no documento. */
export function score(queryTokens: ReadonlySet<string>, documentText: string): number {
  const documentTokens = tokenize(documentText);
  let hits = 0;
  for (const token of queryTokens) if (documentTokens.has(token)) hits++;
  return hits;
}

/**
 * Filtra os itens com ao menos uma palavra da consulta e ordena do mais para o menos relevante;
 * empates seguem `tieBreak`. Consulta sem palavras significativas devolve lista vazia.
 */
export function rankByKeywords<T>(
  items: readonly T[],
  query: string,
  textOf: (item: T) => string,
  tieBreak: (a: T, b: T) => number,
): Array<{ item: T; score: number }> {
  const queryTokens = tokenize(query);
  if (queryTokens.size === 0) return [];
  return items
    .map((item) => ({ item, score: score(queryTokens, textOf(item)) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || tieBreak(a.item, b.item));
}
