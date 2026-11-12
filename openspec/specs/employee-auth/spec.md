# employee-auth Specification

## Purpose

Identifica quem está usando o web (funcionário ou analista) a partir do e-mail corporativo, mantém essa
identidade numa sessão segura e protege páginas e rotas, para que toda ação aja só em nome do usuário
logado.

## Requirements

### Requirement: Login por e-mail corporativo
A tela de login SHALL aceitar e-mail corporativo e senha. A senha SHALL ser aceita com qualquer valor
não vazio. O funcionário SHALL ser identificado consultando o serviço de chamados pelo e-mail; e-mail
desconhecido SHALL exibir erro na própria tela, sem criar sessão.

#### Scenario: Funcionário do seed
- **WHEN** o usuário entra com `ana.souza@nexo.com.br` e qualquer senha
- **THEN** a sessão é criada e ele é levado para `/chat`

#### Scenario: E-mail desconhecido
- **WHEN** o usuário entra com um e-mail válido que não pertence a ninguém
- **THEN** a tela de login exibe "E-mail não encontrado" (ou mensagem equivalente) e nenhuma sessão é criada

#### Scenario: Campos inválidos
- **WHEN** o usuário envia o formulário com e-mail malformado ou senha vazia
- **THEN** a tela exibe o erro do campo e nenhuma sessão é criada

#### Scenario: Serviço de chamados fora do ar
- **WHEN** o usuário tenta entrar e o serviço de chamados está indisponível
- **THEN** a tela exibe que o sistema está indisponível no momento, sem criar sessão

### Requirement: Sessão em cookie assinado
A sessão SHALL ser guardada em cookie httpOnly, `SameSite=Lax`, assinado com o segredo de sessão
configurado, contendo o id do funcionário, o papel e a expiração. Cookie ausente, adulterado ou
expirado SHALL ser tratado como sem sessão.

#### Scenario: Cookie adulterado
- **WHEN** uma requisição chega com o cookie de sessão alterado (por exemplo, outro `employeeId`)
- **THEN** a requisição é tratada como não autenticada

#### Scenario: Cookie não acessível por script
- **WHEN** a sessão é criada
- **THEN** o cookie é marcado httpOnly e não fica disponível ao JavaScript da página

### Requirement: Destino por papel
Após o login, o funcionário (`employee`) SHALL ir para `/chat` e o analista (`analyst_n1` ou
`analyst_n2`) SHALL ir para `/console`. Um analista que abrir `/chat` SHALL ser redirecionado para
`/console`, e um funcionário que abrir `/console` SHALL ser redirecionado para `/chat`.

#### Scenario: Analista entra
- **WHEN** um analista do seed faz login
- **THEN** é levado para `/console`, que exibe uma página provisória informando que o console chega em breve

#### Scenario: Funcionário tenta o console
- **WHEN** um funcionário logado abre `/console`
- **THEN** é redirecionado para `/chat`

### Requirement: Proteção de páginas e rotas
Páginas autenticadas SHALL redirecionar para `/login` quando não houver sessão válida. Rotas de API,
exceto as de login, SHALL responder 401 sem sessão válida, sem executar a operação.

#### Scenario: Página sem sessão
- **WHEN** um visitante sem sessão abre `/chat`
- **THEN** é redirecionado para `/login`

#### Scenario: API sem sessão
- **WHEN** um cliente sem sessão chama `POST /api/chat`
- **THEN** recebe 401 e o agent não é chamado

#### Scenario: Usuário logado abre o login
- **WHEN** um funcionário com sessão válida abre `/login`
- **THEN** é redirecionado para `/chat`

### Requirement: Logout
O usuário SHALL poder sair, o que apaga o cookie de sessão e leva para `/login`.

#### Scenario: Sair
- **WHEN** o funcionário clica em "Sair"
- **THEN** o cookie de sessão é removido e ele vê a tela de login; voltar para `/chat` redireciona para `/login`
