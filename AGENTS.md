<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## OABase — regras do projeto

**A fronteira aberto/pago é a regra mais importante do repositório.**

- Rotas públicas (`/`, `/legislacao`, `/sumulas`, `/glossario`,
  `/proximo-exame`, `/exames`, `/estatisticas`, `/precos`, `/blog`) são
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

## Busca

`public.buscar_dispositivos(termo, lei_slug, limite)` — artigo e súmula por
texto livre ou por número. **Security invoker**, sobre tabelas de leitura
aberta: quem decide continua sendo a RLS, e a função é chamável pelo papel
anônimo porque é a mesma leitura que `/legislacao` já faz.

**Acento é opcional, e não é detalhe.** O vetor é gravado por
`public.sem_acento()` — `unaccent` embrulhado como IMMUTABLE, porque
`unaccent` é STABLE e expressão de índice exige IMMUTABLE (a mesma pedra do
`array_to_string`). Sem isso, "prisao" e "honorarios" voltavam vazio, e vazio
diz "não existe" quando o dispositivo está no acervo. Se o dicionário
`unaccent` do servidor mudar, os índices que dependem de `sem_acento`
precisam ser reconstruídos.

**Os dois lados do número são normalizados.** `art. 155`, `5º` e `217-a` viram
`155`, `5` e `217-A` — e o número gravado passa pela mesma limpeza, porque um
único artigo em 9.887 tem ordinal em `numero`: o **art. 5º da CF**, que é o
mais procurado que existe. Normalizar só o que a pessoa digita conserta hoje e
quebra na próxima carga.

**A incidência medida entra no peso, não só no desempate.** `ts_rank` mede
semelhança de texto e não sabe o que cai na prova: sem o empurrão, "furto"
devolvia o art. 250 da Constituição à frente do roubo e do dano. O teto de 10
impede que um dispositivo muito citado suba em busca que não tem a ver com ele.

**Um dígito solto é consulta válida** (o art. 5), uma letra solta não é. O
piso do cliente tem de ser o mesmo da função, senão a tela recusa o que o
banco responderia.

`/busca` é a busca do site, sobre `buscarNoSite()` no contrato — a mesma
função do banco, mais os posts. **É `noindex` e fica fora do sitemap**:
resultado de busca interna é conteúdo gerado por quem digita, em endereços
ilimitados, e indexar isso dilui o domínio — exatamente o que o portão de
qualidade existe para evitar. É `noindex` **sem** `Disallow`: bloquear o
rastreamento impediria o buscador de ler o próprio `noindex`.

**O formulário é GET e não depende de JavaScript.** O resultado ganha
endereço compartilhável e o campo existe no HTML antes de qualquer script —
busca que só funciona depois da hidratação não existe para quem está numa
conexão ruim, que é boa parte de quem estuda pelo celular.

**Post é filtrado em memória**, e isso é decisão de escala, não descuido: são
cinco textos, e montar o `or=(...ilike...)` do PostgREST exigiria escapar
vírgula, parêntese e aspas do que a pessoa digitou. Com cem textos, o lugar de
mudar é `fonte-supabase.ts` — um vetor de busca em `posts`, como o de
`artigos`.

## Medição

**O Search Console já está verificado, por DNS.** Há um registro TXT
`google-site-verification=...` em `oabase.com.br`, e é por isso que não existe
meta nenhuma no HTML de produção. Verificação por DNS não deixa rastro no
repositório — quem procurar prova disso no código vai concluir, errado, que
não há medição. Ela é também a mais forte das duas: vale para o domínio
inteiro, subdomínios inclusive, enquanto a meta vale só para o prefixo de URL.

`GOOGLE_SITE_VERIFICATION` e `BING_SITE_VERIFICATION` emitem a meta no layout
raiz; ausentes, o campo não é emitido — que é o estado atual. Ficam como
caminho alternativo e, no caso do Bing, como o único que existe. O token é da
conta de quem opera o site, não do projeto — daí vir do ambiente.

**Sem `NEXT_PUBLIC_`**: é lido no servidor e não tem por que ir para o pacote
do navegador.

**A variável tem de existir no build.** A metadata do layout raiz é assada em
cada página pré-renderizada, e aqui são quase todas — definir a variável só no
runtime não muda o HTML já gerado. Quem cadastrar o token depois precisa
disparar um deploy novo, não só reiniciar. (Verificado: com a variável no
build, a meta sai tanto em `/` quanto em `/busca`; sem ela, em nenhuma.)

