# decision-trace Specification

## Purpose

Torna visível, em cada resposta do agent, o que ele entendeu, que ações tomou, com que confiança e por
quê, de forma que o funcionário e quem audita a conversa entendam cada decisão.

## Requirements

### Requirement: Passo de trace por ação
Toda ação executada pelo agent SHALL produzir um passo de trace com: nome da ação, rótulo curto em
português (por exemplo "Consultou seus chamados", "Abriu o chamado INC-20311"), entrada, saída
resumida, duração em milissegundos e erro quando houver. A entrada e a saída SHALL NOT conter dados de
outro funcionário.

#### Scenario: Consulta de chamados
- **WHEN** o agent lista os chamados do funcionário
- **THEN** o trace da resposta contém um passo com rótulo "Consultou seus chamados", a entrada usada, os chamados resumidos (id, título, status, vencido) e a duração

#### Scenario: Ação com falha
- **WHEN** uma ação falha
- **THEN** o passo é registrado mesmo assim, com o campo de erro preenchido com mensagem legível

### Requirement: Decisão no fim de toda resposta
Toda resposta do agent SHALL terminar com uma decisão estruturada: intent (`question`,
`ticket_status`, `ticket_update`, `ticket_create`, `handoff`, `out_of_scope` ou `other`), ação
realizada, confiança (`high`, `medium` ou `low`) e motivo em 1–2 frases citando a regra quando houver.
A decisão SHALL ser validada e gravada junto da mensagem.

#### Scenario: Resposta com decisão
- **WHEN** o agent responde a uma pergunta coberta pela central de ajuda
- **THEN** a mensagem gravada tem decisão com intent `question`, a ação, a confiança e o motivo

#### Scenario: Modelo esquece a decisão
- **WHEN** o modelo termina a resposta sem registrar decisão
- **THEN** a mensagem é gravada com uma decisão `other`, confiança `low` e motivo indicando que o agent não registrou a decisão, e a interface exibe isso

### Requirement: Baixa confiança leva a analista
Quando a decisão tiver confiança `low`, a resposta SHALL oferecer ou realizar a transferência para um
analista; a interface SHALL mostrar a oferta de falar com um analista nessa resposta.

#### Scenario: Agent sem segurança
- **WHEN** o agent registra decisão com confiança `low` sem ter transferido
- **THEN** a resposta mostra a opção "Falar com um analista"

### Requirement: Exibição dos passos e da decisão
Acima de cada resposta do agent, a interface SHALL mostrar um chip por passo de trace com o rótulo,
destacando passos com erro. Clicar SHALL expandir um painel com entrada, saída e duração de cada passo
e com a decisão: o que entendeu (intent em português), ação, badge de confiança e motivo.

#### Scenario: Expandir o trace
- **WHEN** o funcionário clica nos chips de uma resposta
- **THEN** vê, em português e legível, a entrada, a saída resumida e a duração de cada passo, e a decisão com o badge "Alta", "Média" ou "Baixa" confiança

#### Scenario: Histórico mantém o trace
- **WHEN** o funcionário recarrega a página
- **THEN** os chips e o painel das respostas anteriores continuam disponíveis com os mesmos dados

#### Scenario: Chips durante o streaming
- **WHEN** o agent executa uma ação no meio da resposta
- **THEN** o chip correspondente aparece enquanto a resposta ainda está sendo transmitida
