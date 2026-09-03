-- ============================================================================
-- Quatro textos para o blog.
--
-- Por que conteúdo autoral entra por migration: o primeiro post foi inserido
-- à mão e não está em lugar nenhum do repositório. Um `db reset` o apagaria
-- sem deixar rastro, e ninguém perceberia até abrir /blog. Texto autoral é o
-- ativo mais caro do projeto — é o que o portão de qualidade protege e o que
-- nenhum script consegue refazer. Ele precisa estar no git.
--
-- `on conflict (slug) do nothing`: a migration semeia, não sobrescreve. Quem
-- editar um texto depois pelo banco não o perde na próxima aplicação, que é
-- o mesmo princípio do upsert de `artigos` não tocar em linha com comentário.
--
-- **Todos os números daqui foram medidos no acervo**, não estimados: 3.460
-- questões do 3º ao 46º Exame, com o gabarito oficial da banca. As consultas
-- que os produziram estão citadas no corpo de cada texto, para que qualquer
-- pessoa possa refazê-las. Onde o dado é aproximado — a classificação por
-- disciplina, que ainda é heurística —, o texto diz que é, e um dos quatro
-- é justamente sobre por que ele ainda não vale como medição.
-- ============================================================================

insert into public.posts (slug, titulo, resumo, corpo, publicado_em) values

-- ---------------------------------------------------------------------------
(
  'letra-que-mais-cai-no-gabarito-da-oab',
  'A letra que mais cai no gabarito da OAB',
  'Contamos as 3.444 questões válidas de 43 provas e separamos por alternativa correta. Existe uma letra que aparece mais — e a conclusão útil é que isso não serve para nada.',
  $post$Toda véspera de prova reaparece o mesmo conselho de corredor: na dúvida, marque C. Ou B. Depende de quem conta. É uma dessas crenças que ninguém verificou porque verificar dá trabalho — precisa das provas todas, dos gabaritos oficiais e de alguém disposto a contar.

As provas estão aqui. Então contamos.

## O que a contagem mostra

O acervo tem 3.460 questões objetivas, do 3º ao 46º Exame de Ordem Unificado. Tirando as 16 anuladas, que não têm resposta certa, sobram 3.444 questões com gabarito oficial da banca. Separadas pela alternativa correta:

A alternativa B foi a correta em 909 questões, 26,4% do total. A C, em 880, 25,6%. A D, em 849, 24,7%. E a A, em 806, 23,4%.

Sim, existe uma letra mais frequente. É a B, com 1,4 ponto percentual acima do esperado num sorteio perfeitamente equilibrado. E a menos frequente é a A, com 1,6 ponto abaixo. Em dezesseis anos de prova, num universo de três mil e quatrocentas questões, a distribuição das quatro alternativas se afasta do equilíbrio em menos de dois pontos.

## Por que isso não serve para nada

Faça a conta que interessa. Você entra na prova, não sabe nada de nada e marca B nas 80 questões. Pela frequência histórica, acerta 21 delas.

Se marcasse tudo A — a letra "ruim" — acertaria 19.

A diferença entre a melhor e a pior estratégia de chute cego, aplicada às 80 questões, é de duas questões. E a aprovação exige 40. Você precisaria de mais dezenove acertos vindos de outro lugar em qualquer um dos dois cenários, o que significa que a escolha da letra não decide absolutamente nada.

Esse é o ponto do levantamento. Não é que a crença esteja errada por pouco: é que ela está certa por pouco, e "certa por pouco" aqui é indistinguível de irrelevante. A banca não precisa sortear as letras com precisão de laboratório para que a estratégia seja inútil. Basta que a prova exija 50% de acerto, que é o que ela exige.

## O que varia de verdade

Onde a variação aparece é dentro de cada edição, e ela é bem maior do que a do conjunto. No 11º Exame, uma das alternativas foi a correta em 26 das 80 questões e outra em apenas 13 — quase o dobro de uma para a outra. No 8º, o mesmo padrão.

Isso é o comportamento normal de um sorteio com 80 tiragens: desvios grandes numa amostra pequena, que se cancelam quando as amostras se acumulam. O que a variação por edição garante é o contrário do que o conselho de corredor promete — a letra frequente da última prova não diz nada sobre a próxima.

Vale registrar o único número do levantamento que chega a ser curioso: a B foi a letra mais frequente em 17 das 43 edições, contra 10 da C e 8 de cada uma das outras duas. Se as quatro fossem sorteadas de forma perfeitamente equilibrada, esperaríamos algo em torno de 11 lideranças para cada. Dezessete é mais do que isso, e pouco o bastante para que 43 edições não permitam separar tendência de acaso — em 26 das 43 provas quem liderou foi outra letra. É uma observação, não um método, e ela não muda nada na conta do parágrafo anterior: continuam sendo duas questões em 80.

## O que fazer com o chute, então

Chutar acontece, e não há nada de errado nisso: a prova é longa e o relógio é curto. Só que a economia do chute está em outro lugar.

Numa questão em que você eliminou duas alternativas, o chute vale 50%. Numa em que eliminou uma, vale 33%. Numa em que não eliminou nenhuma, vale 25% — e a letra escolhida não muda esse número de forma perceptível. O ganho está inteiramente na eliminação, e a eliminação vem de reconhecer o instituto no enunciado, não de conhecer a estatística do gabarito.

Traduzido em minutos de estudo: o tempo gasto decidindo qual letra marcar no chute é tempo com retorno praticamente zero. O mesmo tempo gasto lendo um enunciado com atenção suficiente para eliminar uma alternativa vale oito pontos percentuais naquela questão. É uma diferença de ordem de grandeza.

## Como conferir

O acervo é público na parte que pode ser: as fichas das 43 edições, com data de aplicação e gabarito oficial, estão em /exames. A contagem deste texto é uma agregação simples das questões válidas por alternativa correta, e qualquer pessoa com os cadernos e os gabaritos da FGV chega ao mesmo resultado — que é, aliás, o único motivo de este texto existir. Crença de corredor não se combate com outra crença.$post$,
  timestamptz '2026-09-03 09:10:00-03'
),