**Não há analytics de página, e é decisão, não esquecimento.** Com o tráfego
de hoje ele mediria quase nada, custaria mensalidade e obrigaria a acrescentar
um fornecedor em `subprocessadores` — política que omite tratamento que
acontece não protege ninguém. O gatilho para reavaliar é o Search Console
mostrar impressão em volume.

**O Search Console é a medição que decide a pauta.** A aquisição é 100%
orgânica, e é ele que responde quais páginas indexaram, quais consultas trazem
gente e o que um comentário novo mudou. Ao propor conteúdo, o dado está lá —
não é preciso supor.


## Origem dos dados

`src/lib/content/queries.ts` escolhe entre duas implementações do contrato
`FonteDeConteudo`: `fonte-supabase.ts` quando há credenciais no ambiente,
`fonte-mock.ts` quando não há. Nenhuma página sabe qual está ativa — foi isso
que permitiu desenhar o site antes de existir banco. Ao adicionar uma consulta,
adicione nas duas implementações e no contrato, nunca direto na página.

## O que pode virar conteúdo aqui

**Só ato oficial.** A Lei 9.610/98, art. 8º, IV, deixa fora da proteção
autoral os textos de lei, decretos, regulamentos, decisões judiciais e demais
atos oficiais — é por isso que legislação e súmulas podem ser reproduzidas na
íntegra, e é o critério que decide o que entra no acervo.

**Raspar material de cursinho, portal jurídico ou blog não é opção**, nem
reescrito. É violação de direito autoral num produto que cobra dinheiro, e
"scraped content" é política de spam nomeada do Google — a punição cairia
justamente sobre a estratégia de busca que sustenta o projeto. O que é
autoral aqui é escrito aqui, e o que não é vem de fonte oficial.

## Súmulas

`ingest/oabase_ingest/sumulas.py` traz as **Súmulas Vinculantes** (62) e as
**súmulas comuns do STF** (717) do portal oficial — `--serie vinculante` ou
`--serie comum`, que são bases diferentes no portal.

**As duas séries têm numeração própria e colidem.** A Súmula Vinculante 1 e a
Súmula 1 são enunciados diferentes, e a chave era `(tribunal, numero)`:
carregar as comuns sobrescreveria as vinculantes uma a uma, em silêncio, com
o total continuando certo. A chave agora inclui `vinculante`, e o slug
distingue (`sumula-vinculante-4`, `sumula-stf-473`). Texto curto, oficial e verificável — existe sem depender de
ninguém escrever comentário, ao contrário do resto do acervo autoral.

**Súmula cancelada não entra.** O índice do STF as marca, e exibir enunciado
revogado como direito vigente é o defeito que quem estuda só descobre na
prova. Ficam de fora da carga, não escondidas por filtro de tela.

**O portão de qualidade vale aqui também.** `/sumulas` entra no sitemap
porque é índice completo e navegável, como a página de cada lei; as páginas de
cada súmula só entram quando `indexavel` — o enunciado oficial existe em
centenas de sites.

Três armadilhas do portal do STF estão documentadas no módulo: o servidor
**não envia o certificado intermediário** (a cadeia completa fica em
`ingest/certs/`, e desligar a verificação destruiria a garantia de origem);
sem `User-Agent` de navegador a resposta é 403; e a página que parece a certa
é uma casca de JavaScript — quem tem o conteúdo no HTML é
`sumariosumulas.asp?base=26`.

## Glossário

`/glossario` é um índice **sem página por verbete**, e isso é a decisão de
conteúdo, não uma etapa que faltou. **A definição é o artigo**: cada verbete
aponta um dispositivo e exibe o caput literal. Como a definição é o texto do
artigo, `/glossario/<termo>` seria uma cópia de `/legislacao/<lei>/<artigo>`
sem uma linha a mais — 142 páginas rasas competindo com as páginas que têm
comentário, duplicata interna contra o próprio acervo.

O que é autoral aqui é a **curadoria** — qual termo merece verbete e onde ele
está definido. É trabalho de índice, não de doutrina, e é por isso que ele
pôde ser feito sem escrever uma linha sobre direito. `ingest/oabase_ingest/
glossario.py` traz a lista à mão, e não por regex: das 73 ocorrências de
"considera-se" no acervo, boa parte não define termo nenhum.

**Verbete cujo artigo não está no acervo não aparece.** É o `!inner` do join
em `getGlossario`, e é o que separa este glossário de mil glossários soltos:
cada definição carrega o endereço da fonte.

**A contagem ao lado do termo é `artigos.incidencia`** — citação expressa, o
mesmo número da página de legislação. Zero não vira rótulo: "0 questões" lê
como ausência de valor quando é ausência de *citação nominal*, e o instituto
cai sem que a prova o nomeie. A página explica isso antes da lista.

## Blog

