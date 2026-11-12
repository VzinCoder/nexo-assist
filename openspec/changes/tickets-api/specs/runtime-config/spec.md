# Spec Delta

## MODIFIED Requirements

### Requirement: Padrões para desenvolvimento local
As variáveis não secretas SHALL ter valores padrão que permitem rodar localmente sem `.env`: `PORT`
3001, `HOST` `0.0.0.0`, `DATABASE_FILE` `tickets.db`, `FAILURE_RATE` 0 e `LATENCY_MS` 0 no
`tickets-api`, e `TICKETS_API_URL` `http://localhost:3001` no `web`. Fora de produção, `SERVICE_TOKEN`
SHALL ter um valor padrão de desenvolvimento.

#### Scenario: Sem arquivo .env
- **WHEN** os apps são iniciados sem nenhuma variável definida
- **THEN** o `tickets-api` escuta na porta 3001, sem falhas nem latência simuladas, e o `web` aponta para `http://localhost:3001`

#### Scenario: Valor sobrescrito
- **WHEN** o `tickets-api` é iniciado com `PORT=4001`
- **THEN** ele escuta na porta 4001

## ADDED Requirements

### Requirement: Token de serviço obrigatório em produção
Com `NODE_ENV=production`, o `tickets-api` SHALL exigir `SERVICE_TOKEN` definido com pelo menos 16
caracteres e SHALL encerrar na inicialização, citando `SERVICE_TOKEN`, se ele faltar.

#### Scenario: Produção sem token
- **WHEN** o `tickets-api` é iniciado com `NODE_ENV=production` e sem `SERVICE_TOKEN`
- **THEN** o processo encerra com código diferente de zero e a mensagem cita `SERVICE_TOKEN`

### Requirement: Simulação de instabilidade validada
O `tickets-api` SHALL aceitar `FAILURE_RATE` apenas entre 0 e 1 e `LATENCY_MS` apenas como inteiro não
negativo, falhando na inicialização com mensagem que cita a variável inválida.

#### Scenario: Taxa fora do intervalo
- **WHEN** o `tickets-api` é iniciado com `FAILURE_RATE=1.5`
- **THEN** a inicialização falha e a mensagem cita `FAILURE_RATE`

#### Scenario: Latência negativa
- **WHEN** o `tickets-api` é iniciado com `LATENCY_MS=-10`
- **THEN** a inicialização falha e a mensagem cita `LATENCY_MS`
