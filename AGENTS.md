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
Pendentes da camada aberta: `/sumulas`, `/glossario`, `/blog`.
`/sobre`, `/termos` e `/privacidade` já existem e estão no rodapé.

## Ingestão de provas

`ingest/` é um projeto Python separado (stdlib + `pdftotext` + `psql`, sem
dependências). Ver `ingest/README.md`.

**O que é dado real e o que é placeholder** — importa não confundir:

| Real, de fonte oficial | Placeholder |
|---|---|
| `questoes`: 3.460, do 3º ao 46º Exame (43 edições, 16 anuladas) | `disciplinas.media_por_prova` |
| `exames.data_prova`, cada uma vinda do edital | `questoes.disciplina_id` (léxico + sequência, nenhuma confirmada) |
| gabarito, tipo 1 — definitivo em 13 edições, preliminar nas demais (`exames.gabarito_definitivo`) | |
| `leis` e `artigos`: 8 códigos, 5.756 artigos do Planalto | |
| `artigos.incidencia`: 155 vínculos em 106 artigos, só de citação explícita | |

Exames **não** são semeados por `seed.sql`: entram pelo pipeline, com data
vinda do edital. Datas inventadas em seed ficam indistinguíveis de datas reais
assim que convivem na mesma tabela.

A distribuição por disciplina exibida na landing e em `/estatisticas` ainda sai
de `media_por_prova`, que é estimativa. Ela só pode ser calculada dos dados
reais quando houver questões com `disciplina_confirmada = true` em volume.

**O arquivo da OAB exige HTTPS para tudo até o 31º Exame.** Os links saem da
página em `http://`, e em `http://` o `s.oab.org.br` devolve **502 em toda a
faixa antiga** — 32º responde 200, 31º para trás não. O mesmo endereço em
`https://` devolve 200 e o PDF inteiro. O corte por edição é tão limpo que a
leitura natural é migração de armazenamento que deixou os objetos antigos
para trás, e foi essa leitura que custou vinte e nove edições dadas como
perdidas: espaçamento, User-Agent, Referer, GET no lugar de HEAD e Internet
Archive foram todos testados antes dos quatro caracteres que resolviam.
`_em_https()` sobe o esquema dentro de `_obter`, então vale também para
manifesto já salvo. Erro de servidor com fronteira exata demais é suspeita
contra o cliente, não contra o servidor.

**O rótulo do caderno muda com a época** — `Caderno de Prova - Tipo 1` do 18º
em diante, `Caderno de Prova 01` até o 17º. A descoberta aceitava só a
primeira forma, e por isso dezesseis edições apareciam como "sem prova"
quando o link estava na página. Ao mexer nesse filtro, lembre que
`Caderno de Prova (Direito Civil)` também casa com "caderno de prova" e é o
caderno da **2ª fase** — a exclusão é pela ausência de parêntese.

## Ingestão de legislação

`ingest/oabase_ingest/legislacao.py` baixa o texto oficial compilado do
Planalto e carrega em `artigos`. Ver `ingest/README.md` para as armadilhas do
formato de origem.

```bash
cd ingest
python3 -m oabase_ingest.legislacao --sql /tmp/l.sql   # ensaio, não grava
python3 -m oabase_ingest.legislacao --carregar         # grava
python3 -m oabase_ingest.legislacao --lei codigo-civil --carregar
```

Três regras que a carga respeita e que não devem ser afrouxadas:

1. **O upsert não toca em linha com comentário.** A cláusula é
   `where public.artigos.comentario = '{}'`. Texto de lei se atualiza sozinho
   enquanto ninguém escreveu sobre ele; a partir do comentário, a linha é
   trabalho autoral e mudança de redação vira revisão humana.
2. **Tudo entra com `indexavel = false`.** São 5.756 páginas de texto legal que
   existem em centenas de outros sites. Elas servem para consulta e para
   navegação interna; ao índice só vai o que tiver comentário. Já as páginas
   de lei (`/legislacao/<slug>`) entram no sitemap: são índices completos e
   navegáveis, não cópia de texto.
