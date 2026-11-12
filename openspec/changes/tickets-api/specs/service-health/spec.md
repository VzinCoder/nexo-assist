# Spec Delta

## MODIFIED Requirements

### Requirement: Rotas inexistentes
O `tickets-api` SHALL responder rotas não definidas com status 404 e corpo JSON no formato de erro padrão
`{ "error": { "code": "not_found", "message": "..." } }`.

#### Scenario: Rota desconhecida
- **WHEN** um cliente faz `GET /nao-existe`
- **THEN** recebe status 404 com corpo JSON `{ "error": { "code": "not_found", "message": "..." } }`
