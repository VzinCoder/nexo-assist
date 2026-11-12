# runtime-config Specification

## Purpose

Garante que cada app lê suas variáveis de ambiente em um único ponto, valida os valores na
inicialização e falha cedo com mensagem clara, sem chaves ou segredos no código.

## Requirements

### Requirement: Validação do ambiente na inicialização
Cada app (`web` e `tickets-api`) SHALL validar suas variáveis de ambiente ao iniciar e, se algum valor
for inválido, SHALL encerrar sem atender requisições, com mensagem que nomeia a variável e o problema.

#### Scenario: Porta inválida no tickets-api
- **WHEN** o `tickets-api` é iniciado com `PORT=abc`
- **THEN** o processo encerra com código diferente de zero e a mensagem cita `PORT`

#### Scenario: URL inválida no web
- **WHEN** o `web` é iniciado com `TICKETS_API_URL=nao-e-url`
- **THEN** a inicialização falha e a mensagem cita `TICKETS_API_URL`

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

### Requirement: Variáveis documentadas
Toda variável lida por um app SHALL estar listada no `.env.example` desse app, com valor de exemplo
não secreto e comentário curto explicando seu uso.

#### Scenario: Conferência do exemplo
- **WHEN** uma variável é lida pelo módulo de ambiente de um app
- **THEN** ela aparece no `.env.example` do mesmo app

### Requirement: Ponto único de leitura do ambiente
O código de cada app SHALL ler variáveis de ambiente apenas pelo seu módulo de ambiente validado,
recebendo valores já tipados e convertidos (por exemplo, porta como número).

#### Scenario: Porta tipada
- **WHEN** o servidor do `tickets-api` obtém a porta para escutar
- **THEN** recebe um número inteiro válido vindo do módulo de ambiente, não a string bruta do processo

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