**O texto dos posts mora em migration, não só no banco.** O primeiro post
ficou meses existindo numa linha da tabela `posts` e em lugar nenhum do
repositório — um `db reset` o apagaria em silêncio, e a página só diria
"nenhum texto publicado ainda". Texto autoral é o que nenhum pipeline refaz.
As migrations usam `on conflict (slug) do nothing`: semeiam, não sobrescrevem
revisão feita depois pelo banco — o mesmo princípio do upsert de `artigos`.

**A pauta sai da medição.** Cada texto publicado é uma contagem sobre o
acervo, com a consulta descrita no corpo para que qualquer pessoa refaça: a
distribuição das alternativas corretas, o crescimento do enunciado, a taxa de
anulação, a citação expressa de dispositivo. Texto jurídico genérico existe
aos milhares e não posiciona nada; o que só existe aqui são as 44 provas.

**Onde o dado é aproximado, o texto diz que é** — e um dos posts é justamente
sobre por que a classificação por disciplina ainda não vale como medição.
Publicar a tabela redonda que todo site publica seria dar precisão falsa a
alguém que organiza as últimas semanas de estudo em cima dela.

## Links internos

Não linke para rota que ainda não existe. Link interno para 404 gasta orçamento
de rastreamento, e num site cuja aquisição é 100% orgânica isso é custo direto.
**Não há mais rota pendente na camada aberta.** `/legislacao`, `/sumulas`,
`/glossario`, `/proximo-exame`, `/exames`, `/estatisticas` e `/blog` estão no
ar; `/sobre`, `/termos` e `/privacidade` estão no rodapé. Ao acrescentar uma
rota, ela entra em três lugares ou em nenhum: `ESTATICAS` em
`content/urls.ts` (sitemap), `site-footer.tsx` e — se for de entrada —
`site-header.tsx`.

O menu do cabeçalho passou de cinco para seis itens com `/proximo-exame`, e o
corte do menu horizontal subiu de `md` para `lg` junto: em 768px os seis
espremiam a marca. Entre 768 e 1024 quem atende é a faixa rolável que já
existia embaixo. Ao acrescentar um sétimo item, é esse limite que estoura
primeiro.

## Ingestão de provas

`ingest/` é um projeto Python separado (stdlib + `pdftotext` + `psql`, sem
dependências). Ver `ingest/README.md`.

**O que é dado real e o que é placeholder** — importa não confundir:

| Real, de fonte oficial | Placeholder |
|---|---|
| `questoes`: 3.540, do 3º ao 46º Exame (44 edições com questões, 16 anuladas) | |
| `exames.data_prova`, cada uma vinda do edital | `questoes.disciplina_id` sem confirmação (3.044 classificadas, 1.698 com `disciplina_confirmada`) |
| gabarito, tipo 1 — definitivo em 15 edições, preliminar nas demais (`exames.gabarito_definitivo`) | |
| `leis` e `artigos`: 42 leis, 9.887 artigos do Planalto | |
| `artigos.incidencia`: 164 vínculos em 113 artigos, só de citação explícita | |
| `comentarios`: 92 comentários de questão publicados, zero rascunho (`fila_de_comentarios`/`salvar_comentario`) | |
| `termos_glossario`: 142 verbetes, cada um ancorado num artigo do acervo | |

**Número de acervo em literal tem data de validade.** A entrada do 35º
invalidou, no mesmo dia, o texto de cinco posts, a descrição do blog e três
comentários de código — num site cujo argumento é que aqui os números são
contados. Onde a página puder contar (`getAcervo()`), ela conta; onde não
puder, o número está aqui, e esta tabela é o que se atualiza.

**O 35º Exame entrou por remendo.** As páginas 17 e 21 do caderno oficial têm
fontes CID sem tabela de caracteres: o texto extraído é lixo, e a página
renderiza perfeitamente. As nove questões dessas páginas foram transcritas da
renderização do mesmo PDF oficial. Ver `ingest/README.md` — e as três
invariantes que impedem o mecanismo de virar atalho, sendo a principal que o
remendo **preenche e nunca sobrescreve** o que o parser conseguiu ler.

**O rodapé estava dentro de 645 questões.** O filtro de ruído do parser
aceitava prefixo decimal antes de "EXAME DE ORDEM", e o rodapé traz a edição
em **numeral romano** — então toda questão que fechava página terminava com
"IX EXAME DE ORDEM UNI" grudado na alternativa D. Passou anos despercebido
porque não derruba parser nem falha validação: só suja o texto que a pessoa
paga para ler, no fim da última alternativa, onde ninguém revisa. Ao mexer em
`RUIDO`, note que o numeral é **obrigatório** — sem ele o filtro come linha
legítima, e há questão de Ética cuja alternativa quebra a linha exatamente
antes de "Exame de Ordem".

