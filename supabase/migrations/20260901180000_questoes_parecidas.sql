-- ============================================================================
-- Questões parecidas.
--
-- Serve ao momento em que a pessoa erra: "onde mais isto cai?" é a pergunta
-- seguinte, e responder com outras três questões do mesmo assunto vale mais
-- do que qualquer explicação genérica.
--
-- A coluna `questoes.embedding vector(1536)` existe no schema desde o início
-- e está **vazia** — o projeto não tem chave de nenhum serviço de embeddings
-- (a Groq, que gera o plano de estudos, não oferece esse endpoint). Então a
-- função trabalha com dois sinais que já existem hoje e usa o vetor assim que
-- ele aparecer, sem precisar de outra migration:
--
--   1. **dispositivo em comum** — duas questões que citam o mesmo artigo são
--      sobre a mesma coisa. É o sinal mais forte e o mais barato, e vem de
--      `questao_artigos`, que é vínculo verificável, não palpite.
--   2. **semelhança de texto** — `ts_rank` sobre `search_vector`, em
--      português, sem serviço externo.
--   3. **embedding**, quando houver: distância de cosseno, que captura
--      "mesmo assunto com outras palavras" — justamente o que o full-text
--      não pega.
--
-- A pontuação soma os sinais em vez de escolher um: uma questão que cita o
-- mesmo artigo *e* fala parecido deve vir antes de outra que só faz um dos
-- dois.
-- ============================================================================

create or replace function public.questoes_parecidas(
  p_questao_id uuid,
  p_limite int default 4
)
returns table (
  id uuid,
  numero int,
  edicao int,
  exame_slug text,
  disciplina_nome text,
  resumo text,
  motivo text,
  pontos real
)
language sql
stable
security invoker  -- a RLS de `questoes` continua exigindo assinatura ativa
set search_path = public, extensions
as $$
  with alvo as (
    select q.id, q.disciplina_id, q.embedding,
           to_tsvector('portuguese', q.enunciado) as vetor
    from public.questoes q
    where q.id = p_questao_id
  ),
  consulta as (
    -- Os termos do enunciado viram uma consulta OR. `plainto_tsquery` exigiria
    -- todos ao mesmo tempo e não casaria com questão nenhuma.
    select string_agg(palavra, ' | ')::tsquery as q
    from (
      select (unnest(tsvector_to_array((select vetor from alvo))))::text as palavra
      limit 40
    ) termos
  ),
  dispositivos as (
    select qa.artigo_id
    from public.questao_artigos qa
    where qa.questao_id = p_questao_id
  ),
  candidatas as (
    select
      c.id, c.numero, c.enunciado, c.disciplina_id, c.exame_id, c.embedding,
      -- Quantos artigos em comum. Zero na esmagadora maioria dos casos, e é
      -- por isso que ele soma em vez de filtrar.
      (select count(*) from public.questao_artigos qa2
        where qa2.questao_id = c.id
          and qa2.artigo_id in (select artigo_id from dispositivos))::real
        as artigos_comuns,
      ts_rank(c.search_vector, (select q from consulta)) as texto,
      case
        when (select embedding from alvo) is not null and c.embedding is not null
        then 1 - (c.embedding <=> (select embedding from alvo))
        else 0
      end::real as vetorial
    from public.questoes c, alvo
    where c.id <> p_questao_id
      and not c.anulada
      and c.gabarito is not null
      and (
        c.search_vector @@ (select q from consulta)
        or exists (select 1 from public.questao_artigos qa3
                    where qa3.questao_id = c.id
                      and qa3.artigo_id in (select artigo_id from dispositivos))
      )
  )
  select
    cd.id,
    cd.numero,
    e.edicao,
    e.slug,
    d.nome,
    left(cd.enunciado, 200),
    case
      when cd.artigos_comuns > 0 then 'mesmo dispositivo'
      when cd.vetorial > 0 then 'assunto semelhante'
      else 'texto semelhante'
    end,
    (cd.artigos_comuns * 3.0
      + cd.texto * 1.0
      + cd.vetorial * 2.0
      + case when cd.disciplina_id = (select disciplina_id from alvo)
             then 0.3 else 0 end)::real
  from candidatas cd
    join public.exames e on e.id = cd.exame_id
    left join public.disciplinas d on d.id = cd.disciplina_id
  order by 8 desc
  limit greatest(1, least(p_limite, 10));
$$;

grant execute on function public.questoes_parecidas(uuid, int) to authenticated;

-- Índice para a distância de cosseno. Criado agora, vazio, porque `embedding`
-- ainda não é preenchido: quando o pipeline de embeddings rodar, a consulta
-- já encontra o índice pronto em vez de varrer 1.120 vetores.
--
-- `ivfflat` precisa de linhas para calibrar as listas; com a coluna vazia ele
-- seria construído sobre nada. `hnsw` não tem esse problema.
create index if not exists questoes_embedding_idx
  on public.questoes using hnsw (embedding extensions.vector_cosine_ops);
