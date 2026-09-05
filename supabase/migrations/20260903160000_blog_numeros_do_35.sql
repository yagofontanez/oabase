-- ============================================================================
-- Os números dos textos, depois da entrada do 35º Exame.
--
-- Todo post do blog daqui é uma contagem sobre o acervo, e o acervo mudou:
-- entrou o 35º Exame (80 questões, gabarito definitivo) e saiu o rodapé de
-- página que estava grudado em 645 alternativas. O acervo foi de 3.460 para
-- 3.540 questões e de 43 para 44 edições.
--
-- **Texto que afirma "conte você mesmo e chegará a este número" tem de
-- continuar verdadeiro.** É a única coisa que esses textos oferecem que
-- nenhum outro site oferece; um número velho aqui não é desatualização, é a
-- promessa quebrada. Por isso a correção vem junto com a carga, e não depois.
--
-- As substituições são pontuais, e não reescrita: o que muda é aritmética, a
-- leitura dos dados não mudou em nenhum dos cinco. Onde a conclusão dependia
-- do número — "uma questão e meia por prova" virou "pouco mais de uma" —, a
-- frase mudou junto.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Os artigos que a OAB citou de forma expressa
-- ---------------------------------------------------------------------------
update public.posts set
  resumo = replace(resumo, '3.460 questões das provas', '3.540 questões das provas'),
  corpo = replace(replace(replace(replace(replace(replace(replace(replace(replace(
    corpo,
    '3.460 questões objetivas', '3.540 questões objetivas'),
    'Unificado — 43 edições', 'Unificado — 44 edições'),
    'De 3.460 questões, apenas 133 citam um artigo de forma expressa. Quatro por cento.',
    'De 3.540 questões, apenas 135 citam um artigo de forma expressa. Menos de quatro por cento.'),
    'mais nomeados nas 43 provas', 'mais nomeados nas 44 provas'),
    'Art. 85 do Código de Processo Civil, honorários de sucumbência, e art. 129 do Código Penal, lesão corporal, em 4. Depois vêm, com 3 cada, o art. 121 do Código Penal, o art. 150 da Constituição, o art. 334 do Código de Processo Civil e os arts. 213 e 217-A do Código Penal.',
    'Art. 85 do Código de Processo Civil, honorários de sucumbência, o art. 129 do Código Penal, lesão corporal, e o art. 217-A, em 4 cada. Depois vêm, com 3, o art. 121 do Código Penal, o art. 213, o art. 150 da Constituição e o art. 334 do Código de Processo Civil.'),
    '## Por que 106 artigos e não 5.756', '## Por que 113 artigos e não 10.168'),
    'tem 5.756 artigos de oito códigos', 'tem 10.168 artigos de 42 normas'),
    'Desses, 106 têm pelo menos uma citação', 'Desses, 113 têm pelo menos uma citação'),
    'Em 43 provas medidas', 'Em 44 provas medidas')
where slug = 'artigos-mais-citados-nas-provas-da-oab';

-- ---------------------------------------------------------------------------
-- 2. A letra que mais cai no gabarito
-- ---------------------------------------------------------------------------
update public.posts set
  resumo = replace(resumo, 'as 3.444 questões válidas de 43 provas', 'as 3.524 questões válidas de 44 provas'),
  corpo = replace(replace(replace(replace(replace(replace(replace(replace(
    corpo,
    'O acervo tem 3.460 questões objetivas', 'O acervo tem 3.540 questões objetivas'),
    'sobram 3.444 questões', 'sobram 3.524 questões'),
    'A alternativa B foi a correta em 909 questões, 26,4% do total. A C, em 880, 25,6%. A D, em 849, 24,7%. E a A, em 806, 23,4%.',
    'A alternativa B foi a correta em 931 questões, 26,4% do total. A C, em 903, 25,6%. A D, em 866, 24,6%. E a A, em 824, 23,4%.'),
    'num universo de três mil e quatrocentas questões', 'num universo de três mil e quinhentas questões'),
    'a B foi a letra mais frequente em 17 das 43 edições, contra 10 da C e 8 de cada uma das outras duas',
    'a B foi a letra mais frequente em 17 das 44 edições, contra 12 da C, 9 da A e 6 da D'),
    'e pouco o bastante para que 43 edições não permitam separar tendência de acaso — em 26 das 43 provas quem liderou foi outra letra',
    'e pouco o bastante para que 44 edições não permitam separar tendência de acaso — em 27 das 44 provas quem liderou foi outra letra'),
    'Nas 43 edições, nenhuma letra', 'Nas 44 edições, nenhuma letra'),
    'as fichas das 43 edições', 'as fichas das 44 edições')
where slug = 'letra-que-mais-cai-no-gabarito-da-oab';