3. **`ordem` vem do número, não da posição de chegada.** É o que permite
   percorrer a lei em sequência e achar o vizinho anterior/seguinte sem
   recarregar a lei inteira, e sobrevive a uma carga parcial.

O PostgREST devolve no máximo mil linhas e não avisa quando corta — o Código
Civil tem 2.081 artigos. Qualquer consulta que precise da lei inteira passa por
`todasAsPaginas()` em `fonte-supabase.ts`.

## Resolução de questões

`/app/questoes` monta uma fila e resolve questão por questão sem recarregar a
página. Três funções no banco sustentam a tela, e a divisão entre elas é
deliberada:

- `fila_de_questoes(modo, exame, disciplina, limite)` — **security invoker**,
  para que a RLS de `questoes` continue decidindo o acesso: sem assinatura
  ativa a fila volta vazia. **O gabarito não está entre as colunas
  devolvidas.** Ele nunca sai do banco rumo ao navegador antes da resposta,
  senão bastaria abrir o inspetor para gabaritar a prova inteira.
- `registrar_resposta(questao, alternativa, tempo_ms)` — **security definer**,
  pelo motivo oposto: quem compara com o gabarito é o banco. Se `acertou`
  viesse do cliente, a taxa de acerto do painel seria ficção — e ela é o
  número que diz se dá para passar. A função repete a checagem de assinatura
  porque `security definer` ignora a RLS; sem isso ela seria a porta dos
  fundos do produto pago.
- `meu_desempenho()` — conta por **questão**, não por tentativa. Quem errou
  uma questão três vezes e acertou na quarta tem uma questão dominada, não
  três erros. É `distinct on (questao_id)` ordenado por data, consulta que o
  PostgREST não expressa — daí a função.

`/api/responder` é fina de propósito: recebe questão e alternativa, chama a
função e devolve `{acertou, gabarito, comentario}`. Qualquer regra aplicada
na rota, e não no banco, seria uma regra contornável.

**Revisão espaçada.** SM-2 enxuto dentro de `registrar_resposta`: acerto
multiplica o intervalo pela facilidade (teto 2.8); erro joga para amanhã e
derruba a facilidade em 0.2 (piso 1.3). Errar tem de doer no calendário, não
só no número.

**Anuladas ficam fora da fila.** Não têm resposta certa para treinar.
Continuam no acervo como material de estudo, e é assim que `/desempenho` as
apresenta.

**Comentário de questão é trabalho autoral e ainda não existe** — a tabela
`comentarios` está vazia. A tela diz isso com todas as letras em vez de
preencher o espaço: gerar explicação jurídica por IA é o pior defeito
possível aqui, porque quem estuda a regra alucinada só descobre no dia da
prova.

**A classificação por disciplina é aproximada.** 2.751 das 3.460 questões têm
`disciplina_id`, nenhuma tem `disciplina_confirmada = true`. O filtro por
disciplina funciona e a tela avisa que é aproximado; filtro por exame é
exato. Enquanto `disciplina_confirmada` for falso em toda a base, não existe
gráfico de evolução por matéria — seria dado inventado com cara de medição.

## Revisão editorial

Os dois gargalos do projeto são trabalho humano: 3.460 questões classificadas
por heurística e nenhuma confirmada; 5.756 artigos e quatro comentados.
`/app/revisao` (triagem de disciplina) e `/app/redacao` (comentário) existem
para tirar o atrito desse trabalho, não para fazê-lo.

**O sinalizador de editor não mora em `perfis`.** A política de `perfis` é de
dono com `with check (auth.uid() = id)` — uma coluna `editor` ali seria uma
coluna que a própria pessoa marca como verdadeira, do navegador, com a chave
anônima. Fica em `interno.editores`, ao lado dos segredos, e se concede por
SQL:

