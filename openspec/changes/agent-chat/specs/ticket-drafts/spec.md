# Spec Delta

## Purpose

Garante que nenhum chamado é criado, complementado ou reaberto sem a confirmação explícita do
funcionário, executando a ação de forma determinística, sem passar pelo modelo.

## ADDED Requirements

### Requirement: Rascunho pendente
Todo rascunho SHALL pertencer a uma conversa, ter tipo (`create`, `comment` ou `reopen`), conteúdo
validado e status `pending`, `confirmed` ou `discarded`. Somente rascunhos `pending` SHALL poder ser
confirmados ou descartados.

#### Scenario: Rascunho criado pelo agent
- **WHEN** o agent prepara um rascunho de chamado
- **THEN** existe um rascunho `pending` ligado à conversa e nenhum chamado foi criado

### Requirement: Confirmação sem o modelo
`POST /api/drafts/:id/confirm` SHALL executar a ação do rascunho no serviço de chamados em nome do
funcionário da sessão (criar, comentar ou reabrir), SHALL NOT chamar o modelo, SHALL marcar o rascunho
`confirmed` com o id do chamado e SHALL gravar uma mensagem `system` com o card do chamado resultante.

#### Scenario: Confirmar criação
- **WHEN** o funcionário clica em "Confirmar" num rascunho de chamado novo
- **THEN** o chamado é criado uma única vez, o rascunho fica `confirmed` com o id e o chat mostra o card do chamado com prazo

#### Scenario: Confirmar reabertura
- **WHEN** o funcionário confirma o rascunho de reabertura do INC-20150
- **THEN** o INC-20150 é reaberto com o comentário e o chat mostra o card atualizado

### Requirement: Confirmação idempotente
Confirmar um rascunho que não está `pending` SHALL responder 409 sem chamar o serviço de chamados.
Duas confirmações simultâneas do mesmo rascunho SHALL resultar em no máximo uma ação no serviço.

#### Scenario: Confirmar duas vezes
- **WHEN** o funcionário confirma o mesmo rascunho pela segunda vez
- **THEN** recebe 409 e nenhum chamado adicional é criado

### Requirement: Posse do rascunho
Confirmar ou descartar rascunho de conversa de outro funcionário SHALL responder 404.

#### Scenario: Rascunho de outro funcionário
- **WHEN** o funcionário A chama confirm com o id de um rascunho da conversa de B
- **THEN** recebe 404 e o serviço de chamados não é chamado

### Requirement: Descarte
`POST /api/drafts/:id/discard` SHALL marcar o rascunho `discarded`, sem chamar o serviço de chamados
nem o modelo, e o card SHALL deixar de oferecer Confirmar.

#### Scenario: Descartar
- **WHEN** o funcionário clica em "Descartar" num rascunho pendente
- **THEN** o rascunho fica `discarded` e o card mostra que foi descartado

### Requirement: Falha ao confirmar
Se o serviço de chamados falhar ou recusar a ação, o rascunho SHALL continuar `pending` e o funcionário
SHALL ver a mensagem de erro (indisponível, ou o motivo da recusa, como reabertura fora do prazo).

#### Scenario: Serviço indisponível ao confirmar
- **WHEN** o funcionário confirma e o serviço de chamados está indisponível após as tentativas
- **THEN** a resposta é 503 com mensagem clara, o rascunho continua `pending` e pode ser confirmado de novo

#### Scenario: Reabertura recusada
- **WHEN** o serviço recusa a reabertura com 409 porque o chamado saiu da janela
- **THEN** o funcionário vê o motivo e o rascunho não é marcado como confirmado

### Requirement: Rascunho em conversa encerrada
Confirmar ou descartar SHALL ser recusado com 409 quando a conversa do rascunho estiver `closed`.
Em conversa transferida (`waiting_human` ou `with_human`) o rascunho pendente SHALL continuar
confirmável, pois a confirmação não envolve o modelo.

#### Scenario: Conversa encerrada
- **WHEN** o funcionário tenta confirmar um rascunho de uma conversa `closed`
- **THEN** recebe 409 e nenhum chamado é criado

#### Scenario: Rascunho antes da transferência
- **WHEN** o agent preparou o rascunho de um caso crítico e transferiu a conversa, e o funcionário confirma
- **THEN** o chamado é criado normalmente