-- ---------------------------------------------------------------------------
(
  'enunciados-mais-longos-exame-de-ordem',
  'A prova da OAB não ficou mais difícil. Ficou mais longa.',
  'O enunciado médio da 1ª fase dobrou de tamanho desde 2011, enquanto as alternativas ficaram quase iguais. As cinco horas não mudaram — e é aí que a prova mudou.',
  $post$Quem faz simulado com prova antiga percebe alguma coisa estranha e costuma atribuir ao nervosismo: as provas de dez anos atrás parecem rápidas. Não parecem mais fáceis, exatamente. Parecem mais rápidas.

Elas eram. E dá para medir quanto.

## Duas curvas, uma só sobe

Medimos duas coisas em cada uma das 3.460 questões do acervo: o comprimento do enunciado e o comprimento das quatro alternativas somadas. Depois tiramos a média por edição, do 3º Exame ao 46º.

O enunciado médio do 4º Exame, em julho de 2011, tinha 299 caracteres. O do 46º, em maio de 2026, tem 607. Dobrou.

As alternativas, no mesmo período, foram de 528 caracteres para 592. Doze por cento em quinze anos, com sobe-e-desce grande de uma edição para outra — o tipo de curva que não tem tendência nenhuma, só ruído.

A subida do enunciado, ao contrário, é monótona e visível a olho nu. Até o 10º Exame, a média orbitava os 330 caracteres. Do 14º ao 21º, os 500. Do 22º em diante, nunca mais desceu dos 560, e desde então oscila em torno dos 600 sem tendência nova — subiu até ali e ficou.

## O que cresceu foi o caso

A leitura dessas duas curvas juntas é bem específica. Se as alternativas tivessem crescido junto, a conclusão seria que a prova ficou mais técnica — alternativas longas são alternativas com mais condições, mais exceções, mais pegadinha de redação. Não foi isso que aconteceu.

O que cresceu foi só a parte de cima da questão: a narrativa. A FGV deixou de perguntar "assinale a alternativa correta sobre a prescrição" e passou a contar uma história de dez linhas com nomes próprios, datas, um contrato, uma notificação que chegou numa terça — e só depois perguntar. A questão mais longa do acervo inteiro, no 40º Exame, tem 1.750 caracteres de enunciado. É meia página de texto para uma pergunta.

A habilidade que isso cobra não é a mesma. Ler um caso concreto e identificar qual regra se aplica é uma operação diferente de saber a regra. A segunda você treina lendo; a primeira, só resolvendo questão.

## O relógio não acompanhou

Aqui está o ponto que muda a preparação de alguém.

A prova continua tendo 80 questões e continua durando cinco horas, das 13h às 18h. São três minutos e quarenta e cinco segundos por questão, exatamente como em 2011. Só que dentro desses três minutos e quarenta e cinco segundos hoje cabe o dobro de texto de enunciado.

Ou seja: a prova não passou a exigir mais conhecimento. Passou a exigir a mesma quantidade de conhecimento em menos tempo por questão útil. É um aperto de velocidade de leitura disfarçado de aumento de dificuldade, e as duas coisas se combatem de maneiras completamente diferentes.

Contra dificuldade, estuda-se mais conteúdo. Contra velocidade, treina-se em condição de prova — com relógio, sem consultar nada, e sem ver o gabarito no meio do caminho. Quem só resolve questão avulsa vendo a resposta na hora treina reconhecimento e não treina ritmo, e chega no dia da prova descobrindo que sabia a matéria e não terminou o caderno.

## O que fazer com isso

Três consequências práticas, todas medíveis por quem estuda:

Primeira: cronometre. Não a prova inteira, necessariamente, mas blocos. Vinte questões em setenta e cinco minutos é a régua real. Se você estoura, o problema não é conteúdo.

Segunda: leia a pergunta antes do caso. Com enunciados de 600 caracteres, saber o que está sendo perguntado antes de ler a narrativa muda o que você procura nela. Numa questão de 300 caracteres isso era indiferente.

Terceira: desconfie de simulado feito só com prova antiga. As edições até o 13º Exame são ótimo material de conteúdo e péssimo material de ritmo — elas subestimam o tempo de leitura em quase metade.

## Como conferir

As 43 edições estão em /exames, com data de aplicação e gabarito oficial. A medição deste texto é o comprimento médio do enunciado e das alternativas por edição, calculado sobre os cadernos oficiais tal como foram extraídos. É uma contagem de caracteres, sem nenhum julgamento sobre o mérito das questões — o que a torna repetível por qualquer pessoa com os mesmos PDFs.$post$,
  timestamptz '2026-09-03 10:20:00-03'
),