```sql
insert into interno.editores (user_id)
select id from auth.users where email = '...';
```

**As telas ficam sob `/app`** — a fronteira que protege o produto pago já as
cobre (`noindex` na rota, `Disallow` no robots). A checagem na página é de
porta; quem decide é `sou_editor()` dentro de cada função.

**`fila_de_revisao` não devolve `gabarito`.** Quem classifica por disciplina
não precisa da resposta, e o que não sai do banco não vaza. É `security
definer` porque editor não é necessariamente assinante.

**Confirmar é afirmar que alguém leu**, então não existe confirmar sem
escolher disciplina: marcar `disciplina_confirmada` com o campo vazio
transformaria "ninguém sabe" em "alguém verificou".

**O portão de qualidade virou invariante do banco.** `publicar_comentario`
recusa `indexavel = true` sem comentário. Estava certo no código do sitemap e
na cabeça de quem escreveu; agora é impossível de violar por engano — que é a
diferença entre uma regra e um combinado.

## Quadro de anotações

`/app/anotacoes` é uma tela livre (React Flow, `@xyflow/react`) com cartões de
anotação e de questões já respondidas, ligáveis entre si.

**A ligação não tem semântica no banco** — só origem, destino e um rótulo em
texto. Tipar a aresta ("causa", "exceção", "fundamento") seria impor um
esquema de estudo que ninguém pediu; o sentido é de quem escreve.

**Posição é dado, não enfeite.** `x` e `y` são gravados a cada `onNodeDragStop`.
Um quadro que reorganiza os cartões sozinho a cada abertura deixa de ser um
quadro.

**O quadro escreve direto do navegador**, com a chave anônima e a sessão de
quem está logado — como `sessoes_foco` já fazia. Não há segredo a proteger
(nada de gabarito, nada de preço), então a política de dono com `with check`
basta. Não invente rota de API para isto.

**O construtor de consulta do supabase-js é um _thenable_ preguiçoso.**
`void supabase.from(...).update(...)` **não dispara requisição nenhuma** — sem
alguém chamando `then`, o fetch nunca acontece. É a falha silenciosa perfeita:
a tela mostra o texto salvo até a pessoa recarregar. Sempre `await`.

**A gravação com atraso acumula campos.** Guardar só o último lote perdia o
título de quem escrevia o título e passava para o corpo em menos de meio
segundo — que é o que todo mundo faz. O mapa `pendentes` mescla os campos e é
descarregado no desmonte do componente.

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

## Pagamento (Asaas)

**Sandbox é o padrão.** Só vira produção com `ASAAS_AMBIENTE=producao` escrito
explicitamente. O pior defeito possível aqui é cobrar dinheiro real por engano,
e padrão inseguro transforma qualquer descuido de configuração nesse defeito.
Cada cobrança grava o ambiente em que nasceu, para que uma de teste nunca seja
confundida com uma real depois.

**Chaves com `$` precisam de escape no `.env`.** As chaves da Asaas começam com
`$aact_`, e o dotenv do Next expande `$VAR` — entre aspas duplas ou simples o
valor chega **vazio**, sem erro nenhum. A única forma que funciona é
`ASAAS_API_KEY="\$aact_..."`. Se um dia a chave "sumir", é isto.

**O valor nunca vem do cliente.** `/api/assinar` recebe só a chave do plano; o
preço é lido de `src/lib/planos.ts` no servidor. Aceitar valor do navegador
deixaria qualquer pessoa comprar o anual por um real.

**Cobrança não é gravada por política de RLS.** `cobrancas` só libera `select`
ao dono; a escrita passa pela função `registrar_cobranca`, que é
`security definer` e define dono e status por conta própria. Liberar `insert`
ao papel autenticado deixaria o navegador forjar um pagamento confirmado — e o
servidor não pode usar service role, porque ele usa a chave anônima com a
sessão de quem está logado.

