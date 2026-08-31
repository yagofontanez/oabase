-- ============================================================================
-- Seed de desenvolvimento. Espelha os dados que hoje vivem em
-- src/lib/content/data.ts, para que o app renderize igual antes e depois de
-- apontar para o banco. Substituído pela carga do pipeline na Fase 0.
-- ============================================================================

insert into public.disciplinas (slug, nome, media_por_prova) values
  ('etica-e-estatuto-da-oab',              'Ética e Estatuto da OAB',       8),
  ('direito-constitucional',               'Direito Constitucional',        7),
  ('direito-civil',                        'Direito Civil',                 7),
  ('direito-processual-civil',             'Direito Processual Civil',      7),
  ('direito-penal',                        'Direito Penal',                 6),
  ('direito-do-trabalho',                  'Direito do Trabalho',           6),
  ('direito-processual-penal',             'Direito Processual Penal',      5),
  ('direito-administrativo',               'Direito Administrativo',        5),
  ('direito-empresarial',                  'Direito Empresarial',           5),
  ('direito-processual-do-trabalho',       'Direito Processual do Trabalho',4),
  ('direito-tributario',                   'Direito Tributário',            4),
  ('direitos-humanos',                     'Direitos Humanos',              3),
  ('direito-previdenciario',               'Direito Previdenciário',        3),
  ('filosofia-do-direito',                 'Filosofia do Direito',          2),
  ('direito-internacional',                'Direito Internacional',         2),
  ('direito-ambiental',                    'Direito Ambiental',             2),
  ('direito-do-consumidor',                'Direito do Consumidor',         2),
  ('estatuto-da-crianca-e-do-adolescente', 'ECA',                           2);

insert into public.leis (slug, nome, sigla, ano, resumo) values
  ('constituicao-federal', 'Constituição Federal', 'CF/88', 1988,
   'A norma mais cobrada do exame. Direitos fundamentais, organização do Estado e controle de constitucionalidade aparecem em toda edição.'),
  ('codigo-civil', 'Código Civil', 'CC', 2002,
   'Base de Direito Civil na prova: responsabilidade civil, contratos, direitos reais e família concentram a maior parte das questões.'),
  ('codigo-penal', 'Código Penal', 'CP', 1940,
   'Parte geral e crimes contra a pessoa e o patrimônio dominam a incidência em Direito Penal.');

-- Exames NÃO são semeados: entram pelo pipeline de ingestão, com data e
-- questões vindas dos PDFs oficiais da FGV. Datas inventadas em seed são
-- indistinguíveis de datas reais depois que ambas estão na mesma tabela —
-- e uma delas já tinha o 41º Exame acontecendo depois do 43º.
--
--   cd ingest && python3 -m oabase_ingest.pipeline \
--       --prova <caderno>.pdf --gabarito <gabarito>.pdf \
--       --edicao 43 --ano 2025 --data 2025-04-27 --carregar

insert into public.artigos
  (lei_id, disciplina_id, numero, slug, caput, paragrafos, comentario, incidencia, indexavel, atualizado_em)
