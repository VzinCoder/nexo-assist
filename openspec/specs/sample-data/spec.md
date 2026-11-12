# sample-data Specification

## Purpose

Garante dados de exemplo previsíveis no `tickets-api` (funcionários, artigos e chamados em situações
variadas), com datas relativas ao momento da execução para que os cenários de demonstração e de teste
continuem válidos em qualquer data.

## Requirements

### Requirement: Seed idempotente
`pnpm --filter @nexo/tickets-api seed` SHALL recriar os dados de exemplo, apagando os existentes, de modo
que executá-lo várias vezes produza o mesmo conjunto de registros, com datas recalculadas para o momento
da execução.

#### Scenario: Rodar duas vezes
- **WHEN** o desenvolvedor executa o seed duas vezes seguidas
- **THEN** o banco contém os mesmos funcionários, artigos e chamados, sem duplicatas

#### Scenario: Chamados criados depois do seed somem
- **WHEN** um chamado é criado pela API e o seed é executado de novo
- **THEN** o chamado criado não existe mais e a próxima criação volta a continuar a sequência do seed

### Requirement: Banco vazio recebe o seed
Ao iniciar, se o banco não tiver nenhum funcionário, o `tickets-api` SHALL aplicar o seed
automaticamente.

#### Scenario: Primeira execução
- **WHEN** o desenvolvedor executa `pnpm dev` pela primeira vez, sem banco local
- **THEN** o `tickets-api` sobe com os dados de exemplo disponíveis

### Requirement: Funcionários e analistas
O seed SHALL conter de 4 a 5 funcionários (`role` `employee`) de áreas diferentes, um deles o
funcionário principal dos cenários, e 2 analistas, um `analyst_n1` e um `analyst_n2`.

#### Scenario: Papéis
- **WHEN** o seed é aplicado
- **THEN** existem entre 4 e 5 funcionários com áreas distintas, um analista N1 e um analista N2

### Requirement: Artigos da central de ajuda
O seed SHALL conter 8 artigos curtos de TI, incluindo "VPN com erro 809" (reinstalar o cliente de VPN
pelo portal de softwares e reiniciar; vale só para Windows 10; no Windows 11, abrir chamado) e
"Horário do service desk" (segunda a sexta, 8h às 18h; chamados críticos têm plantão 24 horas).

#### Scenario: Artigo da VPN
- **WHEN** o seed é aplicado
- **THEN** o artigo "VPN com erro 809" existe e seu conteúdo menciona Windows 10 e Windows 11

#### Scenario: Quantidade
- **WHEN** o seed é aplicado
- **THEN** existem exatamente 8 artigos

### Requirement: Cenários de chamados do funcionário principal
O seed SHALL criar para o funcionário principal: INC-20311 "Notebook lento após atualização do Windows"
(Hardware, Média, `waiting_analyst`, atualizado há 6 dias); REQ-10442 "Segundo monitor para home office"
(Hardware, Baixa, `approved`, atualizado há 5 dias corridos); INC-20150 "Senha do SAP bloqueada"
(Acesso, Média, `resolved` há 4 dias); um chamado `resolved` há mais de 7 dias; e um de prioridade Alta,
`open`.

#### Scenario: Situações esperadas
- **WHEN** o seed é aplicado
- **THEN** INC-20311 está vencido, REQ-10442 está no prazo, INC-20150 é reabrível, o resolvido há mais de 7 dias não é reabrível e o chamado de prioridade Alta está no prazo

### Requirement: Cenários válidos em qualquer momento
As situações dos chamados do seed SHALL valer para qualquer dia da semana e hora em que o seed rodar.
Se "atualizado há 5 dias corridos" deixasse REQ-10442 vencido naquele momento, ele SHALL ser
registrado como atualizado há 4 dias corridos.

#### Scenario: Seed na sexta à noite
- **WHEN** o seed roda numa sexta às 19h00
- **THEN** REQ-10442 está no prazo e INC-20311 está vencido

#### Scenario: Qualquer hora da semana
- **WHEN** o seed roda em qualquer hora cheia de uma semana inteira
- **THEN** todas as situações esperadas dos chamados do funcionário principal se mantêm

### Requirement: Chamados de outros funcionários
O seed SHALL conter chamados de pelo menos dois outros funcionários, incluindo ao menos um com título
parecido com um chamado do funcionário principal, para testar privacidade e a busca de similares.

#### Scenario: Chamado alheio parecido
- **WHEN** o seed é aplicado
- **THEN** existe um chamado de outro funcionário sobre notebook lento, invisível ao funcionário principal