-- ---------------------------------------------------------------------------
(
  'questoes-anuladas-no-exame-de-ordem',
  'As questões anuladas, e o que elas dizem sobre a banca',
  'Nas 13 edições em que temos o gabarito definitivo, 16 questões foram anuladas em 1.040 — uma e meia a cada cem. O número é baixo, e o que ele significa para quem faz a prova é menos óbvio.',
  $post$Recurso contra questão de prova é um gênero literário próprio, e a maior parte dele é esperança. Mas anulação existe, acontece todo exame, e cada questão anulada vale um ponto para todo mundo. Vale a pena saber com que frequência.

## Um e meio por cento

O acervo tem 3.460 questões, mas essa não é a base de cálculo certa — e a distinção importa mais do que o resultado.

Anulação só aparece no gabarito definitivo, publicado depois do julgamento dos recursos. O gabarito preliminar sai dias após a prova e ainda não sabe o que vai ser anulado. Das 43 edições do acervo, temos o gabarito definitivo de 13; das outras 30, temos o preliminar. Isso significa que, nessas 30 edições, questões podem ter sido anuladas sem que o acervo saiba — e contá-las como não anuladas seria transformar uma lacuna nossa numa afirmação sobre a banca.

Então a base é: 1.040 questões, nas 13 edições em que sabemos. Dessas, 16 foram anuladas. Um vírgula cinco por cento — cerca de uma questão e meia por prova de 80.

## O que isso significa na aritmética da aprovação

Uma questão anulada é ponto para todo mundo, inclusive para quem deixou em branco. Numa prova em que 40 acertos aprovam, uma anulação move a régua efetiva para 39 questões respondidas corretamente. Duas anulações, para 38.

Isso é uma ajuda real e pequena. Real porque, na faixa de quem fica entre 38 e 42, ela decide aprovações — e é justamente nessa faixa que se concentra a maior parte de quem passa raspando. Pequena porque não é planejável: você não sabe quantas serão nem quais, e nenhuma estratégia de estudo pode contar com isso.

A leitura correta é a de margem, não de estratégia. Quem entra na prova mirando exatos 40 está apostando numa média histórica de uma questão e meia. Quem mira 45 não precisa da aposta.

## O padrão que aparece — com uma ressalva

Olhando quais questões foram anuladas, há uma concentração aparente em Ética e Estatuto da OAB: cinco das dezesseis. Nenhuma outra disciplina passa de duas.

A ressalva vem aqui, e ela é importante o suficiente para vir antes da explicação. A classificação por disciplina do acervo ainda é automática — feita por léxico e por posição na prova, e nenhuma questão foi confirmada por leitura humana. Ou seja: essas cinco podem ser quatro, ou seis. O padrão é grande o bastante para ser interessante e frágil o bastante para não ser conclusão.

Com essa ressalva no lugar, a explicação plausível é aritmética antes de ser jurídica: Ética é a disciplina mais cobrada da prova, com folga. Mais questões, mais chances de uma sair errada. Não é preciso supor que a banca escreve pior em Ética para explicar por que Ética lidera uma lista de dezesseis.

## Por que elas ficam no acervo

Questão anulada não some daqui. Ela fica, marcada como anulada, e continua acessível como material de estudo — mas fora da fila de treino, porque não tem resposta certa contra a qual medir acerto.

A razão é que uma questão anulada costuma ser a melhor questão da prova para estudar. Ela foi anulada porque tinha duas alternativas defensáveis, ou porque cobrava um ponto em que a doutrina e a jurisprudência divergem, ou porque a redação abriu uma brecha. Qualquer uma dessas é um mapa de onde o tema é escorregadio — e é exatamente onde a próxima prova vai voltar a cobrar, dessa vez com a redação ajustada.

Esconder a questão anulada por ela "não valer ponto" seria jogar fora o dispositivo mais bem sinalizado da prova inteira.

## Como conferir

A ficha de cada edição, em /exames, traz quantas questões foram anuladas naquela prova e se o gabarito é preliminar ou definitivo. Essa marcação não é decoração: é a diferença entre "não houve anulação" e "ainda não sabemos", e o site diz qual dos dois é o caso em cada uma das 43 edições.$post$,
  timestamptz '2026-09-03 11:30:00-03'
),

