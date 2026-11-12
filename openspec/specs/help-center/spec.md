# help-center Specification

## Purpose

Expõe os artigos da central de ajuda de TI com busca por palavra-chave, para que o agent responda
dúvidas com conteúdo oficial antes de abrir chamados.

## Requirements

### Requirement: Busca de artigos por palavra-chave
`GET /kb/articles?q=` SHALL retornar os artigos cujo título ou conteúdo contém ao menos uma palavra
significativa da consulta, ordenados do mais para o menos relevante. Cada artigo tem `id`, `title`,
`content` e `tags`. A rota exige `X-Service-Token` e não exige `X-Employee-Id`.

#### Scenario: Busca pela VPN
- **WHEN** um cliente busca `q=vpn erro 809`
- **THEN** o primeiro resultado é o artigo "VPN com erro 809"

#### Scenario: Mais palavras em comum vem primeiro
- **WHEN** dois artigos casam com a consulta e um deles contém mais palavras da consulta
- **THEN** o que contém mais palavras aparece antes

#### Scenario: Nada encontrado
- **WHEN** um cliente busca um termo que não aparece em nenhum artigo
- **THEN** recebe 200 com lista vazia

### Requirement: Normalização da busca
A busca SHALL ignorar maiúsculas, minúsculas e acentos, e SHALL ignorar palavras com menos de 3 letras
e palavras comuns do português sem significado próprio (como "de", "com", "para", "meu").

#### Scenario: Sem acento
- **WHEN** um cliente busca `q=horario`
- **THEN** o artigo "Horário do service desk" é retornado

#### Scenario: Só palavras vazias
- **WHEN** um cliente busca `q=de com para`
- **THEN** recebe 200 com lista vazia

### Requirement: Listagem sem termo
Sem o parâmetro `q`, ou com `q` vazio, `GET /kb/articles` SHALL retornar todos os artigos ordenados por
título.

#### Scenario: Sem consulta
- **WHEN** um cliente faz `GET /kb/articles` sem `q`
- **THEN** recebe todos os artigos da central de ajuda