O conserto definitivo não mora no parser, e sim em `_sem_rodape`, na
extração: o recorte por coluna **corta o rodapé no meio da palavra**, e o
mesmo texto sai como "UNIFICADO", "NIFICADO", "IFICADO", "PROVA APLICADA" e
"PROVA APLICAD" em provas diferentes. Enumerar as formas de um texto truncado
arbitrariamente não fecha. A poda é por posição — do primeiro marcador forte
até a borda da coluna — e as fronteiras de palavra não são zelo: sem elas
`IFICADO` casa dentro de "qualificado" e a alternativa D da questão 63 do 25º
some inteira.

**O eco de sílaba dos cadernos do 15º e do 16º é do PDF, não da extração** —
aparece no `pdftotext` cru. `_sem_eco` conserta só a forma determinística
("afastar-se se", "queixa-crime crime"); o eco solto ("Alessandro essandro")
exigiria decidir se o fragmento é palavra do português, e a mesma regra sem
dicionário come "compatível com" e "oriundos dos" em 38 das 44 provas. O que
sobra é candidato a remendo, não a regex.

**Nem toda repetição é nossa.** O "se os os embargos" da questão 51 do 40º
está assim no caderno oficial da FGV, em linha única. Reproduzir ato oficial
inclui reproduzir o erro dele.

**Recarregar uma prova não pode apagar classificação melhor.** O upsert de
`questoes` escrevia `disciplina_id = excluded.disciplina_id` sem condição, o
que fazia da reingestão um ato destrutivo: as 440 questões classificadas pelo
modelo voltariam ao palpite léxico e `classificacao_origem` continuaria
dizendo 'modelo' — procedência mentindo, que é pior do que classificação
faltando. Hoje o upsert preserva `modelo`, `humano` e `disciplina_confirmada`.


Exames **não** são semeados por `seed.sql`: entram pelo pipeline, com data
vinda do edital. Datas inventadas em seed ficam indistinguíveis de datas reais
assim que convivem na mesma tabela.

**A distribuição por disciplina já sai de contagem real.** `disciplinas.media_por_prova`
foi **removida do schema** — era a velha estimativa por prova, e um `db pull`
registrou a sua ausência. Quem a substitui é a função `distribuicao_por_disciplina`,
que conta `questoes` por `disciplina`, e o `fonte-supabase.ts` monta
`mediaPorProva = questoes / edicoes` a partir dela, para as telas que ainda
usam o nome antigo. A `incidencia_estimada`, que ordena a fila editorial, pode
mudar de significado quando `disciplina_confirmada = true` ganhar volume.

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
2. **Tudo entra com `indexavel = false`.** São 9.887 páginas de texto legal que
   existem em centenas de outros sites. Elas servem para consulta e para
   navegação interna; ao índice só vai o que tiver comentário. Já as páginas
   de lei (`/legislacao/<slug>`) entram no sitemap: são índices completos e
   navegáveis, não cópia de texto.
3. **`ordem` vem do número, não da posição de chegada.** É o que permite
   percorrer a lei em sequência e achar o vizinho anterior/seguinte sem
   recarregar a lei inteira, e sobrevive a uma carga parcial.

**O travessão da grafia antiga não é hífen de sufixo, e confundir os dois
criou 281 artigos.** "Art. 41 - O condenado a quem sobrevém doença mental"
era lido como o artigo **41-O**, e o "O" que abre o caput ia embora junto com
o travessão: nascia uma duplicata de texto decapitado ao lado do art. 41
verdadeiro, concentrada na CLT e no Código Penal, que são as leis escritas
nessa grafia. Pior, o artigo real às vezes **nunca chegava a existir** — o CP
não tinha art. 3º. O defeito não derruba nada e não aparece em contagem: o
total só cresce, e "Art. 41-O" tem cara de artigo de verdade. A distinção é
que "Art. 149-A" e "Art. 7º-B" nunca põem espaço em volta do hífen, e a
grafia antiga sempre põe.

**Cabeçalho de divisão e rubrica marginal não pertencem a artigo nenhum.**
Por não casarem com marcador de artigo, parágrafo, inciso ou alínea, caíam na
acumulação e iam parar na cauda do último segmento do artigo anterior — 596
artigos terminando em "CAPÍTULO VI DA CONTESTAÇÃO", e o nome do crime
seguinte grudado no fim do crime atual, no Código Penal. A rubrica **sai da
coleta**: guardá-la no artigo certo pede uma coluna `rubrica`, e guardá-la no
artigo errado é o defeito que se estava consertando.