**CPF e telefone** vivem em `perfis`, cuja política restringe ao dono. Nenhuma
rota pública lê essa tabela.

**O webhook é o que transforma compra em acesso.** `/api/asaas/webhook`
recebe o evento, e sem ele `assinaturas` nunca é escrita — a pessoa paga e
continua sem plano. Requisição de máquina não tem sessão, então a RLS não tem
em quem se apoiar; a resposta **não** é service role no Next (ela pertence ao
pipeline de ingestão, fora daqui). São três guardas independentes:

1. o token do cabeçalho `asaas-access-token`, conferido quando
   `ASAAS_WEBHOOK_TOKEN` está configurado;
2. a **reconsulta em `GET /payments/{id}`** — o corpo do POST vem de uma URL
   pública e nada nele é levado a sério; o status que vale é o da Asaas;
3. o segredo em `interno.segredos`, esquema sem permissão para papel nenhum,
   exigido por `confirmar_pagamento`, `cancelar_pagamento` e
   `plano_da_cobranca`. Sem ele, qualquer pessoa com um id de fatura vazado —
   e o id aparece na própria URL da fatura — se daria um plano.

**A confirmação tem um caminho só.** `src/lib/pagamento/confirmar.ts` —
reconsultar na Asaas, ler o plano do nosso banco, calcular os dias, chamar
`confirmar_pagamento`, avisar por e-mail. O webhook chama, e a reconciliação
chama. Duas cópias divergiriam na primeira mudança, e de forma invisível: o
caminho do webhook é exercitado todo dia, o da reconciliação só quando algo
já deu errado.

**A reconciliação é a rede do webhook.** `/api/tarefas/reconciliar`, de hora
em hora pela Netlify, pega as cobranças ainda `PENDING`, pergunta à Asaas
quais foram pagas e confirma. Existe porque o acesso pago inteiro depende de
um POST chegar: se ele não chega, a pessoa paga e nada acontece — e a
primeira notícia viria por reclamação. Cada linha reconciliada sai como
`console.error`, porque não é operação normal: é sinal de que o webhook
quebrou e é ele que precisa de conserto.

**A fronteira aberto/pago tem teste.** `pnpm fronteira` fala com o PostgREST
com a mesma chave anônima do navegador e afirma as duas metades: leis,
artigos, exames e disciplinas respondem; questões, comentários, perfis e
assinaturas voltam vazios; escrita direta é recusada; as funções de segredo
exigem o segredo. É a única regra do projeto que nenhum tipo protege — uma
política derrubada numa migration não quebra build, lint nem tela. Rode antes
de subir migration que mexa em RLS.

**Confirmar duas vezes não pode dobrar a validade.** A Asaas reenvia o evento
até receber 2xx. `confirmar_pagamento` sai pela porta dos fundos quando a
cobrança já está `CONFIRMED`. Pelo mesmo motivo, evento irrelevante devolve
200: 500 põe a Asaas num laço de retentativa eterno. A exceção é falha nossa
— aí 500 é o certo, porque perder a confirmação é alguém pagar e não receber.

**Renovação soma ao que resta.** Quem renova uma semana antes não pode perder
a semana que já pagou; a base do cálculo é `max(fim)` da assinatura ativa.

**`cortesia` é um plano do banco, não do produto.** Acesso liberado sem
pagamento (convidado, parceiro, teste longo). Está na restrição de
`assinaturas` e **fora** da de `cobrancas` — cortesia não tem fatura — e fora
de `planos.ts`, que é o que `/api/assinar` lê: o que não está lá não pode ser
comprado. Concede-se por SQL:

```sql
insert into public.assinaturas (user_id, plano, status, inicio, fim)
select id, 'cortesia', 'ativa', now(), timestamptz '2126-01-01'
from auth.users where email = '...';
```

