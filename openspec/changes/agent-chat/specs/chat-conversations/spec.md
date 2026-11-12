# Spec Delta

## Purpose

Guarda as conversas do funcionário com o agent e decide, de forma determinística e antes de qualquer
chamada ao modelo, se uma mensagem pode ser respondida pelo agent.

## ADDED Requirements

### Requirement: Conversa pertence ao funcionário
Cada conversa SHALL pertencer a um único funcionário e SHALL ter status `agent`, `waiting_human`,
`with_human` ou `closed`. Nenhuma rota SHALL ler ou alterar conversa, mensagem ou rascunho de outro
funcionário; a tentativa SHALL responder 404, sem revelar que o recurso existe.

#### Scenario: Conversa de outro funcionário
- **WHEN** um funcionário envia mensagem para o id de uma conversa de outro funcionário
- **THEN** recebe 404 e nada é gravado nem enviado ao agent

### Requirement: Retomar a última conversa
Ao abrir o chat, o sistema SHALL carregar a conversa mais recente não encerrada (status diferente de
`closed`) do funcionário, com todas as mensagens, traces e decisões gravados. Sem conversa aberta, SHALL
criar uma nova com status `agent`.

#### Scenario: Voltar outro dia
- **WHEN** o funcionário conversou ontem, não encerrou e abre `/chat` hoje
- **THEN** vê a mesma conversa com o histórico completo, incluindo os chips de trace das respostas

#### Scenario: Primeira visita
- **WHEN** o funcionário abre `/chat` sem nenhuma conversa aberta
- **THEN** uma conversa nova com status `agent` é criada e o chat aparece vazio com sugestão de como começar

### Requirement: Nova conversa
O funcionário SHALL poder iniciar uma nova conversa, que passa a ser a atual. A conversa anterior
SHALL ser marcada como `closed` se estiver com status `agent`; se estiver com analista ou aguardando
analista, SHALL permanecer como está.

#### Scenario: Nova conversa a partir de conversa com o agent
- **WHEN** o funcionário clica em "Nova conversa" numa conversa com status `agent`
- **THEN** a anterior fica `closed`, uma nova com status `agent` é criada e o contador volta a 0

### Requirement: Histórico gravado no servidor
Toda mensagem SHALL ser gravada no banco do web com papel (`user`, `assistant`, `analyst` ou `system`),
conteúdo, partes estruturadas (cards, opções, rascunhos), trace e decisão quando houver. A mensagem do
funcionário SHALL ser gravada antes da chamada ao agent, e a resposta do agent ao fim do streaming.

#### Scenario: Resposta gravada com trace
- **WHEN** o agent termina uma resposta que usou duas tools
- **THEN** a mensagem do assistente gravada contém o texto, os dois passos de trace e a decisão

#### Scenario: Streaming interrompido
- **WHEN** a conexão cai no meio da resposta
- **THEN** a mensagem do funcionário continua gravada e, ao recarregar, o histórico mostra o que foi concluído

### Requirement: Agent não responde fora do status agent
A rota do chat SHALL NOT chamar o modelo quando a conversa tiver status diferente de `agent`. Nesse caso
SHALL responder com o status atual da conversa, sem gravar resposta do assistente.

#### Scenario: Conversa aguardando analista
- **WHEN** o funcionário envia mensagem numa conversa `waiting_human`
- **THEN** o agent não é chamado e a resposta informa que a conversa aguarda um analista

#### Scenario: Conversa com analista
- **WHEN** o funcionário envia mensagem numa conversa `with_human`
- **THEN** o agent não é chamado

### Requirement: Limite de 30 mensagens por conversa
O sistema SHALL contar no banco as mensagens do funcionário em cada conversa e SHALL recusar a 31ª,
sem chamar o modelo e sem gravá-la, com mensagem clara sugerindo iniciar nova conversa ou falar com
um analista.

#### Scenario: 30ª mensagem
- **WHEN** o funcionário envia a 30ª mensagem da conversa
- **THEN** ela é processada normalmente e o contador mostra "30 de 30 mensagens"

#### Scenario: 31ª mensagem
- **WHEN** o funcionário tenta enviar a 31ª mensagem
- **THEN** o agent não é chamado, nada é gravado e a resposta explica que o limite da conversa foi atingido

### Requirement: Contexto enviado ao modelo
A cada resposta, o sistema SHALL enviar ao modelo no máximo as últimas 12 mensagens da conversa, lidas
do banco, e não o histórico enviado pelo navegador.

#### Scenario: Conversa longa
- **WHEN** a conversa tem 25 mensagens gravadas e o funcionário envia mais uma
- **THEN** o modelo recebe apenas as 12 mais recentes, incluindo a nova

### Requirement: Consultar e criar conversa pela API
`GET /api/conversations/current` SHALL devolver a conversa atual do funcionário (status, motivo de
transferência, contador de mensagens e mensagens). `POST /api/conversations` SHALL criar uma nova
conversa conforme a regra de nova conversa.

#### Scenario: Conversa atual
- **WHEN** o funcionário logado chama `GET /api/conversations/current`
- **THEN** recebe a própria conversa aberta com status, `userMessageCount` e mensagens em ordem cronológica
