# Spec Delta

## Purpose

Define como chamados de TI são consultados, abertos, complementados, reabertos e transferidos para um
analista no `tickets-api`, sempre restritos ao funcionário que os abriu.

## ADDED Requirements

### Requirement: Modelo do chamado
Todo chamado SHALL ter `id`, `type` (`INC`|`REQ`), `title`, `description`, `category` (`access`,
`network_vpn`, `hardware`, `software`, `email`, `other`), `priority` (`critical`|`high`|`medium`|`low`),
`status`, `affected` (`me`|`team`|`company`), `employeeId`, `createdAt`, `updatedAt`, `resolvedAt`
(ou `null`), `dueAt` e `isOverdue`, com datas em ISO 8601 UTC.

#### Scenario: Chamado serializado
- **WHEN** um cliente obtém qualquer chamado
- **THEN** o corpo contém todos esses campos, com `isOverdue` calculado no momento da resposta

### Requirement: Status do chamado
O `status` SHALL ser um de `open`, `waiting_analyst`, `approved`, `in_progress`, `resolved` e `closed`,
com os rótulos Aberto, Aguardando analista, Aprovado, Em atendimento, Resolvido e Fechado.

#### Scenario: Status desconhecido no filtro
- **WHEN** um cliente faz `GET /tickets?status=pending`
- **THEN** recebe 400 com `error.code` `invalid_request`

### Requirement: Listar chamados do funcionário
`GET /tickets` SHALL retornar apenas os chamados do funcionário de `X-Employee-Id`, do mais recentemente
atualizado para o menos, cada um com `isOverdue` e sem comentários. O parâmetro opcional `status` SHALL
filtrar por um status.

#### Scenario: Só os próprios chamados
- **WHEN** o funcionário principal do seed lista seus chamados
- **THEN** recebe INC-20311, REQ-10442 e INC-20150, entre outros dele, e nenhum chamado de outro funcionário

#### Scenario: Filtro por status
- **WHEN** o funcionário principal faz `GET /tickets?status=waiting_analyst`
- **THEN** recebe apenas chamados dele com status `waiting_analyst`, incluindo INC-20311

#### Scenario: Sem chamados
- **WHEN** um funcionário sem chamados lista seus chamados
- **THEN** recebe 200 com lista vazia

### Requirement: Detalhe do chamado
`GET /tickets/:id` SHALL retornar o chamado com seus comentários em ordem cronológica, cada um com `id`,
`authorId`, `authorName`, `kind` (`comment`, `reopen` ou `escalation`), `text` e `createdAt`.

#### Scenario: Chamado próprio
- **WHEN** o funcionário principal faz `GET /tickets/INC-20311`
- **THEN** recebe 200 com o chamado, `isOverdue` `true` e seus comentários

#### Scenario: ID malformado
- **WHEN** um cliente faz `GET /tickets/abc`
- **THEN** recebe 400 com `error.code` `invalid_request`

### Requirement: Privacidade dos chamados
Qualquer rota que receba o id de um chamado de outro funcionário SHALL responder 404 com `error.code`
`not_found`, idêntico ao de um chamado inexistente, e SHALL NOT alterar o chamado.

#### Scenario: Funcionário A pede chamado de B
- **WHEN** o funcionário A faz `GET /tickets/:id` com o id de um chamado do funcionário B
- **THEN** recebe 404 com o mesmo corpo de um id inexistente

#### Scenario: Funcionário A comenta chamado de B
- **WHEN** o funcionário A faz `POST /tickets/:id/comments` em um chamado de B
- **THEN** recebe 404 e o chamado de B continua sem o comentário

### Requirement: Abertura de chamado
`POST /tickets` SHALL exigir `title`, `description`, `type`, `category`, `priority` e `affected`, criar o
chamado para o funcionário de `X-Employee-Id` com status `open`, `createdAt` e `updatedAt` iguais ao
instante da criação e `dueAt` calculado, e responder 201 com o chamado.

#### Scenario: Criação válida
- **WHEN** um funcionário envia todos os campos obrigatórios válidos
- **THEN** recebe 201 com o chamado criado, status `open` e `dueAt` conforme a prioridade

#### Scenario: Campo faltando
- **WHEN** um funcionário envia o body sem `category`
- **THEN** recebe 400 com `error.code` `invalid_request`, a mensagem cita `category` e nenhum chamado é criado

#### Scenario: Título vazio
- **WHEN** um funcionário envia `title` vazio ou só com espaços
- **THEN** recebe 400 com `error.code` `invalid_request`

