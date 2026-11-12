# Spec Delta

## MODIFIED Requirements

### Requirement: Página inicial do web
O `web` SHALL tratar `/` como ponto de entrada: sem sessão, SHALL redirecionar para `/login`; com
sessão de funcionário, para `/chat`; com sessão de analista, para `/console`.

#### Scenario: Acessar a raiz
- **WHEN** o usuário sem sessão abre `http://localhost:3000/`
- **THEN** é redirecionado para `/login`, que responde 200 e exibe o nome "Nexo Assist"

#### Scenario: Acessar a raiz logado
- **WHEN** um funcionário com sessão válida abre `http://localhost:3000/`
- **THEN** é redirecionado para `/chat`
