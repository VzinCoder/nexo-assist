# Spec Delta

## Purpose

Expõe um endpoint de saúde no tickets-api para que desenvolvedores, testes e outros serviços verifiquem
se o serviço legado de chamados está no ar.

## ADDED Requirements

### Requirement: Endpoint de saúde do tickets-api
O `tickets-api` SHALL responder `GET /health` com status 200 e corpo JSON `{ "status": "ok" }`.

#### Scenario: Serviço no ar
- **WHEN** um cliente faz `GET /health` no `tickets-api`
- **THEN** recebe status 200, `Content-Type` JSON e corpo `{ "status": "ok" }`

### Requirement: Saúde independe de autenticação e instabilidade simulada
O endpoint `GET /health` SHALL responder sem identificação de funcionário e SHALL NOT ser afetado pela
simulação de falhas ou latência do serviço legado.

#### Scenario: Sem identificação
- **WHEN** um cliente faz `GET /health` sem nenhum cabeçalho de identificação
- **THEN** recebe status 200

### Requirement: Rotas inexistentes
O `tickets-api` SHALL responder rotas não definidas com status 404 e corpo JSON.

#### Scenario: Rota desconhecida
- **WHEN** um cliente faz `GET /nao-existe`
- **THEN** recebe status 404 com corpo JSON
