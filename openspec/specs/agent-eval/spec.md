# agent-eval Specification

## Purpose

Mede se o agent, com o modelo real, toma as decisões esperadas em conversas típicas do service desk,
separado da suíte automática para não gastar a cota do provedor.

## Requirements

### Requirement: Comando de eval separado
`pnpm eval` na raiz SHALL rodar os cenários de avaliação com o modelo configurado e SHALL NOT fazer
parte de `pnpm test`. Os testes automatizados SHALL NOT chamar o modelo real.

#### Scenario: Suíte de testes
- **WHEN** o desenvolvedor executa `pnpm test` sem chave do provedor configurada
- **THEN** todos os testes rodam e passam sem nenhuma chamada ao modelo real

#### Scenario: Eval sem chave
- **WHEN** o desenvolvedor executa `pnpm eval` sem a chave do provedor
- **THEN** o comando encerra com código diferente de zero explicando que a chave é necessária

### Requirement: Cenários e verificações
O eval SHALL conter ao menos 8 cenários, cada um verificando as ações chamadas e o intent da decisão:
RH fora de escopo, VPN 809 no Windows 10 e no Windows 11, status do chamado do notebook, pedido de
atendente, problema já existente, senha do SAP bloqueada de novo e pedido sem dados suficientes.

#### Scenario: Expectativas dos cenários
- **WHEN** o eval define os cenários
- **THEN** espera: RH → `out_of_scope`; 809 Windows 10 → busca na central; 809 Windows 11 → rascunho de chamado; notebook → lista de chamados e menção ao vencimento; atendente → transferência; já existente → checagem de parecidos sem novo rascunho; SAP → reabertura do INC-20150; sem dados → pergunta antes de rascunhar

#### Scenario: Resultado por cenário
- **WHEN** o eval termina
- **THEN** imprime para cada cenário se passou ou falhou, com as ações chamadas e o intent obtido, e um total

#### Scenario: Cenário falha
- **WHEN** algum cenário não atinge o esperado
- **THEN** o comando termina com código diferente de zero

### Requirement: Respeito ao limite do provedor
O eval SHALL pausar entre cenários o suficiente para não ultrapassar 15 requisições por minuto, usar
dados de exemplo isolados (sem alterar a conversa de ninguém) e SHALL NOT criar chamados reais.

#### Scenario: Ritmo do eval
- **WHEN** o eval roda os 8 cenários
- **THEN** a taxa de chamadas ao modelo fica abaixo de 15 por minuto e nenhum chamado é criado no serviço
