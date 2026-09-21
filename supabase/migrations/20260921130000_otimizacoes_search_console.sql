-- Primeiras otimizações guiadas por dados reais do Search Console.
--
-- Os campos são opcionais: a página continua gerando metadata a partir do
-- texto legal para os milhares de artigos que ainda não receberam uma edição
-- específica. Só as páginas com sinal medido de busca ganham texto próprio.
alter table public.artigos
  add column seo_titulo text,
  add column seo_descricao text;

comment on column public.artigos.seo_titulo is
  'Título editorial opcional para busca; nulo usa o título automático do artigo.';
comment on column public.artigos.seo_descricao is
  'Descrição editorial opcional para busca; nulo usa o resumo automático do caput.';

with metadados(lei_slug, artigo_slug, titulo, descricao) as (
  values
    (
      'codigo-penal',
      'artigo-155',
      'Art. 155 do Código Penal: furto comentado',
      'Entenda o art. 155 do Código Penal: furto simples, qualificado e privilegiado, repouso noturno e diferenças para o roubo cobradas na OAB.'
    ),
    (
      'codigo-penal',
      'artigo-157',
      'Art. 157 do Código Penal: roubo comentado',
      'Entenda o art. 157 do Código Penal: roubo próprio e impróprio, causas de aumento e diferenças para o furto cobradas na prova da OAB.'
    ),
    (
      'estatuto-da-oab',
      'artigo-28',
      'Art. 28 do Estatuto da OAB: incompatibilidades',
      'Veja as incompatibilidades do art. 28 do Estatuto da OAB, as exceções para advocacia em causa própria e as pegadinhas cobradas na prova.'
    ),
    (
      'lindb',
      'artigo-6',
      'Art. 6º da LINDB: direito adquirido e coisa julgada',
      'Entenda o art. 6º da LINDB: efeito imediato da lei, ato jurídico perfeito, direito adquirido e coisa julgada para a prova da OAB.'
    ),
    (
      'codigo-de-defesa-do-consumidor',
      'artigo-12',
      'Art. 12 do CDC: responsabilidade pelo fato do produto',
      'Entenda o art. 12 do CDC: responsabilidade objetiva por defeito do produto, agentes responsáveis e excludentes cobradas na prova da OAB.'
    ),
    (
      'codigo-penal',
      'artigo-41',
      'Art. 41 do Código Penal: doença mental superveniente',
      'Entenda o art. 41 do Código Penal: doença mental superveniente à condenação, tratamento adequado e diferença para a inimputabilidade.'
    ),
    (
      'lei-de-licitacoes',
      'artigo-25',
      'Art. 25 da Lei 14.133/2021: regras do edital',
      'Entenda o art. 25 da Lei 14.133/2021: conteúdo obrigatório do edital, regras da licitação e pontos cobrados na prova da OAB.'
    )
)
update public.artigos artigo
   set seo_titulo = metadados.titulo,
       seo_descricao = metadados.descricao
  from public.leis lei, metadados
 where artigo.lei_id = lei.id
   and lei.slug = metadados.lei_slug
   and artigo.slug = metadados.artigo_slug;

-- Posts precisam distinguir publicação de atualização. O sitemap e o JSON-LD
-- passam a comunicar uma revisão substancial sem apagar a data original.
alter table public.posts add column atualizado_em timestamptz;

update public.posts
   set atualizado_em = coalesce(publicado_em, now());

alter table public.posts
  alter column atualizado_em set default now(),
  alter column atualizado_em set not null;

create trigger posts_touch
  before update on public.posts
  for each row execute function public.touch_atualizado_em();

-- A base cresceu, mas o post ainda usava o recorte antigo de 14 gabaritos
-- definitivos. A apuração atual é: 44 edições com questões; 36 delas com
-- gabarito definitivo; 2.880 questões comparáveis; 16 anuladas.
update public.posts
   set titulo = 'Questões anuladas na OAB: frequência nas provas da FGV',
       resumo = 'Em 36 edições com gabarito definitivo, 16 das 2.880 questões foram anuladas: 0,56%. Veja o que essa frequência significa para a prova da OAB.',
       corpo = $post$Recurso contra questão de prova é um gênero literário próprio, e a maior parte dele é esperança. Anulação existe, mas os dados mostram que ela é exceção — pequena demais para virar estratégia de aprovação.

## A base correta da conta

O acervo do OABase reúne 3.540 questões de 44 edições do Exame de Ordem. Esse total, porém, não pode ser usado inteiro para medir anulação.

A anulação só aparece no gabarito definitivo, publicado depois do julgamento dos recursos. Em oito edições, o acervo ainda tem apenas o gabarito preliminar. Tratar essas questões como não anuladas transformaria uma informação ausente numa afirmação falsa sobre a prova.

Por isso, a conta usa somente as 36 edições com gabarito definitivo: são 2.880 questões, das quais 16 foram anuladas. A taxa observada é de 0,56% — aproximadamente uma questão anulada a cada 180 questões aplicadas.

## O que isso representa por prova

As 16 anulações distribuídas por 36 edições equivalem a 0,44 questão por prova. É menos de uma anulação a cada duas provas, em média. Média não é calendário: algumas edições podem concentrar mais de uma e outras não ter nenhuma.

O dado serve para dimensionar a possibilidade, não para prever o próximo exame. Quem planeja acertar exatamente 39 e espera uma anulação para chegar aos 40 está entregando a aprovação a um evento que ocorreu em pouco mais de meio por cento das questões comparáveis.

## O efeito na nota

Quando a banca anula uma questão da primeira fase, o ponto é atribuído conforme as regras do certame. Para quem ficou perto da nota de corte, uma anulação pode decidir o resultado; para o planejamento de estudo, ela não deve entrar na conta.

A leitura prática é de margem. Mirar uma pontuação acima dos 40 acertos reduz a dependência de recurso, mudança de gabarito ou anulação. O histórico mede o tamanho do fenômeno, mas não oferece uma forma segura de antecipá-lo.

## Por que as anuladas continuam no acervo

Questão anulada não entra na fila de treino, porque não existe resposta definitiva contra a qual medir acerto. Ela continua na ficha da edição e no acervo como documento oficial da prova.

Essas questões também ajudam a localizar temas em que a redação, a interpretação ou as alternativas produziram controvérsia. O valor delas é editorial: revisar o motivo da anulação, não fingir que existe um gabarito correto.

## Como conferir

A ficha de cada edição em /exames informa quantas questões foram anuladas e se o gabarito disponível é preliminar ou definitivo. A conta deste texto soma `questoes_carregadas` somente nas edições com `gabarito_definitivo = true` e, no mesmo recorte, soma `questoes_anuladas`. Assim, “não houve anulação” nunca é confundido com “ainda não temos o resultado definitivo”.$post$
 where slug = 'questoes-anuladas-no-exame-de-ordem';