Não use `anual` com `fim` distante no lugar disso: cortesia disfarçada de
venda some da receita só se alguém lembrar de descontar à mão, e volta como
churn no dia em que expirar. `/app/configuracoes` trata o caso — mostra
"Cortesia" e esconde a data de sentinela, que não é informação para ninguém.

**A duração vai em dias, do TypeScript para o banco.** `ate-a-prova` depende
da data do próximo exame, que mora em `src/lib/content/data.ts`. Duplicar essa
data numa tabela de configuração criaria duas verdades que sairiam de
sincronia no primeiro edital novo — então o banco responde qual plano foi
comprado e a rota calcula os dias.

**O calendário é uma lista, não uma data.** `aplicacoes` em `data.ts` guarda
as próximas aplicações em ordem e `getProximoExame()` devolve a primeira que
ainda não aconteceu. Com uma data só, o dia seguinte à prova travava a
contagem regressiva em zero e o `ate-a-prova` passava a vender acesso até
ontem — e o conserto era um deploy na manhã seguinte ao exame. Datas do
cronograma do Conselho Federal (`oab.org.br/noticia/64207`); quando a lista
acabar, a última fica valendo e a contagem trava, que é seguro mas não é
certo — acrescente a próxima assim que o cronograma sair.

**A Asaas responde 404 com corpo vazio.** `await resposta.json()` estoura no
parse e o status HTTP se perde; `chamar()` lê `text()` primeiro. Importa
porque 404 é definitivo (ignorar) e falha de rede não é (repetir).

## Simulado

`/app/simulado` é a prova cronometrada. A diferença para `/app/questoes` não é
cosmética: **não há gabarito até a entrega**. Ver o resultado a cada questão
treina reconhecimento; a prova cobra decisão sob incerteza e sob relógio.

**O relógio é do banco.** `finaliza_em` é gravado na criação e é ele que
autoriza cada marcação. Se o cronômetro morasse no navegador, recarregar a
página zeraria a prova — e um simulado que se pausa fechando a aba não simula
nada. Por isso `simulado_encerrado()` existe: a página não pode responder essa
pergunta com o relógio do processo Node enquanto `marcar_no_simulado` responde
com o do Postgres. Uma pergunta, um relógio.

**`questoes_do_simulado` não devolve `gabarito`.** Durante a prova ele não sai
do banco. A correção é em `finalizar_simulado`, que é `security definer`, e o
espelho em `relatorio_do_simulado`, que só devolve linha depois de
`finalizado_em`.

**O simulado alimenta o resto.** Ao corrigir, cada resposta entra em
`respostas` e reagenda `revisoes` — a questão errada no simulado cai no caderno
de erros como qualquer outra. Um simulado que não deixa rastro no estudo é só
um número.

**Um simulado aberto por vez.** Dois relógios correndo não é funcionalidade, é
jeito de perder os dois.

**A repetição espaçada vive em `agendar_revisao`.** Estava embutida em
`registrar_resposta`; o simulado precisa da mesma regra para 80 questões de
uma vez, e duas cópias da fórmula divergiriam na primeira mudança.

## Questões parecidas e dificuldade

`questoes_parecidas` soma três sinais em vez de escolher um: **dispositivo em
comum** (de `questao_artigos`, vínculo verificável, peso 3), **embedding**
(cosseno, peso 2) e **semelhança de texto** (`ts_rank` em português, peso 1),
mais um empurrão para a mesma disciplina.

**`questoes.embedding` está vazio** — o projeto não tem chave de serviço de
embeddings, e a Groq não oferece esse endpoint. A função já usa o vetor quando
ele existir, e `ingest/oabase_ingest/embeddings.py` preenche contra qualquer
provedor compatível com `POST /embeddings` (OpenAI, Vercel AI Gateway, Azure).
O modelo **precisa** devolver 1536 dimensões — é o que está em `vector(1536)`,
e o pipeline recusa antes de gravar meia base com tamanhos diferentes.

