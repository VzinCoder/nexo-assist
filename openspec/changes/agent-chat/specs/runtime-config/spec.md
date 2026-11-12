# Spec Delta

## MODIFIED Requirements

### Requirement: Padrões para desenvolvimento local
As variáveis não secretas SHALL ter valores padrão que permitem rodar localmente sem `.env`: `PORT`
3001, `HOST` `0.0.0.0`, `DATABASE_FILE` `tickets.db`, `FAILURE_RATE` 0 e `LATENCY_MS` 0 no
`tickets-api`, e `TICKETS_API_URL` `http://localhost:3001`, `WEB_DATABASE_FILE` `web.db` e
`LLM_MODEL` `google/gemini-3.5-flash-lite` no `web`. Fora de produção, `SERVICE_TOKEN` (nos dois apps,
com o mesmo valor padrão) e `SESSION_SECRET` (no `web`) SHALL ter valores padrão de desenvolvimento.

#### Scenario: Sem arquivo .env
- **WHEN** os apps são iniciados sem nenhuma variável definida
- **THEN** o `tickets-api` escuta na porta 3001, sem falhas nem latência simuladas, e o `web` aponta para `http://localhost:3001`, autentica-se nele com o token padrão e usa o modelo padrão

#### Scenario: Valor sobrescrito
- **WHEN** o `tickets-api` é iniciado com `PORT=4001`
- **THEN** ele escuta na porta 4001

## ADDED Requirements

### Requirement: Segredos do web obrigatórios em produção
Com `NODE_ENV=production`, o `web` SHALL exigir `SESSION_SECRET` com pelo menos 32 caracteres e
`SERVICE_TOKEN` com pelo menos 16, e SHALL falhar na inicialização citando a variável que faltar.

#### Scenario: Produção sem segredo de sessão
- **WHEN** o `web` é iniciado com `NODE_ENV=production` e sem `SESSION_SECRET`
- **THEN** a inicialização falha e a mensagem cita `SESSION_SECRET`

### Requirement: Modelo de LLM no formato provedor/modelo
O `web` SHALL aceitar `LLM_MODEL` apenas no formato `provedor/modelo` e SHALL ler a chave do provedor
de `GOOGLE_GENERATIVE_AI_API_KEY`, que é opcional na inicialização. Sem a chave, o chat SHALL responder
com aviso claro de que o assistente não está configurado, sem quebrar as demais telas.

#### Scenario: Modelo malformado
- **WHEN** o `web` é iniciado com `LLM_MODEL=gemini`
- **THEN** a inicialização falha e a mensagem cita `LLM_MODEL`

#### Scenario: Sem chave do provedor
- **WHEN** o `web` roda sem `GOOGLE_GENERATIVE_AI_API_KEY` e o funcionário envia uma mensagem
- **THEN** o login e o histórico funcionam e o chat avisa que o assistente não está configurado, sem chamar o provedor