**O ordinal e o ponto são dois caracteres.** `§\s*\d+\s*[ºo°.]?` aceita um
só, e por isso "§ 2º." não era reconhecido: o parágrafo inteiro ficava colado
no fim do anterior. Era o caso do § 2º do art. 122 do ECA — a regra que veda
a internação havendo outra medida adequada, escondida na cauda do § 1º.

**Onde o Planalto entrega tudo numa linha só, nenhum marcador de início de
linha alcança.** Daí `PARAGRAFO_NO_MEIO` e `ESTRUTURA_NO_MEIO` repartirem a
linha antes de o laço olhar para ela. A quebra exige fim de frase antes
(ponto ou o fecha-parêntese das notas de redação) — é o que separa a estrutura
da referência a ela: "na forma dos §§ 2o e 5o deste artigo" não vem depois de
ponto.

Ao mexer em qualquer um desses marcadores, a validação que pega o estrago é
comparar a extração inteira contra a anterior: **nenhum artigo pode sumir, e
nenhum caput pode mudar de outro jeito que não encurtar.**

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

**Comentário de questão é trabalho autoral — e hoje ele existe.** A tabela
`comentarios` tem 92 linhas publicadas e zero rascunho. O fluxo vive no banco:
`sou_editor()` libera a fila em `fila_de_comentarios`, `salvar_comentario`
escreve o rascunho sem publicar e `comentarios_pendentes` alimenta `/app/redacao`.
Gerar explicação jurídica por IA é o pior defeito possível aqui, porque quem
estuda a regra alucinada só descobre no dia da prova.

**A classificação por disciplina é aproximada.** 3.044 das 3.540 questões têm
`disciplina_id`, e 1.698 têm `disciplina_confirmada = true`. O filtro por

disciplina funciona e a tela avisa que é aproximado; filtro por exame é
exato. Enquanto `disciplina_confirmada` não cobrir a base inteira, gráfico de
evolução por matéria está limitado às 1.698 confirmadas — o resto seria dado
inventado com cara de medição.

## Classificação automática e procedência

Confirmar 3.540 questões e vincular 218 à mão é trabalho de meses. A saída

foi automatizar **registrando de onde veio cada dado**, e nunca marcar palpite
como revisão humana:

- `questoes.classificacao_origem` — `lexico`, `sequencia`, `modelo`, `humano`.
  `disciplina_confirmada` continua significando "alguém leu" e **não é escrita
  por script**.
- `questao_artigos.origem` — `citacao`, `modelo`, `humano`.
- `artigos.incidencia` conta só `citacao` e `humano`: é o número que a página
  aberta publica e que se confere relendo a questão. **Não muda de
  significado.**
- `artigos.incidencia_estimada` conta tudo. Ordena a fila editorial, onde
  errar custa uma leitura a mais — não um dado falso publicado.

Um contador só seria mais simples e destruiria a distinção justamente na
página aberta de legislação.

`ingest/enriquecer.sh` roda os dois classificadores em sequência (nunca
juntos: dividir o teto de tokens entre dois processos só faz os dois baterem
em 429). Eles **gravam a cada lote** e as consultas só trazem o que falta —
repetir o comando continua de onde parou. Na conta gratuita da Groq são 8.000
tokens por minuto, e a base leva horas.

**Três armadilhas da API, em `groq.py`:** o `User-Agent` do urllib leva 403 na
borda e o erro parece chave inválida; o `gpt-oss` gasta o orçamento de saída
raciocinando e devolve JSON cortado sem erro nenhum; e 429 diz no cabeçalho
quanto esperar — chutar oito segundos gasta as tentativas e deixa um exame
inteiro sem classificação.

## Revisão editorial

Os dois gargalos do projeto são trabalho humano: 3.540 questões classificadas
por heurística e 1.698 confirmadas; 9.887 artigos e 107 comentados. O
segundo gargalo anda — eram quatro —, o primeiro saiu do zero e anda.
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

## Papéis internos

São três capacidades, e a separação é deliberada — cada uma mora numa tabela
própria em `interno`, sem política e sem grant, e se concede por SQL:

| Tabela | Dá acesso a | Função |
|---|---|---|
| `interno.editores` | `/app/revisao`, `/app/redacao`, `/app/vinculos` | `sou_editor()` |
| `interno.admins` | `/app/admin`, fila de suporte, moderação do fórum | `sou_admin()` |
| `interno.segredos` | webhook e cron, por segredo em variável de ambiente | — |

