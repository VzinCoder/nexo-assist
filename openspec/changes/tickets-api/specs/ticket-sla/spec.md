# Spec Delta

## Purpose

Define como o prazo (`dueAt`) de um chamado é calculado a partir da prioridade e do horário útil, quando
um chamado está vencido e até quando um chamado resolvido pode ser reaberto. São regras puras,
compartilhadas pelo `tickets-api`, pelo agent e pelo web.

## ADDED Requirements

### Requirement: Prazo por prioridade
O prazo de um chamado SHALL ser calculado a partir do `updatedAt` e da prioridade: Crítica = 1 hora
corrida; Alta = 4 horas úteis; Média = 3 dias úteis; Baixa = 5 dias úteis. Um dia útil equivale a 10
horas úteis.

#### Scenario: Crítica conta horas corridas
- **WHEN** um chamado crítico é atualizado no sábado às 15h00 (America/Sao_Paulo)
- **THEN** o prazo é sábado às 16h00

#### Scenario: Alta dentro do expediente
- **WHEN** um chamado de prioridade alta é atualizado na terça às 9h00
- **THEN** o prazo é terça às 13h00

#### Scenario: Média em dias úteis
- **WHEN** um chamado de prioridade média é atualizado na segunda às 10h00
- **THEN** o prazo é quinta às 10h00

#### Scenario: Baixa em dias úteis
- **WHEN** um chamado de prioridade baixa é atualizado na segunda às 10h00
- **THEN** o prazo é a segunda seguinte às 10h00

### Requirement: Horário útil
As horas úteis SHALL contar apenas de segunda a sexta, das 8h às 18h, no fuso America/Sao_Paulo, sem
considerar feriados. Uma atualização fora do expediente começa a contar no próximo início de expediente.

#### Scenario: Virada do dia
- **WHEN** um chamado de prioridade alta é atualizado na terça às 16h00
- **THEN** o prazo é quarta às 10h00

#### Scenario: Virada de fim de semana
- **WHEN** um chamado de prioridade alta é atualizado na sexta às 17h00
- **THEN** o prazo é segunda às 11h00

#### Scenario: Atualização antes do expediente
- **WHEN** um chamado de prioridade alta é atualizado na quarta às 6h00
- **THEN** o prazo é quarta às 12h00

#### Scenario: Atualização depois do expediente
- **WHEN** um chamado de prioridade alta é atualizado na quarta às 20h00
- **THEN** o prazo é quinta às 12h00

#### Scenario: Atualização no fim de semana
- **WHEN** um chamado de prioridade média é atualizado no domingo às 11h00
- **THEN** o prazo é quarta às 18h00

#### Scenario: Instante independe do fuso da máquina
- **WHEN** o cálculo roda em uma máquina com fuso UTC
- **THEN** o prazo resultante é o mesmo instante calculado no fuso America/Sao_Paulo

### Requirement: Prazo recalculado a cada atualização
Toda atualização de um chamado (criação, comentário, reabertura ou transferência) SHALL definir o
`updatedAt` como o instante da atualização e recalcular o `dueAt` a partir dele.

#### Scenario: Comentário renova o prazo
- **WHEN** um comentário é adicionado a um chamado vencido de prioridade média
- **THEN** o `updatedAt` passa a ser o instante do comentário e o `dueAt` é recalculado a partir dele

### Requirement: Vencimento
Um chamado SHALL estar vencido (`isOverdue = true`) quando o instante atual é posterior ao `dueAt`, e
SHALL NOT estar vencido quando seu status é `resolved` ou `closed`, independentemente do prazo.

#### Scenario: Prazo passado
- **WHEN** um chamado aberto tem `dueAt` uma hora antes do instante atual
- **THEN** `isOverdue` é `true`

#### Scenario: Exatamente no prazo
- **WHEN** o instante atual é igual ao `dueAt` de um chamado aberto
- **THEN** `isOverdue` é `false`

#### Scenario: Resolvido não vence
- **WHEN** um chamado com status `resolved` ou `closed` tem `dueAt` no passado
- **THEN** `isOverdue` é `false`

### Requirement: Janela de reabertura
Um chamado SHALL ser reabrível somente quando seu status é `resolved` e o `resolvedAt` está a no máximo
7 dias (168 horas corridas) do instante atual.

#### Scenario: Resolvido há 4 dias
- **WHEN** um chamado `resolved` tem `resolvedAt` há 4 dias
- **THEN** ele é reabrível

#### Scenario: Resolvido há mais de 7 dias
- **WHEN** um chamado `resolved` tem `resolvedAt` há 7 dias e 1 minuto
- **THEN** ele não é reabrível

#### Scenario: Fechado não reabre
- **WHEN** um chamado tem status `closed`
- **THEN** ele não é reabrível, mesmo que tenha sido resolvido há menos de 7 dias
