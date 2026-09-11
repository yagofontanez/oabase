-- ============================================================================
-- Histórico explicável das versões do roadmap.
--
-- Os blocos de versões antigas já eram preservados. Esta camada registra por
-- que cada versão nasceu e expõe métricas reais de planejamento e execução.
-- ============================================================================

create table public.roadmap_versoes (
  user_id uuid not null references auth.users(id) on delete cascade,
  versao integer not null check (versao > 0),
  origem text not null default 'legado'
    check (origem in ('ia', 'ementa', 'replanejamento', 'manual', 'legado')),
  motivo text not null check (char_length(btrim(motivo)) between 1 and 500),
  diagnostico text not null default '' check (char_length(diagnostico) <= 4000),
  plano_snapshot jsonb,
  contexto_snapshot jsonb,
  versao_anterior integer,
  criado_em timestamptz not null default now(),
  primary key (user_id, versao),
  check (versao_anterior is null or versao_anterior < versao)
);

comment on table public.roadmap_versoes is
  'Linha do tempo do roadmap: motivo, origem e fotografia de cada mudança.';
comment on column public.roadmap_versoes.plano_snapshot is
  'Plano vigente no instante da criação; versões legadas podem não ter fotografia.';

create index roadmap_versoes_usuario_data_idx
  on public.roadmap_versoes (user_id, criado_em desc);

alter table public.roadmap_versoes enable row level security;
create policy dono on public.roadmap_versoes
  for select using (auth.uid() = user_id);
grant select on public.roadmap_versoes to authenticated;

-- O acervo anterior já tem os blocos, mas não tinha um registro explícito do
-- motivo. A versão vigente recebe a fotografia disponível; nas antigas o texto
-- assume honestamente que o detalhe não era registrado naquela época.
insert into public.roadmap_versoes (
  user_id, versao, origem, motivo, diagnostico, plano_snapshot,
  contexto_snapshot, versao_anterior, criado_em
)
select
  r.user_id,
  r.versao,
  'legado',
  case
    when p.versao_roadmap = r.versao
      then 'Roadmap vigente quando o histórico de versões foi ativado.'
    else 'Versão criada antes do registro detalhado de alterações.'
  end,
  case when p.versao_roadmap = r.versao
    then left(coalesce(p.plano ->> 'diagnostico', ''), 4000)
    else ''
  end,
  case when p.versao_roadmap = r.versao then p.plano else null end,
  case when p.versao_roadmap = r.versao then p.contexto else null end,
  (
    select max(anterior.versao)
    from public.roadmap_itens anterior
    where anterior.user_id = r.user_id and anterior.versao < r.versao
  ),
  min(r.criado_em)
from public.roadmap_itens r
left join public.planos_estudo p on p.user_id = r.user_id
group by r.user_id, r.versao, p.versao_roadmap, p.plano, p.contexto
on conflict (user_id, versao) do nothing;

create or replace function public.garantir_historico_roadmap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plano jsonb;
  v_contexto jsonb;
begin
  select p.plano, p.contexto into v_plano, v_contexto
  from public.planos_estudo p
  where p.user_id = new.user_id;

  insert into public.roadmap_versoes (
    user_id, versao, origem, motivo, diagnostico, plano_snapshot,
    contexto_snapshot, versao_anterior, criado_em
  ) values (
    new.user_id,
    new.versao,
    'legado',
    'Versão criada pelo fluxo de planejamento.',
    left(coalesce(v_plano ->> 'diagnostico', ''), 4000),
    v_plano,
    v_contexto,
    (select max(v.versao) from public.roadmap_versoes v
      where v.user_id = new.user_id and v.versao < new.versao),
    new.criado_em
  ) on conflict (user_id, versao) do nothing;

  return new;
end;
$$;

create trigger roadmap_itens_garante_historico
  after insert on public.roadmap_itens
  for each row execute function public.garantir_historico_roadmap();

