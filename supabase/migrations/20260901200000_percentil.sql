-- ============================================================================
-- Percentil: como você vai, comparado a quem mais respondeu.
--
-- Duas perguntas diferentes, e as duas importam:
--
--   "esta questão é difícil?"  → quantos acertam esta questão específica;
--   "eu vou bem?"              → onde a minha taxa cai na distribuição.
--
-- Três decisões que sustentam o número:
--
-- 1. **Conta a primeira tentativa de cada pessoa em cada questão.** Depois de
--    ver o gabarito, acertar de novo é memória, não conhecimento — e a fila
--    de revisão faz justamente a questão voltar. Contar tentativas
--    inflacionaria a taxa de acerto de todo mundo com o tempo.
--
-- 2. **Piso de respondentes.** Com dois respondentes, "50% acertam" não é
--    estatística, é uma moeda; e num universo de dois, o número diz o que a
--    outra pessoa respondeu. Abaixo do piso a função devolve nulo e a tela
--    não mostra nada — melhor silêncio do que número frágil.
--
-- 3. **Agregado incremental, não `count` na hora.** `estatisticas_questao` é
--    mantida por gatilho a cada primeira resposta. A alternativa — varrer
--    `respostas` a cada questão exibida — funciona hoje com um punhado de
--    linhas e para de funcionar exatamente quando o produto der certo.
-- ============================================================================

create table public.estatisticas_questao (
  questao_id uuid primary key references public.questoes(id) on delete cascade,
  -- Quantas pessoas distintas já encararam a questão pela primeira vez.
  respondentes int not null default 0,
  acertos int not null default 0,
  atualizado_em timestamptz not null default now()
);

comment on table public.estatisticas_questao is
  'Dificuldade medida por questão. Só a primeira tentativa de cada pessoa.';

-- Sem RLS aberta e sem grant: o agregado sai apenas pelas funções abaixo,
-- que decidem o piso. Liberar `select` daria a qualquer sessão a contagem
-- questão a questão, inclusive das que ela nunca viu.
alter table public.estatisticas_questao enable row level security;

create or replace function public.contabilizar_primeira_resposta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Só a estreia daquela pessoa naquela questão entra na conta.
  if exists (
    select 1 from public.respostas r
     where r.user_id = new.user_id
       and r.questao_id = new.questao_id
       and r.id <> new.id
  ) then
    return null;
  end if;

  insert into public.estatisticas_questao (questao_id, respondentes, acertos)
  values (new.questao_id, 1, case when new.acertou then 1 else 0 end)
  on conflict (questao_id) do update
    set respondentes = public.estatisticas_questao.respondentes + 1,
        acertos = public.estatisticas_questao.acertos
                  + case when new.acertou then 1 else 0 end,
        atualizado_em = now();
  return null;
end;
$$;

create trigger respostas_contabiliza
  after insert on public.respostas
  for each row execute function public.contabilizar_primeira_resposta();

-- Carga inicial a partir do que já existe.
insert into public.estatisticas_questao (questao_id, respondentes, acertos)
select primeira.questao_id, count(*), count(*) filter (where primeira.acertou)
from (
  select distinct on (r.user_id, r.questao_id)
         r.questao_id, r.acertou
  from public.respostas r
  order by r.user_id, r.questao_id, r.respondido_em
) primeira
group by primeira.questao_id
on conflict (questao_id) do nothing;

-- ---------------------------------------------------------------------------
-- Dificuldade de uma questão
-- ---------------------------------------------------------------------------
create or replace function public.dificuldade_da_questao(p_questao_id uuid)
returns table (respondentes int, taxa_acerto int)
language sql
stable
security definer
set search_path = public
as $$
  -- Piso de 5 pessoas. Abaixo disso não sai nada, e a tela cala.
  select e.respondentes, round(100.0 * e.acertos / e.respondentes)::int
  from public.estatisticas_questao e
  where e.questao_id = p_questao_id and e.respondentes >= 5;
$$;

grant execute on function public.dificuldade_da_questao(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Onde eu caio na distribuição
-- ---------------------------------------------------------------------------
create or replace function public.meu_percentil()
returns table (
  minha_taxa int,
  taxa_mediana int,
  percentil int,
  base int,
  minhas_questoes int
)
language sql
stable
security definer
set search_path = public
as $$
  with primeira as (
    -- Primeira tentativa de cada pessoa em cada questão, para todo mundo.
    select distinct on (r.user_id, r.questao_id)
           r.user_id, r.questao_id, r.acertou
    from public.respostas r
    order by r.user_id, r.questao_id, r.respondido_em
  ),
  por_pessoa as (
    select user_id,
           count(*)::int as questoes,
           100.0 * count(*) filter (where acertou) / count(*) as taxa
    from primeira
    group by user_id
  ),
  -- A coorte exige um mínimo de questões: comparar quem respondeu 800 com
  -- quem respondeu 3 produziria um ranking de quem teve tempo, não de quem
  -- sabe mais.
  coorte as (
    select * from por_pessoa where questoes >= 20
  ),
  eu as (
    select * from por_pessoa where user_id = auth.uid()
  )
  select
    round((select taxa from eu))::int,
    round((select percentile_cont(0.5) within group (order by taxa) from coorte))::int,
    case
      when (select count(*) from coorte) >= 10
       and exists (select 1 from coorte where user_id = auth.uid())
      then round(
             100.0 * (select count(*) from coorte c where c.taxa < (select taxa from eu))
             / (select count(*) from coorte)
           )::int
      else null
    end,
    (select count(*) from coorte)::int,
    (select questoes from eu);
$$;

grant execute on function public.meu_percentil() to authenticated;
