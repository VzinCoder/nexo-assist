# service-desk-agent Specification

## Purpose

Define como o agent Nexo Assist atende o funcionário: que regras do service desk segue, que ações pode
tomar, em nome de quem age e como se comporta diante de falhas e limites de custo.

## Requirements

### Requirement: Identidade vem da sessão
Toda ação do agent sobre chamados SHALL usar o funcionário e a conversa da sessão autenticada. Nenhuma
ação SHALL aceitar id de funcionário ou de conversa vindo do modelo; um argumento desse tipo SHALL ser
ignorado ou rejeitado.

#### Scenario: Pedido de chamado de outra pessoa
- **WHEN** o funcionário A pede ao agent o chamado de um funcionário B, informando o id do chamado
- **THEN** a consulta é feita em nome de A, o chamado não é encontrado e nenhum dado de B aparece na resposta, no trace ou na decisão

### Requirement: Ações disponíveis ao agent
O agent SHALL dispor exatamente destas ações: buscar na central de ajuda, listar os chamados do
funcionário (com indicação de vencido), abrir um chamado do funcionário, verificar chamados parecidos,
preparar rascunho de chamado, preparar rascunho de complemento ou reabertura, oferecer opções rápidas,
transferir para analista e registrar a decisão. Nenhuma ação SHALL criar, comentar ou reabrir chamado.

#### Scenario: Agent tenta criar chamado
- **WHEN** o modelo decide abrir um chamado
- **THEN** o resultado é apenas um rascunho pendente; nenhum chamado é criado no serviço de chamados

### Requirement: Rascunho com prioridade e prazo calculados
Ao preparar rascunho de chamado, o sistema SHALL validar título, descrição, tipo (`INC`/`REQ`),
categoria, prioridade e afetados, e SHALL calcular o prazo pela regra de SLA compartilhada a partir do
instante atual. Rascunho inválido SHALL ser recusado com o motivo, para o agent corrigir ou perguntar.

#### Scenario: Prioridade alta numa segunda às 10h
- **WHEN** o agent prepara um rascunho com prioridade alta numa segunda-feira às 10h (America/Sao_Paulo)
- **THEN** o rascunho mostra prazo às 14h do mesmo dia e o rótulo "4 horas úteis"

#### Scenario: Campo faltando
- **WHEN** o agent tenta preparar rascunho sem categoria
- **THEN** a ação falha com erro de validação registrado no trace e nenhum rascunho é gravado

### Requirement: Checagem de duplicidade antes do rascunho
As instruções do agent SHALL exigir verificar chamados parecidos antes de preparar rascunho de chamado
novo. Havendo chamado aberto sobre o mesmo problema, o agent SHALL propor complemento; havendo chamado
resolvido há até 7 dias, SHALL propor reabertura, conforme a indicação de reabrível do serviço.

#### Scenario: Senha do SAP bloqueou de novo
- **WHEN** a funcionária do seed diz "a senha do SAP bloqueou de novo"
- **THEN** o agent verifica chamados parecidos e prepara rascunho de reabertura do INC-20150, sem rascunho de chamado novo

#### Scenario: Problema já aberto
- **WHEN** o funcionário relata um problema que já tem chamado aberto
- **THEN** o agent mostra o chamado existente e oferece complementá-lo, sem novo rascunho

### Requirement: Rascunho de complemento ou reabertura
O sistema SHALL preparar rascunho de complemento apenas para chamado do funcionário que não esteja
resolvido nem fechado, e de reabertura apenas para chamado reabrível pela regra de 7 dias, recusando
os demais com o motivo.

#### Scenario: Reabrir fora da janela
- **WHEN** o agent tenta preparar reabertura de um chamado resolvido há 10 dias
- **THEN** a ação é recusada informando que passou o prazo de reabertura, e o agent oferece abrir um novo

