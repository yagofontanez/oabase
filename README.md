# OABase

> Seu sistema de estudos em Direito.

[OABase](https://oabase.com.br) reúne planejamento de estudo, prática com provas, revisão e fontes jurídicas oficiais. A parte aberta permite pesquisar legislação, súmulas, glossário, exames e estatísticas; as ferramentas de estudo ficam em `/app` e são protegidas por assinatura.

## O que há aqui

- Legislação e súmulas de fonte oficial, com busca sem acento.
- Calendário de exames, provas anteriores e dados de desempenho.
- Resolução de questões, simulados, caderno de erros e revisão espaçada.
- Roadmap e sessões guiadas de estudo.
- Fluxos editoriais para revisão de disciplina, comentários e vínculos.
- MCP para que clientes compatíveis acompanhem o ciclo de estudo do aluno.

## Princípios

- **Conteúdo aberto e produto pago não se misturam.** Rotas públicas são indexáveis; tudo sob `/app` é `noindex`, bloqueado em `robots` e protegido por RLS.
- **A fonte vem antes da resposta.** Legislação, súmulas e provas são atos oficiais. Conteúdo autoral é revisado antes de ser publicado.
- **O banco é a fronteira.** O app usa a chave anônima do Supabase; RLS decide acesso a questões, comentários, dados pessoais e operações internas.
- **Escala não justifica conteúdo raso.** Uma página de artigo só entra no índice quando `indexavel` está habilitado, normalmente após comentário revisado.

## Stack

- [Next.js 16](https://nextjs.org/) + React 19 + TypeScript;
- Tailwind CSS 4;
- Supabase (Postgres, Auth e RLS);
- Netlify para deploy e funções agendadas;
- Python stdlib + `pdftotext` + `psql` no pipeline de ingestão.

## Rodar localmente

### Pré-requisitos

- Node.js 22 ou superior;
- pnpm 9;
- Supabase CLI, se for trabalhar no banco;
- `pdftotext` e `psql`, apenas para ingestão.

```bash
git clone git@github.com:yagofontanez/oabase.git
cd oabase
pnpm install
cp .env.example .env.local
pnpm dev
```

Abra [http://localhost:3000](http://localhost:3000). Sem credenciais do Supabase, a camada aberta usa dados de exemplo para facilitar o trabalho de interface.

### Comandos

| Comando | Finalidade |
| --- | --- |
| `pnpm dev` | Inicia o ambiente Next local. |
| `pnpm lint` | Executa o lint. |
| `pnpm build` | Gera a build de produção. |
| `pnpm fronteira` | Verifica a separação entre conteúdo aberto e produto pago. Requer `.env.local`. |
| `pnpm test:mcp` | Testa o servidor MCP. |
| `pnpm mcp` | Inicia o MCP local por stdio. |

## Banco de dados

O schema versionado vive em `supabase/migrations/`; dados de exemplo reproduzíveis estão em `supabase/seed.sql`.

```bash
supabase start
supabase db reset
supabase db push
supabase stop
```

Faça uma migration nova primeiro no banco local. Nunca use a service role no runtime do Next: ela pertence somente a pipelines externos de ingestão.

## Ingestão

O projeto em [`ingest/`](ingest/) carrega provas, legislação, súmulas e dados editoriais a partir de fontes oficiais. Ele não possui dependências Python de terceiros além das ferramentas de sistema.

```bash
cd ingest
python3 -m oabase_ingest.lote --manifesto
python3 -m oabase_ingest.lote --de 32 --ate 46
```

O modo seco é o padrão. Use `--carregar` apenas depois de conferir o resultado. Leia o [guia de ingestão](ingest/README.md) antes de alterar um parser ou gravar no banco.

## MCP

O MCP expõe fontes jurídicas abertas e, para a pessoa autenticada, o próprio ciclo de estudo. Ele nunca oferece operações administrativas, pagamentos, clientes ou ferramentas editoriais.

```bash
pnpm mcp
OABASE_ACCESS_TOKEN=... pnpm mcp
```

Consulte [docs/MCP.md](docs/MCP.md) para configuração local, HTTP, OAuth 2.1 e testes.

## Estrutura

```text
src/app/                 rotas públicas, produto e APIs
src/lib/content/         contrato e fontes de conteúdo
src/lib/supabase/        clientes Supabase (sempre chave anônima)
src/mcp/                 servidor MCP
supabase/migrations/     schema, funções e políticas RLS
ingest/                  pipeline de fontes oficiais
docs/                    documentação complementar
```

`src/lib/content/queries.ts` é a fronteira de leitura de conteúdo: páginas não consultam a origem dos dados diretamente. Ao criar uma consulta, mantenha o contrato e as implementações mock e Supabase em sincronia.

## Variáveis de ambiente

Copie `.env.example` e preencha somente o necessário para a tarefa atual. Ela documenta Supabase, pagamentos, e-mail, IA, embeddings e MCP.

Nunca exponha ou prefixe com `NEXT_PUBLIC_` chaves de pagamento, e-mail, provedores de IA, cron, webhook ou service role. Nunca versione `.env.local`.

## Contribuir e segurança

Leia [CONTRIBUTING.md](CONTRIBUTING.md) antes de abrir uma alteração e [SECURITY.md](SECURITY.md) para comunicar vulnerabilidades de forma responsável.

## Licença e conteúdo

O código deste repositório é disponibilizado sob a [licença MIT](LICENSE).

A licença do código não altera direitos sobre marcas, identidade visual, conteúdo editorial ou materiais de terceiros. Textos legais, decisões e demais atos oficiais são reproduzidos segundo seu regime jurídico aplicável e devem manter indicação de fonte.