-- ---------------------------------------------------------------------------
-- 3. A prova não ficou mais difícil, ficou mais longa
-- ---------------------------------------------------------------------------
update public.posts set
  corpo = replace(replace(replace(
    corpo,
    'em cada uma das 3.460 questões do acervo', 'em cada uma das 3.540 questões do acervo'),
    'As 43 edições estão em /exames', 'As 44 edições estão em /exames'),
    'do 3º Exame ao 46º', 'do 3º Exame ao 46º')
where slug = 'enunciados-mais-longos-exame-de-ordem';

-- ---------------------------------------------------------------------------
-- 4. As questões anuladas
--
-- Aqui a entrada do 35º muda mais do que aritmética: ele tem gabarito
-- definitivo, então a base de cálculo da anulação sobe de 1.040 para 1.120
-- questões sem que nenhuma anulação nova entre. A taxa cai, e a frase que
-- traduzia a taxa em "uma questão e meia por prova" tinha de cair junto.
-- ---------------------------------------------------------------------------
update public.posts set
  resumo = replace(resumo,
    'Nas 13 edições em que temos o gabarito definitivo, 16 questões foram anuladas em 1.040 — uma e meia a cada cem.',
    'Nas 14 edições em que temos o gabarito definitivo, 16 questões foram anuladas em 1.120 — uma e meia a cada cem.'),
  corpo = replace(replace(replace(replace(replace(replace(
    corpo,
    'O acervo tem 3.460 questões', 'O acervo tem 3.540 questões'),
    'Das 43 edições do acervo, temos o gabarito definitivo de 13; das outras 30',
    'Das 44 edições do acervo, temos o gabarito definitivo de 14; das outras 30'),
    'Então a base é: 1.040 questões, nas 13 edições em que sabemos. Dessas, 16 foram anuladas. Um vírgula cinco por cento — cerca de uma questão e meia por prova de 80.',
    'Então a base é: 1.120 questões, nas 14 edições em que sabemos. Dessas, 16 foram anuladas. Um vírgula quatro por cento — pouco mais de uma questão por prova de 80.'),
    'Quem entra na prova mirando exatos 40 está apostando numa média histórica de uma questão e meia.',
    'Quem entra na prova mirando exatos 40 está apostando numa média histórica de pouco mais de uma questão.'),
    'em cada uma das 43 edições', 'em cada uma das 44 edições'),
    'se o gabarito é preliminar ou definitivo', 'se o gabarito é preliminar ou definitivo')
where slug = 'questoes-anuladas-no-exame-de-ordem';

-- ---------------------------------------------------------------------------
-- 5. Por que não dizemos "o que mais cai" com número exato
-- ---------------------------------------------------------------------------
update public.posts set
  resumo = replace(resumo, 'Temos 2.840 questões classificadas', 'Temos 2.910 questões classificadas'),
  corpo = replace(replace(replace(replace(replace(replace(replace(
    corpo,
    'O acervo tem 3.460 questões reais', 'O acervo tem 3.540 questões reais'),
    'Dessas, 2.840 têm uma disciplina atribuída. As outras 620 não têm nenhuma.',
    'Dessas, 2.910 têm uma disciplina atribuída. As outras 630 não têm nenhuma.'),
    'Se somarmos as 2.840 classificadas', 'Se somarmos as 2.910 classificadas'),
    'Ética com 472 questões, Civil com 310, Processual Civil com 258',
    'Ética com 483 questões, Civil com 320, Processual Civil com 265'),
    'Dividido por 43 provas, dá onze questões de Ética por prova.',
    'Dividido por 44 provas, dá onze questões de Ética por prova.'),
    'O primeiro são as 620 sem classificação', 'O primeiro são as 630 sem classificação'),
    'São 155 vínculos, em 106 artigos, num acervo de mais de dez mil dispositivos.',
    'São 164 vínculos, em 113 artigos, num acervo de mais de dez mil dispositivos.')
where slug = 'por-que-nao-dizemos-o-que-mais-cai-com-numero-exato';

-- Estes dois aparecem em parágrafos diferentes dos de cima.
update public.posts set
  corpo = replace(replace(
    corpo,
    'Nem uma das 2.840.', 'Nem uma das 2.910.'),
    'a data de aplicação de cada uma das 43 edições', 'a data de aplicação de cada uma das 44 edições')
where slug = 'por-que-nao-dizemos-o-que-mais-cai-com-numero-exato';

update public.posts set
  corpo = replace(corpo,
    'A data de aplicação de cada uma das 43 edições', 'A data de aplicação de cada uma das 44 edições')
where slug = 'por-que-nao-dizemos-o-que-mais-cai-com-numero-exato';