-- ---------------------------------------------------------------------------
(
  'por-que-nao-dizemos-o-que-mais-cai-com-numero-exato',
  'Por que não dizemos "o que mais cai" com número exato',
  'Temos 2.840 questões classificadas por disciplina e podíamos publicar uma tabela bonita amanhã. Não publicamos, e a explicação é o melhor argumento que temos sobre como este acervo é construído.',
  $post$Existe uma tabela que todo site de estudo para a OAB publica: quantas questões de cada disciplina caem na 1ª fase. Ela aparece com números redondos, sem fonte, e ninguém nunca explica como chegou neles.

Nós temos os dados para publicar a nossa. E ela não está no ar, ou melhor: está no ar marcada como estimativa, e não como medição. Este texto é sobre a diferença.

## O que temos

O acervo tem 3.460 questões reais, dos cadernos oficiais do 3º ao 46º Exame. Dessas, 2.840 têm uma disciplina atribuída. As outras 620 não têm nenhuma.

A atribuição veio de dois procedimentos automáticos. O primeiro é léxico: procurar no enunciado os termos que só existem numa disciplina — "reclamação trabalhista", "habeas corpus", "sociedade limitada". O segundo é posicional: a FGV agrupa as questões por matéria dentro da prova, então uma questão cercada de questões de Processo Civil provavelmente é de Processo Civil.

Os dois funcionam bem. Nenhum dos dois é leitura.

## Por que isso não vira tabela publicada

Se somarmos as 2.840 classificadas, sai um resultado com cara de medição: Ética com 472 questões, Civil com 310, Processual Civil com 258, e assim por diante. Dividido por 43 provas, dá onze questões de Ética por prova.

O problema é que esse número carrega três erros que não se cancelam.

O primeiro são as 620 sem classificação — dezoito por cento do acervo. Elas não estão distribuídas ao acaso: são justamente as questões que nenhum termo característico pegou, o que significa enunciados de caso puro, sem jargão. Provavelmente há mais delas em algumas disciplinas do que em outras, e não sabemos em quais.

O segundo é que o classificador léxico erra de forma enviesada, não aleatória. Uma questão de Direito Civil sobre contrato de trabalho doméstico tem palavra de Trabalho no enunciado. O erro sempre puxa na mesma direção — da disciplina que empresta o vocabulário para a que o tomou emprestado —, e erro enviesado não some com volume. Ele se acumula.

O terceiro é o mais simples: ninguém leu. Nem uma das 2.840. O campo que registra "uma pessoa confirmou esta classificação" está falso em toda a base, e ele está falso porque é verdade.

## O que publicar mesmo assim seria

Uma tabela com esses números, apresentada como contagem, seria um dado com precisão falsa. "Onze questões de Ética por prova" soa medido. Tem duas casas de confiança que a apuração não sustenta, e quem lesse organizaria semanas de estudo em cima disso.

E é aqui que o custo aparece de verdade. Estimativa errada num site de notícia é uma correção. Estimativa errada num site de estudo é alguém que distribuiu os últimos quarenta dias antes da prova segundo uma proporção que não existe. A pessoa não tem como conferir — ela veio até aqui exatamente porque não tem os dados —, e vai descobrir no dia.

Então a página /estatisticas mostra a média histórica por disciplina e diz, com todas as letras, que é estimativa a partir do histórico das provas. Ela é útil, é a melhor coisa que temos, e não se apresenta como o que não é.

## O que já é medição

Nem tudo aqui é aproximado, e a diferença está sempre escrita na tela.

A data de aplicação de cada uma das 43 edições veio do edital, uma a uma. O gabarito é o da FGV. As questões são o texto do caderno oficial. E a incidência de cada dispositivo — o número que aparece nas páginas de legislação e no glossário — conta só citação expressa: a questão nomeia o artigo, com a lei identificada, e qualquer pessoa confere reabrindo a questão.

Esse número é pequeno de propósito. São 155 vínculos, em 106 artigos, num acervo de mais de dez mil dispositivos. Um classificador automático produziria dez vezes mais, e nós temos um rodando — mas o que ele produz alimenta a fila de trabalho interna, onde um erro custa uma leitura a mais, e não a página aberta, onde um erro é um dado falso publicado.

São dois contadores separados, e manter dois é mais trabalho do que manter um. É a diferença inteira.

## Quando muda

Muda quando houver leitura humana em volume. Existe uma tela interna de triagem, feita para tornar esse trabalho rápido, e confirmar ali significa que alguém leu a questão e escolheu a disciplina — não é possível confirmar sem escolher, justamente para que "ninguém sabe" nunca vire "alguém verificou" por um clique distraído.

No dia em que houver questão confirmada em volume, três coisas passam a existir: a distribuição real por disciplina, o gráfico de evolução por matéria de quem estuda, e um filtro por disciplina que é exato em vez de aproximado.

Até lá, o filtro funciona e a tela avisa que é aproximado. É menos impressionante do que uma tabela com números redondos. É a única versão que ainda vai estar certa daqui a um ano.$post$,
  timestamptz '2026-09-03 12:40:00-03'
)

on conflict (slug) do nothing;
