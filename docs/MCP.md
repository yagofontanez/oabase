# MCP do OABase

O servidor MCP expõe o OABase como uma ferramenta de estudo. Ele não possui
ferramentas de administração, pagamentos, clientes ou redação editorial.

## Ferramentas

Públicas (sem sessão): `buscar_legislacao` e `buscar_sumulas`.

Autenticadas (a RLS do Supabase continua decidindo o acesso):

- `buscar_questoes` — fila sem gabarito antecipado;
- `explicar_questao` — somente comentário autoral já publicado;
- `registrar_resposta` — correção feita no banco;
- `ver_meu_progresso`;
- `o_que_estudar_agora`;
- `abrir_sessao_de_estudo`.

O token da sessão nunca é colocado nas ferramentas nem no prompt. Para usar
dados pessoais, defina `OABASE_ACCESS_TOKEN` com o access token da sessão do
próprio aluno. Sem ele, chamadas pessoais seguem a RLS e não recebem dados.

## Rodar localmente (stdio)

```bash
OABASE_ACCESS_TOKEN=... pnpm mcp
```

Configuração de um cliente que inicia processos, como o Claude Desktop:

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

O stdout é reservado ao protocolo MCP; logs vão para stderr.

## Rodar remoto (Streamable HTTP)

```bash
MCP_TRANSPORT=http MCP_PORT=8787 pnpm mcp
```

O endpoint é `/mcp`. Em produção, coloque-o atrás de HTTPS e autenticação do
seu provedor. A primeira versão usa `OABASE_ACCESS_TOKEN` no processo; uma
próxima etapa pode trocar isso por OAuth por usuário, sem transformar o MCP em
uma porta de acesso administrativo.
