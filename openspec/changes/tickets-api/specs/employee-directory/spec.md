# Spec Delta

## Purpose

Permite que outros serviços identifiquem um funcionário ou analista pelo e-mail corporativo, obtendo o
id usado para agir em nome dele no `tickets-api`.

## ADDED Requirements

### Requirement: Consulta de funcionário por e-mail
`GET /employees/by-email/:email` SHALL retornar o funcionário com aquele e-mail, com `id`, `name`,
`email`, `department` e `role` (`employee`, `analyst_n1` ou `analyst_n2`). A comparação de e-mail SHALL
ignorar maiúsculas e minúsculas. A rota exige `X-Service-Token` e não exige `X-Employee-Id`.

#### Scenario: Funcionário existente
- **WHEN** um cliente autenticado consulta o e-mail de um funcionário do seed
- **THEN** recebe 200 com os dados do funcionário, incluindo `role` `employee`

#### Scenario: Maiúsculas no e-mail
- **WHEN** um cliente consulta o mesmo e-mail escrito com letras maiúsculas
- **THEN** recebe o mesmo funcionário

#### Scenario: E-mail desconhecido
- **WHEN** um cliente consulta um e-mail válido que não pertence a ninguém
- **THEN** recebe 404 com `error.code` `not_found`

#### Scenario: E-mail inválido
- **WHEN** um cliente consulta um valor que não é e-mail
- **THEN** recebe 400 com `error.code` `invalid_request`

### Requirement: Domínio corporativo
Todo funcionário cadastrado SHALL ter e-mail no domínio `@nexo.com.br`.

#### Scenario: Funcionários do seed
- **WHEN** o seed é aplicado
- **THEN** todos os funcionários e analistas têm e-mail terminando em `@nexo.com.br`
