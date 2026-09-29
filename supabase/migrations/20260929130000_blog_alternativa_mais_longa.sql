-- ============================================================================
-- Sexto texto do blog: "na dúvida, marque a alternativa mais longa".
--
-- Mesma regra dos outros cinco: é uma contagem sobre o acervo, com a consulta
-- descrita no corpo para quem quiser refazer. Medido em 29/09/2026 sobre as
-- 3.524 questões com gabarito (3.540 do 3º ao 46º Exame, menos as 16
-- anuladas). Tamanho = caracteres do texto de cada alternativa, como está no
-- caderno oficial.
--
-- `on conflict (slug) do nothing`: a migration semeia, não sobrescreve
-- revisão feita depois pelo banco.
-- ============================================================================

insert into public.posts (slug, titulo, resumo, corpo, publicado_em) values
(
  'alternativa-mais-longa-e-a-certa-na-oab',
  'Na dúvida, marcar a alternativa mais longa funciona na OAB?',
  'Medimos o tamanho das quatro alternativas em 3.524 questões com gabarito oficial. A resposta certa é a mais longa em 24,1% delas — menos do que o puro acaso daria.',
  $post$Junto com "na dúvida, marque C", circula outro conselho de corredor: a alternativa certa é a mais longa, porque quem escreve a resposta correta precisa pôr todas as ressalvas, e quem escreve as erradas não se dá ao trabalho.

A explicação soa razoável. Dá para conferir. Então conferimos.

## Como medimos

O acervo tem 3.540 questões do 3º ao 46º Exame de Ordem Unificado. Tirando as 16 anuladas, sobram 3.524 com gabarito oficial da banca.

Para cada uma, medimos o tamanho das quatro alternativas em caracteres, exatamente como estão no caderno oficial, e olhamos onde cai a alternativa correta: se é a mais longa das quatro, a mais curta, ou alguma do meio.

Se o conselho funcionasse, a certa seria a mais longa bem mais do que uma vez em quatro. Se a banca não deixasse pista nenhuma, seria perto de 25%.

## O que a contagem mostra

A alternativa correta é a única mais longa em 851 das 3.524 questões: **24,1%**. Menos do que um sorteio daria.

E ela é a única mais curta em 868: 24,6%. Praticamente o mesmo número. Em outras 107 questões, duas ou mais alternativas empatam no maior tamanho, e aí o conselho nem sequer diz qual marcar.

Ordenando as quatro alternativas por tamanho, a certa fica em primeiro lugar em 25,9% das questões, em segundo em 24,3%, em terceiro em 25,2% e em último em 24,6%. As quatro posições ficam a menos de um ponto dos 25% do acaso.

Em média, a alternativa certa tem 1,9% mais caracteres que as outras três. Numa alternativa típica de 140 caracteres, isso dá menos de três letras.

## E ao longo do tempo?

Uma leitura possível é que a pista existia nas provas antigas e a banca corrigiu. Separamos em três épocas de tamanho parecido.

Do 3º ao 16º Exame, a certa foi a mais longa em 27,2% das questões. Do 17º ao 31º, em 22,2%. Do 32º ao 46º, em 23,1% — e, nessas provas recentes, ela foi a mais curta em 27,4%.

Cada época tem por volta de 1.190 questões, e com esse volume uma diferença de até uns dois pontos e meio para cima ou para baixo acontece por acaso. As oscilações ficam nessa faixa e não andam numa direção só: a mais longa acertou um pouco mais no começo, um pouco menos no meio, e nas provas recentes quem aparece acima do esperado é a mais curta. Não há tendência para aproveitar.

Olhando prova por prova, o 13º Exame teve a certa como mais longa em 37,5% das questões. Parece muito, mas são 80 questões — numa amostra desse tamanho, variações de dez pontos são normais. Nenhuma edição isolada serve de regra.

## O que isso quer dizer

Que a FGV equilibra o tamanho das alternativas, e que marcar a mais longa rende o mesmo que marcar qualquer uma. É a mesma conclusão da contagem das letras do gabarito: nas 3.524 questões, a banca não deixa pista de forma.

O conselho sobrevive porque é fácil lembrar das vezes em que funcionou. As 851 questões em que a mais longa estava certa ficam na memória; as outras 2.673 não.

O que decide a questão continua sendo o conteúdo. O caminho para a dúvida virar certeza é ter resolvido questões parecidas antes, e não o tamanho do texto.

## Para refazer a conta

Para cada questão não anulada, compare o número de caracteres da alternativa indicada no gabarito com o das outras três. Conte em quantas ela é estritamente a maior, em quantas é estritamente a menor e em quantas há empate no maior tamanho. Os cadernos e os gabaritos são os oficiais da FGV, publicados pela OAB para cada edição.$post$,
  '2026-09-29 12:00:00-03'
)
on conflict (slug) do nothing;