**Editor não é admin.** Acesso de escrita ao conteúdo não pode dar, de
brinde, a lista de clientes: e-mail, plano e quanto cada um pagou. É a mesma
razão de o segredo do cron ser separado do segredo do webhook.

**Nenhum sinalizador mora em `perfis`.** A política de lá é de dono com
`with check (auth.uid() = id)` — uma coluna `admin` ali seria uma coluna que a
própria pessoa marca como verdadeira, do navegador, com a chave anônima.

**As abas de operação aparecem no trilho, sob o rótulo "Operação".** O layout
de `/app` chama `sou_admin()` e `sou_editor()` e passa o resultado à
navegação; para quem não é, as abas não existem. A checagem é de porta, como
a do proxy — quem decide é a função dentro do banco. Elas ficam depois das
abas de estudo e atrás de um fio: emendadas na mesma lista, "Redação" lê como
se fosse mais uma tela de estudo.

## Suporte

`/app/suporte` para quem abre, `/app/admin/suporte` para a fila — a **mesma
tela**, com `equipe` mudando rótulo e permissão. Duas telas quase iguais
divergiriam na primeira mudança, e a que divergiria em silêncio é a do
cliente, que ninguém da equipe abre.

**`da_equipe` não é escolha de quem escreve.** A política de RLS exige
`da_equipe = sou_admin()`; sem isso, um cliente inseriria uma mensagem
marcada como resposta oficial na própria tela.

**O e-mail nunca derruba o ticket.** Ele já está gravado quando o envio
acontece — falha vira log. Recusar o chamado porque o e-mail falhou perderia
justamente a mensagem de quem está com problema. Destino em `EMAIL_SUPORTE`,
com `dev.yagofontanez@gmail.com` como padrão.

## Fórum

`/app/forum`, aberto a **qualquer conta** — com plano ou sem — e fechado a
quem não está logado. A escolha é de sobrevivência do domínio: conteúdo
escrito por terceiros, indexável, num site cuja aquisição é 100% orgânica é a
forma mais rápida de ser avaliado como fazenda de conteúdo, e moderar fórum
público é trabalho que ninguém aqui tem.

**`autor_nome` é cópia.** Juntar com `perfis` na leitura exigiria abrir a
tabela de dados pessoais para todo mundo.

**Remoção é marca, não `delete`.** Apagar a linha some com a resposta que
citava ela e reabre a discussão do zero.

**O filtro de linguagem compara palavra inteira sobre texto normalizado** —
minúsculas, sem acento, com os substitutos de teclado (`0`→o, `3`→e, `@`→a) e
sem letra repetida. Procurar trecho dentro de palavra barraria "assumiu" por
conter "cu", e numa base jurídica isso aconteceria no primeiro dia. A segunda
passada compara o texto sem separador nenhum, para pegar "c a r a l h o", e
só vale para termos de quatro letras ou mais — abaixo disso a colisão entre
palavras vizinhas é certa. **Ela roda no banco, dentro de `criar_topico` e
`responder_topico`**, porque validação no navegador é contornada por quem
abre o console, que é exatamente quem o filtro existe para conter.

## Quadro de anotações

`/app/anotacoes` é uma tela livre (React Flow, `@xyflow/react`) com cartões de
anotação e de questões já respondidas, ligáveis entre si.

**O seletor de lei e súmula busca por texto, não por número.** A versão
anterior pedia o número dentro de uma norma escolhida, partindo de que "quem
está anotando já sabe qual artigo quer" — e quem está anotando é quem estuda
para a 1ª fase, a mesma pessoa a quem este site diz, com a contagem na mão,
que só 4% das questões citam artigo expressamente. Ela sabe "furto", sabe
"algemas"; não sabe 155 nem Vinculante 11. O casamento exato falhava também
para quem sabia o número, porque `numero` é texto: `art. 155`, `5º` e `217-a`
não achavam nada, e a pessoa concluía que o acervo não tinha o dispositivo.
Ver **Busca**. A norma virou filtro para estreitar, nunca pré-requisito.

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

### Recorrência do Mensal

**Só o Mensal renova.** Experimentar termina sozinho por promessa, Até a
prova termina no exame por natureza, e quem comprou antes continua avulso —
não se passa a cobrar automaticamente quem aceitou "sem renovação".
`planos.ts` marca com `recorrente`, e as telas e os Termos leem de lá.

**Uma assinatura `UNDEFINED` cobre cartão e Pix.** Conferido no sandbox, não
na documentação, que não descreve o caso: paga a primeira fatura no cartão, a
Asaas guarda o token e troca a assinatura para `CREDIT_CARD` sozinha — os
meses seguintes debitam sem ninguém agir. Paga por Pix, a assinatura continua
`UNDEFINED` e cada mês gera uma fatura, que **o OABase avisa** (bloco
`fatura` em `/api/tarefas/emails`): o cliente é criado com
`notificationDisabled`, então a Asaas não avisa ninguém.

