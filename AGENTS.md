<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## OABase — regras do projeto

**A fronteira aberto/pago é a regra mais importante do repositório.**

- Rotas públicas (`/`, `/legislacao`, `/exames`, `/estatisticas`, `/precos`, `/blog`) são
  indexáveis, renderizadas no servidor com ISR e entram no sitemap.
- Tudo sob `/app` é produto pago: `robots: { index: false }` na rota **e**
  `Disallow` em `robots.ts`. Nunca depender de um mecanismo só.
- Nenhuma página indexável pode exigir login, e nenhuma página paga pode
  entrar no sitemap. Mostrar conteúdo ao Googlebot e login ao usuário é
  cloaking — penalização, não brecha.

**Portão de qualidade.** `Artigo.indexavel` controla se a página entra no
índice. Sem comentário revisado, a página existe e é útil, mas sai do sitemap
e recebe `noindex`. Isso protege o domínio de ser avaliado como conteúdo raso
quando a base escalar para dezenas de milhares de URLs. O sitemap consome
`getArtigosIndexaveis()`, nunca a lista completa.

**Dados.** `src/lib/content/queries.ts` é o único ponto que toca a origem dos
dados. Hoje lê arrays de `data.ts`; na Fase 0 vira Supabase sem que nenhuma
página mude. Não busque dado direto em componente de página.

**Datas.** Use `formatarData()` de `src/lib/format.ts`. `new Date("YYYY-MM-DD")`
é parseado como UTC e volta um dia em fuso brasileiro.

**Escala.** Rotas dinâmicas usam `generateStaticParams` só com o top-N por
incidência mais `dynamicParams: true`. Nunca gerar a base inteira no build.

## Banco de dados

O projeto está ligado ao Supabase remoto (`supabase link` já foi feito) e o
`.env.local` aponta para lá. `supabase/migrations/` guarda o schema;
`supabase/seed.sql` reproduz os dados de exemplo.

```bash
supabase db push      # aplica migrations pendentes no projeto remoto
supabase start        # sobe uma stack local (Postgres + Auth) para testar antes
supabase db reset     # reaplica migrations + seed no banco LOCAL
supabase stop         # derruba a stack local
```

Migration nova sempre vai primeiro para o local (`supabase db reset`), depois
para o remoto (`supabase db push`). `db push` não roda o seed — em banco novo,
aplique `seed.sql` por psql.

**A fronteira aberto/pago é aplicada por RLS, não por código.** `disciplinas`,
`leis`, `artigos`, `exames`, `sumulas`, `termos_glossario` e `posts` liberam
SELECT para o papel anônimo. `questoes` e `comentarios` exigem
`public.tem_assinatura_ativa()`. Tabelas de usuário exigem `auth.uid()`.

O app usa **sempre a chave anônima**, inclusive no servidor: se uma rota nova
consultar `questoes` por engano, o RLS devolve zero linhas em vez de vazar o
produto. A service role pertence só ao pipeline de ingestão, que roda fora do
Next.

**Coluna gerada com array não funciona.** `array_to_string` é STABLE e o
Postgres exige IMMUTABLE em expressão de geração — por isso
`artigos.search_vector` é mantida por trigger (`artigos_indexa_busca`).
Ao mexer em `numero`, `caput` ou `comentario`, confira que o trigger cobre a
coluna.

## Origem dos dados

`src/lib/content/queries.ts` escolhe entre duas implementações do contrato
`FonteDeConteudo`: `fonte-supabase.ts` quando há credenciais no ambiente,
`fonte-mock.ts` quando não há. Nenhuma página sabe qual está ativa — foi isso
que permitiu desenhar o site antes de existir banco. Ao adicionar uma consulta,
adicione nas duas implementações e no contrato, nunca direto na página.

## Links internos

Não linke para rota que ainda não existe. Link interno para 404 gasta orçamento
de rastreamento, e num site cuja aquisição é 100% orgânica isso é custo direto.
Pendentes da camada aberta: `/sumulas`, `/glossario`, `/blog`, `/sobre`,
`/termos`, `/privacidade`.

## Ingestão de provas

`ingest/` é um projeto Python separado (stdlib + `pdftotext` + `psql`, sem
dependências). Ver `ingest/README.md`.

**O que é dado real e o que é placeholder** — importa não confundir:

| Real, de fonte oficial | Placeholder |
|---|---|
| `questoes` do 43º Exame (80, das quais 2 anuladas) | `disciplinas.media_por_prova` |
| `exames.data_prova` do 43º (27/04/2025) | `leis`, `artigos` e seus comentários |
| gabarito definitivo, tipo 1 | |

Exames **não** são semeados por `seed.sql`: entram pelo pipeline, com data
vinda do edital. Datas inventadas em seed ficam indistinguíveis de datas reais
assim que convivem na mesma tabela.

A distribuição por disciplina exibida na landing e em `/estatisticas` ainda sai
de `media_por_prova`, que é estimativa. Ela só pode ser calculada dos dados
reais quando houver questões com `disciplina_confirmada = true` em volume.

## Autenticação

Supabase Auth por e-mail/senha, com sessão em cookie via `@supabase/ssr`.

- `src/proxy.ts` — no Next 16 o antigo `middleware` chama-se **`proxy`**
  (`export function proxy` + `export const proxyConfig`). Ele renova a sessão
  a cada navegação, porque é o único lugar que pode escrever cookie antes da
  renderização, e guarda a porta de `/app`.
- `src/lib/supabase/servidor.ts` — cliente com sessão para Server Components.
- `src/lib/supabase/browser.ts` — cliente do navegador.

**O cabeçalho do site público é estático de propósito.** Ler cookie no layout
raiz tornaria *todas* as páginas dinâmicas e derrubaria a geração estática do
conteúdo — que é a base inteira da estratégia de busca. O estado de sessão só
aparece dentro de `/app`, que tem layout próprio. Não mova essa leitura para
cima.

**A checagem no proxy é de porta, não de segurança.** Quem decide é o RLS:
mesmo que a rota falhasse, o banco não devolveria questão nenhuma sem
assinatura ativa. O app usa sempre a chave anônima.

**`perfis` é criado por trigger** em `auth.users`, não pela aplicação: no
instante do cadastro ainda não existe sessão, então `auth.uid()` é nulo e
qualquer política de dono barraria a inserção.

**Nada de `useSearchParams` em formulário de autenticação.** Ele obriga um
limite de Suspense e tira o formulário do HTML inicial — o campo de login
precisa existir antes de o JS rodar. Leia o parâmetro de `window.location` na
hora do envio.