### Requirement: Transferência para analista
A ação de transferir SHALL exigir motivo e resumo do caso, SHALL mudar a conversa para `waiting_human`
e, quando houver chamado relacionado, SHALL registrar a transferência nele. As instruções SHALL mandar
transferir quando o funcionário pedir, o caso for crítico, o chamado estiver vencido (após oferecer) ou
a confiança for baixa.

#### Scenario: Pedido explícito
- **WHEN** o funcionário diz "quero falar com um atendente"
- **THEN** o agent transfere com resumo, a conversa fica `waiting_human` e a decisão tem intent `handoff`

#### Scenario: Transferência com chamado
- **WHEN** o agent transfere tratando do INC-20311
- **THEN** o INC-20311 recebe o registro de transferência com o motivo e o resumo

### Requirement: Escopo e conduta nas instruções
As instruções do agent, em português, SHALL determinar: atender só TI e redirecionar RH, financeiro e
facilities; perguntar quando faltar dado antes de rascunhar; nunca afirmar que criou ou alterou
chamado (quem cria é o botão Confirmar); nunca inventar dados de chamado; responder de forma curta.

#### Scenario: Pergunta de RH
- **WHEN** o funcionário pergunta sobre suas férias
- **THEN** o agent explica que atende só TI, indica procurar o RH e a decisão tem intent `out_of_scope`

#### Scenario: Pedido sem dados suficientes
- **WHEN** o funcionário diz apenas "preciso de um software"
- **THEN** o agent pergunta qual software e para quê antes de preparar qualquer rascunho

### Requirement: Opções rápidas
O agent SHALL poder oferecer uma pergunta com 2 a 6 opções curtas, que a interface mostra como botões;
escolher uma opção SHALL enviar o texto dela como mensagem do funcionário.

#### Scenario: Quem é afetado
- **WHEN** o agent precisa saber quem é afetado
- **THEN** oferece as opções "Só eu", "Minha equipe", "A empresa toda" e "Não sei"

### Requirement: Modelo configurável
O modelo SHALL ser escolhido por configuração no formato `provedor/modelo`, com padrão do Google Gemini
no nível gratuito. Trocar de modelo ou provedor SHALL exigir apenas mudar a configuração e a chave.

#### Scenario: Trocar para o modelo reserva
- **WHEN** o web é iniciado com o modelo reserva configurado
- **THEN** o agent passa a usar esse modelo sem mudança de código

### Requirement: Limites de custo por resposta
Cada resposta SHALL usar no máximo 6 passos de ação e um limite moderado de tokens de saída. Ações
determinísticas (confirmar ou descartar rascunho, mudar status) SHALL NOT chamar o modelo.

#### Scenario: Agent em laço
- **WHEN** o modelo continua pedindo ações além do sexto passo
- **THEN** a resposta é encerrada no limite e gravada com o trace dos passos executados

### Requirement: Falha do serviço de chamados
Se o serviço de chamados falhar após as novas tentativas, a ação SHALL devolver o erro sem dados
inventados e registrá-lo no trace; o agent SHALL avisar o funcionário de que o sistema de chamados está
indisponível.

#### Scenario: Serviço instável
- **WHEN** o funcionário pede o status dos chamados e o serviço responde 503 em todas as tentativas
- **THEN** o chip "Consultou seus chamados" aparece com erro e a resposta diz que o sistema de chamados está indisponível, sem listar chamados

### Requirement: Limite de requisições do provedor
Quando o provedor do modelo recusar por excesso de requisições (429) ou estiver indisponível, o
funcionário SHALL ver "Muitas requisições no momento, tente em instantes" (ou equivalente para
indisponibilidade), e a resposta gravada SHALL conter um passo de trace com o erro.

#### Scenario: 429 do provedor
- **WHEN** o provedor responde 429 durante a resposta
- **THEN** o chat mostra a mensagem de muitas requisições e o histórico guarda o passo com o erro, sem perder a mensagem do funcionário