**Dificuldade e percentil contam a primeira tentativa de cada pessoa.** Depois
de ver o gabarito, acertar de novo é memória, não conhecimento — e a fila de
revisão faz a questão voltar de propósito. Contar tentativas inflaria a taxa
de todo mundo com o tempo.

**Os dois números têm piso.** `dificuldade_da_questao` exige 5 respondentes;
`meu_percentil` exige uma coorte de 10 pessoas com 20 questões ou mais. Abaixo
disso devolvem nulo e a tela cala. "50% acertam" apurado em duas pessoas não é
estatística, é uma moeda — e num universo de dois o número diz o que a outra
pessoa respondeu.

`estatisticas_questao` é mantida por gatilho a cada primeira resposta. Varrer
`respostas` a cada questão exibida funciona hoje e para de funcionar
exatamente quando o produto der certo. A tabela tem RLS sem política e sem
grant: o agregado só sai pelas funções, que aplicam o piso.

## E-mail (Resend)

Três mensagens, e a divisão entre elas é o que decide o que é opcional:

- **compra confirmada** — disparada pelo webhook da Asaas, no mesmo instante
  em que a assinatura nasce;
- **plano acabando** — 7 dias antes, uma vez por assinatura;
- **revisão do dia** — o único opcional, com chave em `perfis.avisos_email`.

Os dois primeiros são transacionais: quem pagou tem direito de saber o que
comprou e até quando vale, e esconder isso atrás de uma preferência esconde o
que a pessoa precisa para decidir.

**O envio nunca derruba o que o chamou.** `enviar()` devolve resultado em vez
de lançar. No webhook isso é obrigatório: a assinatura já está criada, e um
500 faria a Asaas reenviar um evento que não tem mais nada a confirmar. E-mail
que não saiu vira log, não retentativa.

**A marcação em `emails_enviados` acontece depois do envio bem-sucedido.**
Marcar antes evitaria duplicata ao custo de perder a mensagem em silêncio numa
falha do provedor — e um lembrete a mais incomoda menos do que um aviso de fim
de plano que nunca chegou. A `Idempotency-Key` do Resend cobre a janela entre
uma coisa e outra.

**Segredos separados.** O cron usa `cron_email`, o webhook usa
`webhook_asaas`, ambos em `interno.segredos`. Quem conseguir disparar e-mail
não deve, pelo mesmo vazamento, conseguir confirmar pagamento.

**O deploy é na Netlify, não na Vercel.** O agendamento é uma *scheduled
function* (`netlify/functions/emails-diarios.mts`), com o `schedule` exportado
do próprio arquivo — é assim que a Netlify lê, não pelo `netlify.toml`. Ela só
faz `fetch` em `/api/tarefas/emails` com o `CRON_SECRET`: a lógica fica na
rota, dentro do Next, porque as funções da Netlify são empacotadas pelo
esbuild e o alias `@/...` não resolve lá.

**A função síncrona da Netlify tem segundos de vida, não os 300 da Vercel.**
Daí o `TETO_POR_EXECUCAO` na rota: um lote grande morreria no meio, deixando
parte das pessoas marcada como avisada e parte não. O excedente entra na
execução do dia seguinte, e o relatório devolve `pendentes`.

**Lembrete só com 5 questões ou mais na fila**, e só para quem tem assinatura
ativa. Lembrar de revisar quem perdeu o acesso é propaganda disfarçada de
utilidade — para esse caso existe o aviso de fim de plano.

**Quem já renovou não recebe "seu plano acaba".** A consulta descarta quem tem
outra assinatura ativa terminando depois.

**HTML de e-mail é tabela com estilo em atributo.** Não é nostalgia: o Outlook
renderiza com o motor do Word e o Gmail descarta `<style>` no corpo em boa
parte dos casos. Nenhuma imagem externa — cliente bloqueia por padrão, e
mensagem que só faz sentido com imagem ligada não faz sentido. Versão em texto
sempre, escrita à mão.

