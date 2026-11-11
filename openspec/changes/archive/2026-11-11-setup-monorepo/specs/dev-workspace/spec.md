# Spec Delta

## Purpose

Define como o desenvolvedor instala, executa, testa, verifica tipos e gera build de todos os projetos do
monorepo Nexo Assist a partir de comandos únicos na raiz.

## ADDED Requirements

### Requirement: Instalação única do workspace
O repositório SHALL instalar as dependências de todos os projetos (`apps/web`, `apps/tickets-api`,
`packages/shared`, `packages/agent`) com um único `pnpm install` na raiz, resolvendo pacotes internos
como links do workspace.

#### Scenario: Instalação limpa
- **WHEN** o desenvolvedor executa `pnpm install` na raiz de um clone limpo
- **THEN** o comando termina com sucesso e os quatro projetos ficam com suas dependências instaladas

#### Scenario: Pacote interno resolvido localmente
- **WHEN** um projeto declara dependência de outro pacote `@nexo/*`
- **THEN** a dependência é declarada como `workspace:*` e resolve para o código local do repositório

### Requirement: Ambiente de desenvolvimento com um comando
O comando `pnpm dev` na raiz SHALL subir o `web` na porta 3000 e o `tickets-api` na porta 3001 ao mesmo
tempo, com recarga ao salvar arquivos.

#### Scenario: Subir os dois apps
- **WHEN** o desenvolvedor executa `pnpm dev` na raiz sem `.env` configurado
- **THEN** `http://localhost:3000` serve a página inicial do web e `http://localhost:3001/health` responde 200

#### Scenario: Recarga ao editar
- **WHEN** um arquivo-fonte do `tickets-api` é alterado com `pnpm dev` rodando
- **THEN** o servidor reinicia sozinho e passa a refletir a alteração

### Requirement: Página inicial do web
O `web` SHALL servir em `/` uma página simples em português identificando o produto Nexo Assist,
estilizada com as utilidades do Tailwind.

#### Scenario: Acessar a raiz
- **WHEN** o usuário abre `http://localhost:3000/`
- **THEN** a página responde 200 e exibe o nome "Nexo Assist"

### Requirement: Testes de todos os projetos
O comando `pnpm test` na raiz SHALL executar os testes de todos os projetos em uma única execução e
terminar com código de saída diferente de zero se algum teste falhar.

#### Scenario: Suíte inicial passando
- **WHEN** o desenvolvedor executa `pnpm test` na raiz logo após a instalação
- **THEN** os testes de exemplo são executados e todos passam, com código de saída 0

#### Scenario: Teste falhando
- **WHEN** algum teste de qualquer projeto falha
- **THEN** `pnpm test` termina com código de saída diferente de zero

### Requirement: Tipagem estrita
Todos os projetos SHALL compilar em modo estrito do TypeScript a partir de uma configuração base
compartilhada, e o comando `pnpm typecheck` na raiz SHALL verificar todos eles.

#### Scenario: Verificação de tipos
- **WHEN** o desenvolvedor executa `pnpm typecheck` na raiz
- **THEN** todos os projetos são verificados com `strict` ativo e o comando termina com código 0

#### Scenario: Erro de tipo em qualquer projeto
- **WHEN** um projeto contém um erro de tipo
- **THEN** `pnpm typecheck` termina com código de saída diferente de zero

### Requirement: Build de produção
O comando `pnpm build` na raiz SHALL gerar o build de produção do `web` e do `tickets-api`, e o build
do `tickets-api` SHALL poder ser iniciado com `pnpm --filter @nexo/tickets-api start`.

#### Scenario: Build completo
- **WHEN** o desenvolvedor executa `pnpm build` na raiz
- **THEN** o comando termina com código 0 e gera os artefatos de produção dos dois apps

### Requirement: Arquivos locais fora do versionamento
O repositório SHALL ignorar no git dependências, saídas de build, caches, bancos SQLite locais e
arquivos `.env` reais, mantendo versionados apenas os `.env.example`.

#### Scenario: Status limpo após rodar tudo
- **WHEN** o desenvolvedor executa `pnpm install`, `pnpm build` e `pnpm test` e cria um `.env` local
- **THEN** `git status` não lista nenhum arquivo gerado nem o `.env`
