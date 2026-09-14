# MCP do OABase

O servidor MCP conecta um assistente ao ciclo de estudo do aluno: consultar o
roadmap, preparar e registrar sessões, resolver questões, revisar flashcards e
consultar fontes jurídicas. Não existem ferramentas de administração,
pagamentos, clientes, suporte ou redação editorial.

A implementação usa os pacotes separados da linha 2.0 do SDK MCP e mantém o
fallback stateless para clientes que ainda falam a revisão 2025 do protocolo.

## Capacidades

Fontes abertas:

- `buscar_legislacao` e `buscar_sumulas`;
- resources `oabase://legislacao/{lei_slug}/{artigo_slug}` e
  `oabase://sumulas/{slug}`.

Conta e planejamento:

- `consultar_roadmap`, `preparar_sessao_de_estudo` e
  `o_que_estudar_agora` — este último continua como nome compatível;
- `ver_meu_progresso` e `consultar_revisao_semanal`;
- `abrir_sessao_de_estudo`, `salvar_sessao_de_estudo` e
  `encerrar_sessao_de_estudo`.

Prática e revisão, com assinatura ativa:

- `buscar_questoes` — nunca traz o gabarito;
- `registrar_resposta` — exige `idempotency_key` e corrige no banco;
- `explicar_questao` — só libera o comentário depois de uma tentativa do
  próprio aluno;
- `consultar_revisoes_pendentes` e `revisar_flashcard`.

As respostas bem-sucedidas trazem `structuredContent` validado por
`outputSchema` e uma cópia JSON em texto para clientes antigos. Erros usam
códigos estáveis, como `AUTH_REQUIRED`, `SUBSCRIPTION_REQUIRED`, `NOT_FOUND`
e `PRECONDITION_REQUIRED`.

## Rodar localmente por stdio

Sem token, somente as ferramentas de fonte aberta funcionam:

```bash
pnpm mcp
```

Para usar os próprios dados, o processo local recebe o access token da sessão:

```bash
OABASE_ACCESS_TOKEN=... pnpm mcp
```

Exemplo de configuração de cliente local:

```json
{
  "mcpServers": {
    "oabase-estudos": {
      "command": "pnpm",
      "args": ["--dir", "/caminho/para/oabase", "mcp"],
      "env": {
        "NEXT_PUBLIC_SUPABASE_URL": "https://seu-projeto.supabase.co",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY": "sb_publishable_...",
        "OABASE_ACCESS_TOKEN": "token-da-sessao"
      }
    }
  }
}
```

O stdout é reservado ao protocolo. Logs estruturados vão para stderr e não
incluem prompts, conteúdo jurídico nem tokens.

## Hospedar por Streamable HTTP

```bash
MCP_TRANSPORT=http \
MCP_HOST=127.0.0.1 \
MCP_PORT=8787 \
MCP_PUBLIC_URL=https://mcp.oabase.com.br/mcp \
MCP_ALLOWED_HOSTS=mcp.oabase.com.br \
MCP_ALLOWED_ORIGINS=https://chatgpt.com,https://claude.ai \
pnpm mcp
```

O modo HTTP:

- exige `Authorization: Bearer` em toda chamada ao endpoint;
- valida o token no Supabase antes de criar o servidor daquele usuário;
- anuncia OAuth Protected Resource Metadata em
  `/.well-known/oauth-protected-resource/mcp`;
- aplica allowlists de `Host` e `Origin`, limite de corpo, timeout e rate
  limit por usuário;
- expõe `GET /health` sem dados de conta.

`MCP_RATE_LIMIT` controla chamadas por minuto, e
`MCP_MAX_BODY_BYTES` controla o corpo máximo. O padrão é 60 chamadas/minuto e
1 MiB.

## Ativar OAuth 2.1 no Supabase

O código da tela de consentimento fica em `/oauth/consent`. Para o fluxo
automático funcionar no ambiente remoto, ainda é necessário configurar no
painel do projeto:

1. habilitar **Authentication > OAuth Server**;
2. definir `/oauth/consent` como Authorization Path;
3. usar chave assimétrica de assinatura JWT;
4. habilitar Dynamic Client Registration se clientes MCP não forem
   cadastrados previamente;
5. revisar as URLs de redirect aceitas.

Tokens OAuth continuam sendo tokens do próprio Supabase, então as políticas
RLS existentes recebem `auth.uid()` normalmente. A chave usada pelo servidor
permanece anônima; nenhuma service role entra no MCP.

## Testes e operação

```bash
pnpm test:mcp
pnpm lint
pnpm build
```

Antes de publicar uma mudança de ferramentas, teste pelo menos: listagem e
schemas; usuário anônimo; conta sem assinatura; duas identidades diferentes;
comentário antes/depois da resposta; retry com a mesma idempotency key; busca
de súmula; início, salvamento e encerramento de sessão.
