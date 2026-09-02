-- ============================================================================
-- Desempenho por disciplina.
--
-- A tela de desempenho promete "evolução por disciplina" no estado vazio e
-- nunca entregou, por uma razão boa: enquanto nenhuma questão tivesse
-- classificação, o gráfico seria dado inventado com cara de medição.
--
-- Com a classificação automática isso muda de natureza — deixa de ser
-- invenção e passa a ser estimativa declarada. A tela diz de onde vem, e o
-- número deixa de faltar.
--
-- Duas decisões herdadas de `meu_desempenho`, e pelos mesmos motivos:
--
-- 1. **Conta por questão, não por tentativa.** Quem errou três vezes e
--    acertou na quarta tem uma questão dominada, não três erros — e é a
--    **última** tentativa que diz onde a pessoa está hoje.
-- 2. **`security invoker`.** A RLS de `respostas` já filtra por dono; uma
--    função `definer` aqui só criaria uma segunda porta para o mesmo dado.
-- ============================================================================

create or replace function public.meu_desempenho_por_disciplina()
returns table (
  disciplina_slug text,
  disciplina_nome text,
  respondidas bigint,
  acertos bigint,
  automatica bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with ultima as (
    select distinct on (r.questao_id)
           r.questao_id, r.acertou
      from public.respostas r
     where r.user_id = auth.uid()
     order by r.questao_id, r.respondido_em desc
  )
  select d.slug,
         d.nome,
         count(*),
         count(*) filter (where u.acertou),
         -- Quantas dessas questões tiveram a disciplina atribuída por
         -- modelo. É o que permite à tela dizer o quanto do número é
         -- estimativa, em vez de afirmar precisão que não tem.
         count(*) filter (where q.classificacao_origem = 'modelo')
    from ultima u
    join public.questoes q on q.id = u.questao_id
    join public.disciplinas d on d.id = q.disciplina_id
   group by d.slug, d.nome
   order by count(*) desc, d.nome;
$$;

grant execute on function public.meu_desempenho_por_disciplina() to authenticated;