**Cuidado com nome de parâmetro de saída igual a nome de coluna.** Em
`dados_da_compra`, `fim` era os dois ao mesmo tempo e o Postgres recusava a
consulta por ambiguidade — dentro do `try/catch` do webhook, isso virava
compra confirmada sem e-mail e só log. Qualifique a coluna.


## Páginas legais e procedência

`/termos`, `/privacidade` e `/sobre` existem, e as três são pré-requisito de
cobrar dinheiro — não formalidade. O checkout coleta CPF e telefone, e a LGPD
exige a política; o CDC exige informação clara na oferta, incluindo o
**direito de arrependimento de 7 dias** (art. 49), que aparece no formulário
de assinatura e no FAQ de `/precos`, não só escondido num link.

**Os dados do operador vivem em `src/lib/legal.ts`.** Enquanto razão social,
documento, endereço e comarca estiverem vazios, as duas páginas legais exibem
um aviso no topo dizendo que estão incompletas. Publicar Termos com CNPJ em
branco é pior do que não publicar: parece cumprido e não é. Estão preenchidos
desde 02/09/2026, e `vigencia` foi movida junto — documento legal que muda de
conteúdo sem mudar de data impede a pessoa de saber qual versão aceitou.

**A mesma checagem fecha o caixa.** `dadosPendentes` não serve só ao aviso:
`/api/assinar` devolve 503 em produção enquanto faltar qualquer um dos quatro
campos, e `cobrancaLiberada` (em `pagamento/asaas.ts`) é produção **e**
`legal.ts` completo. O aviso alcança quem lê os Termos; quem está no checkout
não passa por lá. É também `cobrancaLiberada` que decide a frase sobre
cobrança na tela de cadastro — texto de interface que envelhece sozinho vira
mentira no dia do lançamento.

**A política descreve o schema real.** Cada dado listado existe numa coluna, e
cada operador citado é um serviço que o projeto de fato chama. Ao acrescentar
um fornecedor que trate dado pessoal, `subprocessadores` em `legal.ts` precisa
mudar junto — política que omite tratamento que acontece não protege ninguém.

**Nada de promessa que o produto não entrega.** A landing dizia "mais três mil
— todas comentadas" na mesma tela em que dizia "1.120 questões no banco", e
`comentarios` tem zero linha. O número agora sai do acervo e o texto não
afirma comentário que não existe. Vale para `/precos`, para os itens de
`planos.ts` e para a descrição em `site.ts`: promessa em página de preço é o
que a pessoa paga para ter.

## SEO

O básico já existia — canonical por rota, `metadataBase`, BreadcrumbList em
todas as trilhas, sitemap particionado alimentado só por conteúdo indexável.
O que foi acrescentado:

- **FAQPage** na landing e em `/precos`, sobre perguntas que já estavam no
  HTML. **Course** na landing e **Dataset** em `/estatisticas`, com
  `variableMeasured` por disciplina.
- **`/sobre`** — método, fontes e o que ainda é estimativa. Em conteúdo
  jurídico o buscador avalia procedência antes de posição, e site que comenta
  lei sem dizer de onde tira o texto ranqueia como fazenda de conteúdo.
- **Ligação nos dois sentidos entre exame e artigo.** A página do artigo já
  dizia "onde já caiu"; a do exame não apontava para artigo nenhum, e o
  rastreador entrava e saía sem achar as páginas profundas.
  `artigos_do_exame` fecha o ciclo.
- **`trailingSlash: false`** e cabeçalhos de segurança em `next.config.ts`.

**O gargalo de posicionamento não é técnico.** São 4 artigos indexáveis de
5.756, porque o portão de qualidade — correto — só anuncia o que tem
comentário revisado. Nenhuma marcação compensa isso: o caminho é escrever
comentário, e `artigos.incidencia`, agora medida, diz por onde começar.