values
(
  (select id from public.leis where slug = 'constituicao-federal'),
  (select id from public.disciplinas where slug = 'direito-constitucional'),
  '5º', 'artigo-5',
  $c$Todos são iguais perante a lei, sem distinção de qualquer natureza, garantindo-se aos brasileiros e aos estrangeiros residentes no País a inviolabilidade do direito à vida, à liberdade, à igualdade, à segurança e à propriedade, nos termos seguintes:$c$,
  array[
    $c$§ 1º As normas definidoras dos direitos e garantias fundamentais têm aplicação imediata.$c$,
    $c$§ 2º Os direitos e garantias expressos nesta Constituição não excluem outros decorrentes do regime e dos princípios por ela adotados, ou dos tratados internacionais em que a República Federativa do Brasil seja parte.$c$,
    $c$§ 3º Os tratados e convenções internacionais sobre direitos humanos que forem aprovados, em cada Casa do Congresso Nacional, em dois turnos, por três quintos dos votos dos respectivos membros, serão equivalentes às emendas constitucionais.$c$
  ],
  array[
    $c$É o artigo mais cobrado do exame inteiro, e quase nunca na forma de decoreba do caput. A FGV costuma montar um caso concreto curto e pedir qual inciso resolve a situação — o que exige leitura de aplicação, não memorização de lista.$c$,
    $c$Preste atenção especial ao **§ 3º**: tratados de direitos humanos aprovados pelo rito das emendas ganham status constitucional; fora desse rito, o STF firmou o entendimento de que valem como norma **supralegal** — acima da lei ordinária, abaixo da Constituição. Essa distinção de hierarquia é a pegadinha recorrente.$c$,
    $c$O **§ 1º** também rende questão: aplicação imediata não significa que toda norma de direito fundamental dispense regulamentação, e é justamente aí que o mandado de injunção entra como remédio.$c$
  ],
  47, true, '2026-07-14'
),
(
  (select id from public.leis where slug = 'constituicao-federal'),
  (select id from public.disciplinas where slug = 'direito-administrativo'),
  '37', 'artigo-37',
  $c$A administração pública direta e indireta de qualquer dos Poderes da União, dos Estados, do Distrito Federal e dos Municípios obedecerá aos princípios de legalidade, impessoalidade, moralidade, publicidade e eficiência e, também, ao seguinte:$c$,
  array[
    $c$§ 6º As pessoas jurídicas de direito público e as de direito privado prestadoras de serviços públicos responderão pelos danos que seus agentes, nessa qualidade, causarem a terceiros, assegurado o direito de regresso contra o responsável nos casos de dolo ou culpa.$c$
  ],
  array[
    $c$O caput traz o mnemônico que todo mundo decora — **LIMPE** — mas a prova raramente pergunta a sigla. Ela pergunta qual princípio foi violado num caso concreto, e a confusão frequente é entre impessoalidade e moralidade.$c$,
    $c$O **§ 6º** é o coração da responsabilidade civil do Estado: responsabilidade **objetiva** perante o terceiro lesado (basta conduta, dano e nexo), e **subjetiva** na ação de regresso contra o agente, que só responde havendo dolo ou culpa. Trocar essas duas naturezas é o erro mais comum do tema.$c$,
    $c$Note que o dispositivo alcança pessoas jurídicas de direito privado **prestadoras de serviço público** — concessionárias entram, empresa estatal exploradora de atividade econômica não.$c$
  ],
  31, true, '2026-06-02'
),
(
  (select id from public.leis where slug = 'codigo-civil'),
  (select id from public.disciplinas where slug = 'direito-civil'),
  '186', 'artigo-186',
  $c$Aquele que, por ação ou omissão voluntária, negligência ou imprudência, violar direito e causar dano a outrem, ainda que exclusivamente moral, comete ato ilícito.$c$,
  array[]::text[],
  array[
    $c$Artigo curto e de altíssima incidência. Ele define o ato ilícito pela **cláusula geral da culpa**, reunindo quatro elementos: conduta, culpa em sentido amplo (dolo, negligência ou imprudência), dano e nexo causal.$c$,
    $c$A expressão “ainda que exclusivamente moral” é o gancho preferido da banca: consagra o dano moral autônomo, que não depende de repercussão patrimonial para ser indenizável.$c$,
    $c$Leia sempre em conjunto com o **art. 927** — o 186 define o ilícito, o 927 impõe o dever de reparar. Questões que misturam os dois costumam testar se o candidato sabe onde mora a responsabilidade objetiva.$c$
  ],
  28, true, '2026-05-19'
),
(
  (select id from public.leis where slug = 'codigo-civil'),
  (select id from public.disciplinas where slug = 'direito-civil'),
  '927', 'artigo-927',
  $c$Aquele que, por ato ilícito (arts. 186 e 187), causar dano a outrem, fica obrigado a repará-lo.$c$,
  array[
    $c$Parágrafo único. Haverá obrigação de reparar o dano, independentemente de culpa, nos casos especificados em lei, ou quando a atividade normalmente desenvolvida pelo autor do dano implicar, por sua natureza, risco para os direitos de outrem.$c$
  ],
  -- Comentário ainda em revisão: fora do índice e fora do sitemap.
  array[]::text[],
  24, false, '2026-08-11'
),
(
  (select id from public.leis where slug = 'codigo-penal'),
  (select id from public.disciplinas where slug = 'direito-penal'),
  '121', 'artigo-121',
  $c$Matar alguém: Pena — reclusão, de seis a vinte anos.$c$,
  array[
    $c$§ 1º Se o agente comete o crime impelido por motivo de relevante valor social ou moral, ou sob o domínio de violenta emoção, logo em seguida a injusta provocação da vítima, o juiz pode reduzir a pena de um sexto a um terço.$c$,
    $c$§ 2º Se o homicídio é cometido por motivo torpe, fútil, com emprego de veneno, fogo, explosivo, asfixia, tortura ou outro meio insidioso ou cruel, ou à traição, de emboscada, ou mediante dissimulação: Pena — reclusão, de doze a trinta anos.$c$
  ],
  array[
    $c$O tipo básico é de uma linha, mas a prova vive das qualificadoras e da causa de diminuição. O **§ 1º** traz o chamado homicídio privilegiado — causa de diminuição obrigatória quanto ao reconhecimento, facultativa quanto ao quantum.$c$,
    $c$Distinção que a FGV cobra com frequência: motivo **fútil** é o de somenos importância; motivo **torpe** é o repugnante, vil. Ciúme, isoladamente, a jurisprudência majoritária não reconhece como torpe.$c$,
    $c$O homicídio privilegiado-qualificado é admitido quando a qualificadora é de natureza **objetiva** (meio ou modo de execução), já que privilegiadoras são sempre subjetivas e seriam incompatíveis com qualificadoras subjetivas.$c$
  ],
  19, true, '2026-04-28'
);
