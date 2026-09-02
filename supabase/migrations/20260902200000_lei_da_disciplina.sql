-- ============================================================================
-- A qual disciplina cada lei pertence.
--
-- O vínculo já existia, mas só em `artigos.disciplina_id` — repetido em cada
-- uma das milhares de linhas de um código, e inacessível sem agregação. A
-- tela de estudo precisa da pergunta inversa, e barata: "qual é a norma
-- central de Direito Tributário?".
--
-- Sem isso, `/app/estudar` só sabia oferecer artigo **comentado** como
-- material. Com 13 comentários em 7.654 artigos, o resultado era "sem
-- material ainda" em metade das disciplinas da prova — enquanto o banco tinha
-- o CTN inteiro, o ECA inteiro e a Lei de Licitações inteira. O texto oficial
-- da lei é material de estudo; não anunciá-lo era subestimar o próprio
-- acervo.
--
-- Nulo é permitido de propósito: existe norma que serve a mais de uma
-- disciplina, e vai existir lei carregada antes de alguém decidir onde ela
-- entra. O que não pode é a tela inventar um vínculo que ninguém declarou.
-- ============================================================================

alter table public.leis
  add column if not exists disciplina_id uuid
    references public.disciplinas(id) on delete set null;

create index if not exists leis_disciplina_idx
  on public.leis (disciplina_id);

-- Semeadura a partir do que já está gravado: a disciplina que mais aparece
-- entre os artigos da lei. É exatamente o que o registro do `legislacao.py`
-- declara, e daqui em diante é ele quem escreve a coluna direto.
update public.leis l
   set disciplina_id = escolhida.disciplina_id
  from (
    select distinct on (a.lei_id) a.lei_id, a.disciplina_id, count(*) as n
      from public.artigos a
     where a.disciplina_id is not null
     group by a.lei_id, a.disciplina_id
     order by a.lei_id, n desc
  ) as escolhida
 where l.id = escolhida.lei_id
   and l.disciplina_id is null;
