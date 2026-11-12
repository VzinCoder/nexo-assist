# tickets-client Specification

## Purpose

Oferece aos consumidores (agent e web) um cliente tipado do `tickets-api` que tolera a instabilidade do
legado com timeout e retry e que transforma falhas em erros tipados, para que quem chama possa avisar o
funcionário e registrar o erro no trace.

## Requirements

### Requirement: Operações tipadas
O cliente SHALL oferecer uma operação para cada endpoint do `tickets-api` (consultar funcionário por
e-mail, buscar artigos, listar, detalhar, buscar similares, criar, comentar, reabrir e transferir
chamados), enviar `X-Service-Token` em todas e `X-Employee-Id` nas de chamados, e devolver dados
validados contra os schemas compartilhados.

#### Scenario: Listar chamados
- **WHEN** um consumidor lista os chamados de um funcionário pelo cliente
- **THEN** recebe chamados tipados com `isOverdue`, e a requisição levou o token de serviço e o id do funcionário

#### Scenario: Resposta fora do contrato
- **WHEN** o serviço responde 200 com corpo que não segue o schema esperado
- **THEN** o cliente lança um erro do cliente, sem devolver dados não validados

### Requirement: Timeout por tentativa
Cada tentativa SHALL ser abortada se o serviço não responder dentro do timeout configurado (padrão
5 segundos), contando como falha retentável.

#### Scenario: Serviço lento
- **WHEN** o serviço demora mais que o timeout nas 3 tentativas
- **THEN** o cliente lança `TicketsUnavailableError`

### Requirement: Retry com backoff exponencial
O cliente SHALL fazer no máximo 3 tentativas por operação, repetindo somente após resposta 503 ou
timeout, com espera exponencial entre tentativas (padrão 200 ms e depois 400 ms). Outras respostas
SHALL NOT ser repetidas.

#### Scenario: 503 seguido de sucesso
- **WHEN** o serviço responde 503 na primeira tentativa e 200 na segunda
- **THEN** o cliente devolve o resultado da segunda tentativa, tendo feito 2 requisições

#### Scenario: 503 em todas as tentativas
- **WHEN** o serviço responde 503 nas 3 tentativas
- **THEN** o cliente faz exatamente 3 requisições e lança `TicketsUnavailableError`

#### Scenario: 404 não é repetido
- **WHEN** o serviço responde 404
- **THEN** o cliente faz 1 requisição só

### Requirement: Erros tipados
O cliente SHALL lançar `TicketNotFoundError` para 404, `TicketConflictError` para 409 e
`TicketsUnavailableError` quando as tentativas se esgotarem ou o serviço estiver inalcançável. Todos
SHALL expor o `code` e a `message` do corpo de erro quando houver.

#### Scenario: Chamado de outro funcionário
- **WHEN** um consumidor pede pelo cliente um chamado que pertence a outro funcionário
- **THEN** recebe `TicketNotFoundError`

#### Scenario: Reabertura fora da janela
- **WHEN** um consumidor tenta reabrir pelo cliente um chamado resolvido há mais de 7 dias
- **THEN** recebe `TicketConflictError` com a mensagem do serviço

#### Scenario: Serviço fora do ar
- **WHEN** não há nada escutando no endereço configurado
- **THEN** o cliente lança `TicketsUnavailableError`