**A renovação entra no livro pelo mesmo caminho da compra.** A primeira
cobrança nasce no checkout; as dos meses seguintes a Asaas cria sozinha, e a
linha em `cobrancas` nasce quando o pagamento chega, por
`registrar_cobranca_da_assinatura` — que só aceita assinatura presente em
`recorrencias`, ou seja, criada pelo nosso checkout. Por isso o checkout
**cancela a assinatura na Asaas se não conseguir registrá-la**: assinatura sem
registro cobraria todo mês e nenhuma renovação viraria acesso.

**Cada cobrança compra o intervalo até a próxima, não 30 dias.** A Asaas
cobra no mesmo dia de cada mês; somando 30, o acesso acabaria antes da
cobrança em todo mês de 31 dias, e cada vez mais cedo. A primeira ganha 3
dias de folga (o débito acontece ao longo do dia; o Pix, quando a pessoa
lembra), e as renovações somam o intervalo exato — a folga se mantém sem
crescer. Ver `diasDaCobrancaRecorrente`.

**A reconciliação pergunta à Asaas pelas renovações.** Renovação cujo webhook
se perdeu não está em `cobrancas` — a varredura das `PENDING` nunca a veria.
A reconciliação horária lista as pagas de cada assinatura ativa e passa por
`confirmarCobranca`, que é idempotente. Ela também encerra a assinatura com
fatura esquecida: 5 dias quando nunca houve pagamento (desistiu no
checkout), 30 quando já houve (parou de pagar) — sem isso a Asaas geraria
fatura para sempre, com o nosso aviso junto.

**Cancelar é um botão em Configurações, e a Asaas vem primeiro.** Marcar o
banco antes e falhar na Asaas deixaria a tela dizendo "cancelada" com o
cartão sendo cobrado. O período pago continua; só as cobranças futuras param.
O webhook trata `SUBSCRIPTION_DELETED`/`SUBSCRIPTION_INACTIVATED` (cancelada
no painel da Asaas) **reconsultando a assinatura**: um "cancelada" forjado
liberaria uma segunda assinatura, que é cobrança em dobro. Esses dois eventos
precisam estar marcados na configuração do webhook na Asaas.

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

**Aviso de cadastro novo sai do banco, não do navegador.** O `signUp` roda no
cliente, e uma rota que o navegador chamasse para "avisar que se cadastrou"
seria um jeito de qualquer pessoa mandar e-mail à equipe. O gatilho
`avisar_novo_cadastro` em `auth.users` chama `/api/tarefas/novo-cadastro` por
`pg_net`, autenticado pelo segredo `cron_email`, e o aviso vai para
`EMAIL_SUPORTE`. `pg_net` só enfileira e o gatilho engole erro: **o aviso
nunca derruba o cadastro**.

**A URL de destino é configuração** (`url_aviso_cadastro` em
`interno.segredos`) e não existe fora da produção. Todo banco nasce com um
`cron_email` aleatório, o local inclusive — com a URL no código, cada cadastro
de teste bateria na produção. Sem a linha, o gatilho não faz nada; apagá-la é
o jeito de desligar o aviso.


## Exclusão de conta

Em Configurações, com a senha de novo — excluir não tem volta, e sessão
esquecida num computador compartilhado não pode bastar. A rota é
`/api/conta/excluir`; o trabalho é de `excluir_minha_conta()`.

**Quase tudo cai por CASCADE, e duas coisas não podem cair.** A cobrança: a
Política promete guardar dado de cobrança por 5 anos (fiscal e art. 27 do
CDC), e `cobrancas` tem CASCADE para `auth.users` — a função copia antes para
`interno.cobrancas_retidas`, sem permissão para papel nenhum, com
`excluir_apos`; a tarefa diária de e-mail expurga o que venceu. E o fórum: o
CASCADE levaria os tópicos da pessoa e as respostas dos outros dentro deles;
o autor vira "Conta excluída" (FK com `SET NULL`) e a conversa fica.

**Mensal ativo é cancelado na Asaas antes.** A função recusa com recorrência
ativa, e a rota cancela primeiro, na mesma ordem de `/api/assinatura/cancelar`.
Conta apagada com o cartão ainda sendo cobrado é o pior resultado possível.

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
- **`/proximo-exame`** — contagem regressiva, calendário e o formato da prova,
  com **FAQPage** e **Event**. É a única página aberta que escala sem custar
  comentário autoral: tudo nela é ato oficial (as datas do cronograma do
  Conselho Federal) ou medição do próprio acervo. O `Event` só é emitido
  quando existe aplicação futura publicada — marcar como evento uma data
  vencida é o mesmo defeito da contagem travada em zero.

