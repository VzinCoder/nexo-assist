# Spec Delta

## Purpose

Define como outros serviços se autenticam no `tickets-api`, como identificam o funcionário em nome de
quem agem, o formato único de erro e a instabilidade simulada do serviço legado.

## ADDED Requirements

### Requirement: Token de serviço obrigatório
Toda rota do `tickets-api`, exceto `GET /health`, SHALL exigir o header `X-Service-Token` igual ao token
de serviço configurado e SHALL responder 401 com código `unauthorized` quando o header faltar ou não
conferir.

#### Scenario: Sem token
- **WHEN** um cliente faz `GET /tickets` com `X-Employee-Id` válido e sem `X-Service-Token`
- **THEN** recebe 401 com corpo `{ "error": { "code": "unauthorized", "message": "..." } }`

#### Scenario: Token errado
- **WHEN** um cliente envia `X-Service-Token` diferente do configurado
- **THEN** recebe 401 com código `unauthorized`

#### Scenario: Token correto
- **WHEN** um cliente envia o `X-Service-Token` configurado e um `X-Employee-Id` existente em `GET /tickets`
- **THEN** a requisição é atendida

### Requirement: Identificação do funcionário nas rotas de chamados
Toda rota sob `/tickets` SHALL exigir o header `X-Employee-Id` com o id de um funcionário existente e
SHALL operar apenas sobre os chamados desse funcionário. Header ausente ou malformado SHALL responder
400 (`invalid_request`); funcionário inexistente SHALL responder 401 (`unauthorized`).

#### Scenario: Sem funcionário
- **WHEN** um cliente autenticado faz `GET /tickets` sem `X-Employee-Id`
- **THEN** recebe 400 com código `invalid_request`

#### Scenario: Funcionário inexistente
- **WHEN** um cliente autenticado envia `X-Employee-Id` que não corresponde a nenhum funcionário
- **THEN** recebe 401 com código `unauthorized`

### Requirement: Formato único de erro
Toda resposta de erro do `tickets-api` SHALL ter corpo JSON `{ "error": { "code", "message" } }`, com
`code` estável em inglês (`invalid_request`, `unauthorized`, `not_found`, `conflict`,
`service_unavailable`, `internal_error`) e `message` legível em português. Erros de validação SHALL
responder 400 com código `invalid_request` e citar o campo inválido na mensagem.

#### Scenario: Validação de entrada
- **WHEN** um cliente envia um body com campo de tipo errado para qualquer rota
- **THEN** recebe 400 com `error.code` `invalid_request` e a mensagem cita o campo

#### Scenario: Erro inesperado
- **WHEN** ocorre uma exceção não tratada durante uma requisição
- **THEN** o cliente recebe 500 com `error.code` `internal_error`, sem stack trace no corpo

### Requirement: Falha simulada do legado
Quando `FAILURE_RATE` for maior que zero, o `tickets-api` SHALL responder 503 com código
`service_unavailable` a uma fração aleatória das requisições igual a `FAILURE_RATE`, antes de executar
qualquer efeito da rota. `GET /health` SHALL NOT ser afetado.

#### Scenario: Falha sempre
- **WHEN** o serviço roda com `FAILURE_RATE=1` e um cliente autenticado faz `GET /tickets`
- **THEN** recebe 503 com `error.code` `service_unavailable`

#### Scenario: Falha não cria chamado
- **WHEN** o serviço roda com `FAILURE_RATE=1` e um cliente faz `POST /tickets` válido
- **THEN** recebe 503 e nenhum chamado é criado

#### Scenario: Desligado
- **WHEN** o serviço roda com `FAILURE_RATE=0`
- **THEN** nenhuma requisição recebe 503 por simulação

#### Scenario: Health imune
- **WHEN** o serviço roda com `FAILURE_RATE=1` e um cliente faz `GET /health`
- **THEN** recebe 200

### Requirement: Latência simulada do legado
Quando `LATENCY_MS` for maior que zero, o `tickets-api` SHALL atrasar cada resposta, exceto
`GET /health`, em pelo menos `LATENCY_MS` milissegundos.

#### Scenario: Atraso configurado
- **WHEN** o serviço roda com `LATENCY_MS=300` e um cliente faz `GET /tickets`
- **THEN** a resposta chega após pelo menos 300 ms

#### Scenario: Health sem atraso
- **WHEN** o serviço roda com `LATENCY_MS=300` e um cliente faz `GET /health`
- **THEN** a resposta não recebe o atraso simulado