create or replace function public.registrar_versao_roadmap(
  p_versao integer,
  p_origem text,
  p_motivo text,
  p_diagnostico text,
  p_plano jsonb,
  p_contexto jsonb,
  p_versao_anterior integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'sessão expirada' using errcode = '28000';
  end if;
  if p_versao < 1
     or p_origem not in ('ia', 'ementa', 'replanejamento', 'manual', 'legado')
     or char_length(btrim(coalesce(p_motivo, ''))) not between 1 and 500 then
    raise exception 'dados da versão inválidos' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.roadmap_itens r
    where r.user_id = v_user and r.versao = p_versao
  ) then
    raise exception 'versão sem blocos' using errcode = '22023';
  end if;

  insert into public.roadmap_versoes (
    user_id, versao, origem, motivo, diagnostico, plano_snapshot,
    contexto_snapshot, versao_anterior
  ) values (
    v_user,
    p_versao,
    p_origem,
    btrim(p_motivo),
    left(coalesce(p_diagnostico, ''), 4000),
    p_plano,
    p_contexto,
    p_versao_anterior
  )
  on conflict (user_id, versao) do update set
    origem = excluded.origem,
    motivo = excluded.motivo,
    diagnostico = excluded.diagnostico,
    plano_snapshot = excluded.plano_snapshot,
    contexto_snapshot = excluded.contexto_snapshot,
    versao_anterior = excluded.versao_anterior;
end;
$$;

revoke execute on function public.registrar_versao_roadmap(
  integer, text, text, text, jsonb, jsonb, integer
) from public, anon;
grant execute on function public.registrar_versao_roadmap(
  integer, text, text, text, jsonb, jsonb, integer
) to authenticated;

create or replace function public.historico_do_roadmap()
returns table (
  versao integer,
  origem text,
  motivo text,
  diagnostico text,
  criado_em timestamptz,
  versao_anterior integer,
  vigente boolean,
  blocos integer,
  concluidos integer,
  em_andamento integer,
  horas_planejadas numeric,
  minutos_foco integer,
  questoes_respondidas integer,
  materiais_lidos integer,
  metas integer,
  metas_concluidas integer
)
language sql
stable
security invoker
set search_path = public
as $$
  with blocos as (
    select
      r.user_id,
      r.versao,
      count(*)::integer as total,
      count(*) filter (where r.estado = 'concluido')::integer as concluidos,
      count(*) filter (where r.estado = 'em_andamento')::integer as em_andamento,
      coalesce(sum(r.horas), 0)::numeric as horas
    from public.roadmap_itens r
    where r.user_id = auth.uid()
    group by r.user_id, r.versao
  ),
  execucao as (
    select
      r.versao,
      floor(coalesce(sum(s.segundos_foco), 0) / 60.0)::integer as minutos,
      coalesce(sum(s.questoes_respondidas), 0)::integer as questoes,
      coalesce(sum(cardinality(s.materiais_lidos)), 0)::integer as materiais
    from public.roadmap_itens r
    left join public.sessoes_estudo s
      on s.roadmap_item_id = r.id and s.user_id = r.user_id
    where r.user_id = auth.uid()
    group by r.versao
  ),
  metas as (
    select
      r.versao,
      count(*)::integer as total,
      count(*) filter (
        where public.progresso_meta_roadmap(m.id) >= m.alvo
      )::integer as concluidas
    from public.roadmap_itens r
    join public.roadmap_metas m
      on m.roadmap_item_id = r.id and m.user_id = r.user_id
    where r.user_id = auth.uid()
    group by r.versao
  )
  select
    v.versao,
    v.origem,
    v.motivo,
    v.diagnostico,
    v.criado_em,
    v.versao_anterior,
    p.versao_roadmap = v.versao,
    coalesce(b.total, 0),
    coalesce(b.concluidos, 0),
    coalesce(b.em_andamento, 0),
    coalesce(b.horas, 0),
    coalesce(e.minutos, 0),
    coalesce(e.questoes, 0),
    coalesce(e.materiais, 0),
    coalesce(m.total, 0),
    coalesce(m.concluidas, 0)
  from public.roadmap_versoes v
  left join public.planos_estudo p on p.user_id = v.user_id
  left join blocos b on b.user_id = v.user_id and b.versao = v.versao
  left join execucao e on e.versao = v.versao
  left join metas m on m.versao = v.versao
  where v.user_id = auth.uid()
  order by v.versao desc;
$$;

revoke execute on function public.historico_do_roadmap() from public, anon;
grant execute on function public.historico_do_roadmap() to authenticated;