### Requirement: IDs sequenciais por tipo
O id de um chamado novo SHALL seguir o padrão `INC-NNNNN` ou `REQ-NNNNN` (5 dígitos) e SHALL ser o maior
número existente daquele tipo, considerando todos os funcionários, mais um.

#### Scenario: Próximo incidente
- **WHEN** o maior incidente existente é INC-20311 e um incidente é criado
- **THEN** o novo chamado recebe o id INC-20312

#### Scenario: Sequências independentes
- **WHEN** uma requisição é criada depois de um incidente
- **THEN** o id dela continua a sequência de REQ, sem relação com a de INC

### Requirement: Busca de chamados similares
`POST /tickets/similar` com `{ text }` SHALL retornar até 5 chamados do próprio funcionário que estejam
ativos (nem `resolved` nem `closed`) ou resolvidos dentro da janela de reabertura, com ao menos uma
palavra significativa em comum com título ou descrição, do mais para o menos parecido, cada um com
`reopenable`.

#### Scenario: Chamado aberto parecido
- **WHEN** o funcionário principal envia `{ "text": "meu notebook está muito lento" }`
- **THEN** INC-20311 está na resposta com `reopenable` `false`

#### Scenario: Resolvido recentemente
- **WHEN** o funcionário principal envia `{ "text": "senha do SAP bloqueada de novo" }`
- **THEN** INC-20150 está na resposta com `reopenable` `true`

#### Scenario: Resolvido há mais de 7 dias fica de fora
- **WHEN** o texto casa apenas com um chamado resolvido há mais de 7 dias
- **THEN** a resposta é uma lista vazia

#### Scenario: Chamado de outro funcionário fica de fora
- **WHEN** o texto casa com um chamado de outro funcionário
- **THEN** esse chamado não aparece na resposta

### Requirement: Complemento de chamado
`POST /tickets/:id/comments` com `{ text }` SHALL adicionar um comentário `comment` do funcionário ao
chamado, atualizar `updatedAt`, recalcular `dueAt` e responder 201 com o chamado atualizado. Chamados
`resolved` ou `closed` SHALL responder 409 com `error.code` `conflict`.

#### Scenario: Comentário em chamado ativo
- **WHEN** o funcionário principal comenta em INC-20311
- **THEN** recebe 201, o comentário aparece no detalhe e o chamado deixa de estar vencido

#### Scenario: Comentário em chamado resolvido
- **WHEN** o funcionário principal comenta em INC-20150
- **THEN** recebe 409 com `error.code` `conflict` e a mensagem sugere reabrir

### Requirement: Reabertura de chamado
`POST /tickets/:id/reopen` com `{ comment? }` SHALL, se o chamado estiver na janela de reabertura,
mudar o status para `open`, limpar `resolvedAt`, registrar um comentário `reopen`, atualizar `updatedAt`
e recalcular `dueAt`, respondendo 200. Fora da janela SHALL responder 409 sem alterar o chamado.

#### Scenario: Reabertura dentro da janela
- **WHEN** o funcionário principal reabre INC-20150, resolvido há 4 dias
- **THEN** recebe 200 com status `open`, `resolvedAt` `null` e um comentário `reopen`

#### Scenario: Reabertura fora da janela
- **WHEN** o funcionário principal tenta reabrir o chamado resolvido há mais de 7 dias
- **THEN** recebe 409 com `error.code` `conflict` e o chamado continua `resolved`

#### Scenario: Reabrir chamado que não está resolvido
- **WHEN** o funcionário principal tenta reabrir INC-20311
- **THEN** recebe 409 com `error.code` `conflict`

### Requirement: Transferência para analista
`POST /tickets/:id/escalate` com `{ reason, summary }` obrigatórios SHALL mudar o status para
`waiting_analyst`, registrar um comentário `escalation` com motivo e resumo, atualizar `updatedAt`,
recalcular `dueAt` e responder 200. Chamados `resolved` ou `closed` SHALL responder 409.

#### Scenario: Transferência de chamado aberto
- **WHEN** o funcionário principal transfere o chamado de prioridade alta com motivo e resumo
- **THEN** recebe 200 com status `waiting_analyst` e o resumo aparece no comentário `escalation`

#### Scenario: Sem resumo
- **WHEN** o body não tem `summary`
- **THEN** recebe 400 com `error.code` `invalid_request`

#### Scenario: Transferência de chamado resolvido
- **WHEN** o funcionário principal tenta transferir INC-20150
- **THEN** recebe 409 com `error.code` `conflict`
