-- ============================================================================
-- Glossário com procedência.
--
-- A tabela existia desde o schema inicial, vazia e sem rota. O que faltava
-- não era conteúdo — era decidir de onde ele viria sem virar texto autoral
-- sobre direito.
--
-- A resposta: **a definição é o artigo**. Cada verbete aponta para o
-- dispositivo que define o termo, e o texto exibido é o do próprio artigo,
-- literal. O que se acrescenta é a curadoria — qual termo merece verbete e
-- onde ele está definido —, e isso é trabalho de índice, não de doutrina.
--
-- Daí a coluna nova: sem `artigo_id`, o verbete seria uma frase solta sobre
-- direito, do tipo que existe em mil sites e que ninguém consegue conferir.
-- Com ela, cada definição carrega o endereço da fonte e o link para o texto
-- completo.
-- ============================================================================

alter table public.termos_glossario
  add column if not exists artigo_id uuid
    references public.artigos(id) on delete cascade,
  add column if not exists disciplina_id uuid
    references public.disciplinas(id) on delete set null;

create index if not exists termos_glossario_artigo_idx
  on public.termos_glossario (artigo_id);

comment on column public.termos_glossario.artigo_id is
  'Dispositivo que define o termo. A definição exibida é o texto dele, '
  'literal — o verbete não parafraseia a lei.';