**A página que não existe é de propósito.** `/proximo-exame` não afirma prazo
de inscrição, valor de taxa nem número de edital: isso muda a cada edição, não
está no acervo, e errar faz alguém perder a prova. Ela diz o que mede e manda
ao edital para o resto. Ao acrescentar campo ali, a pergunta é de onde ele vem.

**O gargalo de posicionamento não é técnico.** São 107 artigos indexáveis de
9.887, porque o portão de qualidade — correto — só anuncia o que tem
comentário revisado. Nenhuma marcação compensa isso: o caminho é escrever
comentário, e `artigos.incidencia`, agora medida, diz por onde começar. O
glossário exibe essa mesma incidência ao lado de cada verbete, o que dá à
lista de 142 termos uma ordem de prioridade que a ordem alfabética não tem.

## Desempenho do painel

**O servidor está longe do banco, e isso manda em tudo.** As funções da
Netlify rodam em `us-east-2` (Ohio) e o Supabase em `sa-east-1` (São Paulo):
cada consulta que o servidor espera é ~130 ms de viagem. O que decide a
velocidade de uma tela não é quantas consultas ela faz, e sim quantas
**rodadas em série** — cinco em paralelo custam uma viagem, cinco em fila
custam cinco. Mudar a região das funções para `gru` resolve na raiz, mas é
recurso do plano Pro da Netlify; a conta hoje é Free.

**Uma rodada por tela.** Ao escrever uma página de `/app`, tudo que não
depende de resultado anterior vai no mesmo `Promise.all` — acervo aberto e
dado da pessoa juntos, e a checagem de plano junto com o resto (sem plano, a
RLS devolve vazio e o resultado é descartado). Configurações chegou a ter seis
rodadas em fila; `anotacoes`, cinco.

**Quem é a pessoa sai do JWT, não da rede.** `usuarioAtual()` usa
`getClaims()` — confere a assinatura ES256 localmente, com a chave pública em
cache no processo — e `cache()` do React divide a leitura entre layout e
página. O proxy faz o mesmo. `getUser()` fica onde vale a viagem: pagamento e
exclusão de conta, que também querem saber se a sessão foi revogada. Como o
nome vem do token, quem troca o nome renova a sessão (`FormularioNome`).

**Todo clique tem resposta visível.** O esqueleto de `loading.tsx` aparece
na hora nas rotas pré-carregadas (os links do trilho). `router.push` depois
de um botão vai para rota que ninguém pré-carregou — chame `navegar()` antes
dele, e a barra do topo (`BarraDeNavegacao`) cobre a espera. O botão que
dispara a ação mostra o próprio estado ("Publicando…") enquanto ela roda.

**Para medir, não supor.** A medição que orientou isto: build de produção
local contra o Supabase local, com um proxy que atrasa cada requisição em
130 ms e registra início e fim — dá para contar as rodadas de cada tela e o
tempo do clique até a tela pronta no navegador.

## PWA

Instalável em PC e celular (manifest em `src/app/manifest.ts`, service worker
em `public/sw.js`). Duas regras sustentam o worker, e a primeira não é opcional:

1. **`/app` é network-only.** A área paga é decidida pela RLS a cada sessão;
   cachear uma resposta autenticada deixaria ler questão do offline depois
   que a assinatura acabou. Para o conteúdo pago o SW é invisível.
2. **Nenhum domínio externo é tocado.** As consultas ao Supabase vão por
   `fetch` no cliente; interceptá-las daria ao SW poder de decidir sobre
   resposta de banco.

O que sobra é o que compensa: estáticos `/_next/static` (cache-first, o nome
tem hash e não muda) e páginas abertas (network-first, com o cache como rede
de segurança offline). O `start_url` é `/` — a página aberta, nunca `/app`.

O registro é **só em produção** (em dev ele esconderia a edição que acabou de
salvar). `/sw.js` é servido com `Cache-Control: no-cache` para a correção de
um bug não esperar a expiração de um CDN; a versão é manual (`oabase-v1`) e
muda quando o comportamento do worker muda.

**Pegadinha do Next 16 registrada:** `appleWebApp` mora em `metadata`, não em
`viewport` — a interface `Viewport` desta versão não tem o campo e o TypeScript
recusa. Ícones PWA foram gerados de `src/app/icon.svg` (via `qlmanage`) em
`public/icons/`; o `apple-icon.png` (iOS) segue automático do `src/app/`.
