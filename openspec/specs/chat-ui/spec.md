# chat-ui Specification

## Purpose

Define as telas que o funcionário usa (login e chat) seguindo o protótipo de design, com respostas em
streaming, cards acionáveis e estados claros de carregamento, vazio, erro e transferência.

## Requirements

### Requirement: Fidelidade ao protótipo
As telas de login, abertura de chamado e consulta SHALL seguir layout, espaçamentos, cores, tipografia
e componentes das telas correspondentes do protótipo (Identificação; Chat — Novo chamado; Chat —
Consulta e transferência), com todos os textos em português.

#### Scenario: Tela de login
- **WHEN** o visitante abre `/login`
- **THEN** vê o painel de apresentação do Nexo Assist e o formulário "Entrar" com e-mail corporativo e senha, como no protótipo

#### Scenario: Estrutura do chat
- **WHEN** o funcionário abre `/chat`
- **THEN** vê a barra lateral com "Atendimento", nome, e-mail e "Sair", o cabeçalho com o estado do assistente, as mensagens e o campo "Escreva para o Nexo…" com "Enviar"

### Requirement: Respostas em streaming
O texto da resposta do agent SHALL aparecer progressivamente enquanto é gerado, com indicador de que o
agent está respondendo, e o envio de nova mensagem SHALL ficar desabilitado até a resposta terminar.

#### Scenario: Enviar mensagem
- **WHEN** o funcionário envia uma mensagem
- **THEN** a mensagem aparece imediatamente, surge o indicador de resposta e o texto do agent é exibido aos poucos

### Requirement: Cards de chamado
Chamados retornados pelo agent ou pela confirmação SHALL aparecer como cards com id, título, status,
prioridade, prazo e o selo "Vencido" quando estiver vencido. Quando houver vários chamados, SHALL
aparecer uma lista selecionável; escolher um item SHALL enviar a escolha como mensagem do funcionário.

#### Scenario: Vários chamados abertos
- **WHEN** o funcionário pergunta "qual o status do meu chamado?" e tem 3 chamados abertos
- **THEN** vê a lista com os 3 (id, título, status, data) e pode escolher um

#### Scenario: Chamado vencido
- **WHEN** o card mostra o INC-20311
- **THEN** exibe o selo "Vencido" e o prazo ultrapassado

### Requirement: Card de rascunho
Rascunhos SHALL aparecer como card com tipo, título, descrição, categoria, prioridade com prazo
calculado, afetados e os botões "Confirmar" e "Descartar". Após confirmar ou descartar, o card SHALL
mostrar o novo estado e não oferecer mais as ações; durante a confirmação os botões SHALL ficar
desabilitados.

#### Scenario: Rascunho aguardando confirmação
- **WHEN** o agent prepara um rascunho de chamado
- **THEN** o card mostra "Aguardando confirmação", a prioridade com o prazo (por exemplo "Alta · resposta até 13:43") e os botões Confirmar e Descartar

#### Scenario: Erro ao confirmar
- **WHEN** a confirmação falha por indisponibilidade
- **THEN** o card mostra a mensagem de erro e permite tentar novamente

### Requirement: Opções rápidas na interface
Opções oferecidas pelo agent SHALL aparecer como botões numerados abaixo da pergunta; clicar SHALL
enviar o texto da opção. Opções de respostas antigas SHALL ficar desabilitadas.

#### Scenario: Escolher opção
- **WHEN** o funcionário clica em "Só eu"
- **THEN** "Só eu" é enviado como sua mensagem

### Requirement: Banner de transferência
Quando a conversa estiver `waiting_human` ou `with_human`, a interface SHALL mostrar um banner
explicando o estado (aguardando analista ou em atendimento com analista) e SHALL desabilitar o campo
de mensagem. O estado SHALL ser atualizado periodicamente sem recarregar a página.

#### Scenario: Após transferência
- **WHEN** o agent transfere a conversa
- **THEN** ao fim da resposta aparece o banner "Aguardando um analista" e o campo de mensagem fica desabilitado

### Requirement: Contador de mensagens
A interface SHALL mostrar "X de 30 mensagens nesta conversa", atualizado a cada envio, e SHALL
desabilitar o envio ao atingir 30, oferecendo "Nova conversa".

#### Scenario: Limite atingido
- **WHEN** o contador chega a 30
- **THEN** o campo fica desabilitado com explicação e o botão "Nova conversa" é destacado

### Requirement: Estados de carregamento, vazio e erro
O chat SHALL mostrar estado de carregamento ao abrir, estado vazio com sugestões de como começar numa
conversa sem mensagens, e mensagens de erro claras para falha de rede, sistema de chamados
indisponível, limite de requisições do provedor e sessão expirada (levando ao login).

#### Scenario: Sistema de chamados indisponível
- **WHEN** uma resposta indica que o sistema de chamados está indisponível
- **THEN** o chat mostra o aviso "Sistema de chamados indisponível" sem esconder o histórico

#### Scenario: Sessão expirada
- **WHEN** uma chamada à API responde 401
- **THEN** o funcionário é levado para `/login`
