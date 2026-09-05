-- ============================================================================
-- Reescrita do texto sobre método.
--
-- A versão anterior expunha o estado interno do trabalho editorial numa
-- página pública — "ninguém leu", "o campo que registra que uma pessoa
-- confirmou está falso em toda a base" — e descrevia a tela interna de
-- triagem. Era verdade quando foi escrito e não era assunto de post: o que
-- está publicado no domínio fala do produto para quem compra, e o andamento
-- do trabalho de dentro não é conteúdo.
--
-- O argumento que valia a pena fica inteiro, porque não dependia daquilo:
-- classificador automático erra de forma enviesada, erro enviesado não se
-- cancela com volume, e por isso a distribuição por disciplina é publicada
-- como estimativa enquanto data, gabarito, texto da questão e citação
-- expressa são publicados como medição.
--
-- Nada aqui afirma nada sobre revisão humana, em nenhum dos dois sentidos.
-- ============================================================================

update public.posts set
  resumo =
    'Todo site de estudo publica uma tabela de quantas questões de cada '
    'disciplina caem na prova, com números redondos e sem fonte. A nossa '
    'está no ar marcada como estimativa — e a explicação é o melhor '
    'argumento que temos sobre como este acervo é construído.',
  corpo = $post$Existe uma tabela que todo site de estudo para a OAB publica: quantas questões de cada disciplina caem na 1ª fase. Ela aparece com números redondos, sem fonte, e ninguém nunca explica como chegou neles.

A nossa está no ar marcada como **estimativa**, e não como medição. Este texto é sobre a diferença entre as duas coisas — que é, provavelmente, a decisão editorial mais importante de um site que comenta direito.

## O que é transcrito e o que é atribuído

O acervo tem 3.540 questões reais, dos cadernos oficiais do 3º ao 46º Exame de Ordem Unificado.

Do enunciado ao gabarito, tudo nelas é transcrição de documento oficial: o texto vem do caderno publicado pela banca, a resposta certa vem da folha de gabarito, a data de aplicação vem do edital de cada edição. Nada disso é interpretação nossa, e por isso nada disso vai para a tela com ressalva.

A disciplina de cada questão é outra coisa. Ela não está escrita no caderno — a prova não diz "esta é de Direito Civil". Ela é atribuída depois, por quem monta o acervo. Atribuir e transcrever não são a mesma operação, e o site não pode tratar as duas como se fossem.

## Como a atribuição é feita

São dois procedimentos, e vale explicar os dois, porque explicar é o que permite conferir.

O primeiro é léxico: procurar no enunciado os termos que só existem numa disciplina — "reclamação trabalhista", "habeas corpus", "sociedade limitada".

O segundo é posicional, e se apoia num fato da diagramação da prova: a FGV monta o caderno em blocos contíguos por matéria. Uma questão cercada de questões de Processo Civil é, quase sempre, de Processo Civil. Esse segundo passo corrige boa parte do que o léxico erra sozinho.

Os dois funcionam bem. Nenhum dos dois é infalível — e o jeito como eles falham importa mais do que a taxa com que falham.

## Por que classificação automática não vira tabela publicada

Porque ela erra de forma enviesada, e não aleatória.

Uma questão de Direito Civil sobre contrato de trabalho doméstico tem palavra de Trabalho no enunciado. Uma questão de Constitucional sobre competência tributária tem palavra de Tributário. O erro sempre puxa na mesma direção: da disciplina que empresta o vocabulário para a que o tomou emprestado. Erro aleatório se dilui quando o volume cresce. Erro enviesado se acumula.

Uma tabela montada em cima disso e apresentada como contagem seria um dado com precisão falsa. "Onze questões de Ética por prova" soa medido. Soa mais preciso do que a apuração sustenta, e quem lê organiza semanas de estudo em cima do número.

E é aqui que o custo aparece de verdade. Estimativa errada num site de notícia é uma correção no dia seguinte. Estimativa errada num site de estudo é alguém que distribuiu os últimos quarenta dias antes da prova segundo uma proporção que não existe — e que não tem como conferir, porque veio até aqui exatamente por não ter os dados. Descobre no dia.

Então /estatisticas mostra a média histórica por disciplina e diz, com todas as letras, que é estimativa a partir do histórico das provas aplicadas. É útil, é a melhor resposta que temos para essa pergunta, e não se apresenta como o que não é.

## O que já é medição

A diferença está sempre escrita na tela, e vale saber onde ela cai.

A data de aplicação de cada uma das 44 edições veio do edital, uma a uma. O gabarito é o da banca, com a marca de preliminar ou definitivo na ficha de cada exame. As questões são o texto do caderno oficial, anuladas incluídas.

E a incidência de cada dispositivo — o número que aparece nas páginas de legislação e ao lado de cada verbete do glossário — conta só citação expressa: a questão nomeia o artigo, com a lei identificada. São 164 vínculos, em 113 artigos, num acervo de mais de dez mil dispositivos.

Esse número é pequeno de propósito. Completar a lista por semelhança de texto encheria a tabela e destruiria a única coisa que ela tem de valioso: dá para abrir a questão, ler, e conferir que o número está escrito lá. Um número que não se confere não vale mais do que um chute bem formatado — vale menos, porque parece que vale.

## A regra

Número contado e número estimado moram em lugares diferentes e nunca trocam de roupa.

É menos impressionante do que uma tabela redonda. É a única versão que ainda vai estar certa daqui a um ano — e é a diferença entre um site que você pode conferir e um site em que você tem que acreditar.$post$
where slug = 'por-que-nao-dizemos-o-que-mais-cai-com-numero-exato';

-- A mesma frase aparecia no texto sobre anulação, na ressalva que precede a
-- observação sobre Ética. A ressalva continua necessária — o padrão é frágil
-- e o texto tem de dizer isso —, mas ela se sustenta pelo método, e não por
-- uma declaração sobre o andamento do trabalho de dentro.
update public.posts set
  corpo = replace(corpo,
    'A classificação por disciplina do acervo ainda é automática — feita por léxico e por posição na prova, e nenhuma questão foi confirmada por leitura humana. Ou seja: essas cinco podem ser quatro, ou seis.',
    'A disciplina de cada questão não vem escrita no caderno: ela é atribuída depois, por léxico e por posição na prova. Ou seja: essas cinco podem ser quatro, ou seis.')
where slug = 'questoes-anuladas-no-exame-de-ordem';
