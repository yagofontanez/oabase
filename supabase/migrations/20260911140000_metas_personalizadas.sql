-- ============================================================================
-- Metas verificáveis por bloco do roadmap.
--
-- Leitura, questões, foco e resumo são medidos a partir das sessões guiadas.
-- Revisão de anotações e subtópicos continuam manuais porque o sistema não
-- tem evidência confiável para afirmar que a pessoa os concluiu.
-- ============================================================================

create table public.roadmap_metas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  roadmap_item_id uuid not null references public.roadmap_itens(id) on delete cascade,
  tipo text not null check (
    tipo in ('leitura', 'questoes', 'foco', 'resumo', 'anotacoes', 'subtopicos')
  ),
  titulo text not null check (char_length(btrim(titulo)) between 1 and 120),
  alvo integer not null check (alvo between 1 and 10000),
  progresso_inicial integer not null default 0
    check (progresso_inicial between 0 and 1000000),
  progresso_manual integer not null default 0
    check (progresso_manual between 0 and 10000),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (user_id, id),
  unique (user_id, roadmap_item_id, tipo)
);

comment on table public.roadmap_metas is
  'Resultados verificáveis escolhidos pelo aluno para cada bloco do roadmap.';
comment on column public.roadmap_metas.progresso_inicial is
  'Evidência acumulada preservada quando uma meta acompanha um replanejamento.';
comment on column public.roadmap_metas.progresso_manual is
  'Usado somente quando a atividade não deixa evidência mensurável no sistema.';

create table public.roadmap_meta_subtopicos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  meta_id uuid not null,
  texto text not null check (char_length(btrim(texto)) between 1 and 160),
  ordem integer not null check (ordem between 0 and 29),
  concluido boolean not null default false,
  concluido_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  foreign key (user_id, meta_id)
    references public.roadmap_metas(user_id, id) on delete cascade,
  unique (meta_id, ordem)
);

comment on table public.roadmap_meta_subtopicos is
  'Checklist livre que compõe uma meta de subtópicos do bloco.';

create index roadmap_metas_bloco_idx
  on public.roadmap_metas (user_id, roadmap_item_id, criado_em);
create index roadmap_meta_subtopicos_meta_idx
  on public.roadmap_meta_subtopicos (user_id, meta_id, ordem);

create trigger roadmap_metas_touch
  before update on public.roadmap_metas
  for each row execute function public.touch_atualizado_em();
create trigger roadmap_meta_subtopicos_touch
  before update on public.roadmap_meta_subtopicos
  for each row execute function public.touch_atualizado_em();

alter table public.roadmap_metas enable row level security;
alter table public.roadmap_meta_subtopicos enable row level security;

create policy dono on public.roadmap_metas
  for select using (auth.uid() = user_id);
create policy dono on public.roadmap_meta_subtopicos
  for select using (auth.uid() = user_id);

grant select on public.roadmap_metas to authenticated;
grant select on public.roadmap_meta_subtopicos to authenticated;

create or replace function public.progresso_meta_roadmap(p_meta_id uuid)
returns integer
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_meta public.roadmap_metas;
  v_progresso integer := 0;
begin
  select * into v_meta
  from public.roadmap_metas m
  where m.id = p_meta_id and m.user_id = auth.uid();

  if not found then
    return 0;
  end if;

  if v_meta.tipo = 'leitura' then
    select count(distinct material)::integer into v_progresso
    from public.sessoes_estudo s
    cross join lateral unnest(s.materiais_lidos) material
    where s.user_id = v_meta.user_id
      and s.roadmap_item_id = v_meta.roadmap_item_id;
    v_progresso := v_meta.progresso_inicial + coalesce(v_progresso, 0);
  elsif v_meta.tipo = 'questoes' then
    select coalesce(sum(s.questoes_respondidas), 0)::integer into v_progresso
    from public.sessoes_estudo s
    where s.user_id = v_meta.user_id
      and s.roadmap_item_id = v_meta.roadmap_item_id;
    v_progresso := v_meta.progresso_inicial + v_progresso;
  elsif v_meta.tipo = 'foco' then
    select floor(coalesce(sum(s.segundos_foco), 0) / 60.0)::integer
      into v_progresso
    from public.sessoes_estudo s
    where s.user_id = v_meta.user_id
      and s.roadmap_item_id = v_meta.roadmap_item_id;
    v_progresso := v_meta.progresso_inicial + v_progresso;
  elsif v_meta.tipo = 'resumo' then
    select count(*)::integer into v_progresso
    from public.sessoes_estudo s
    where s.user_id = v_meta.user_id
      and s.roadmap_item_id = v_meta.roadmap_item_id
      and s.status = 'concluida'
      and btrim(s.resumo) <> '';
    v_progresso := v_meta.progresso_inicial + v_progresso;
  elsif v_meta.tipo = 'subtopicos' then
    select count(*) filter (where st.concluido)::integer into v_progresso
    from public.roadmap_meta_subtopicos st
    where st.user_id = v_meta.user_id and st.meta_id = v_meta.id;
  else
    v_progresso := v_meta.progresso_manual;
  end if;

  return coalesce(v_progresso, 0);
end;
$$;

revoke execute on function public.progresso_meta_roadmap(uuid)
  from public, anon;
grant execute on function public.progresso_meta_roadmap(uuid)
  to authenticated;

create or replace function public.metas_do_bloco(p_roadmap_item_id uuid)
returns table (
  id uuid,
  tipo text,
  titulo text,
  alvo integer,
  progresso integer,
  automatico boolean,
  criado_em timestamptz,
  subtopicos jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    m.id,
    m.tipo,
    m.titulo,
    m.alvo,
    public.progresso_meta_roadmap(m.id),
    m.tipo in ('leitura', 'questoes', 'foco', 'resumo'),
    m.criado_em,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', st.id,
            'texto', st.texto,
            'concluido', st.concluido
          ) order by st.ordem
        )
        from public.roadmap_meta_subtopicos st
        where st.user_id = m.user_id and st.meta_id = m.id
      ),
      '[]'::jsonb
    )
  from public.roadmap_metas m
  where m.user_id = auth.uid() and m.roadmap_item_id = p_roadmap_item_id
  order by m.criado_em, m.id;
$$;

revoke execute on function public.metas_do_bloco(uuid) from public, anon;
grant execute on function public.metas_do_bloco(uuid) to authenticated;

create or replace function public.metas_do_roadmap(p_versao integer)
returns table (
  roadmap_item_id uuid,
  id uuid,
  tipo text,
  titulo text,
  alvo integer,
  progresso integer,
  automatico boolean,
  criado_em timestamptz,
  subtopicos jsonb
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    m.roadmap_item_id,
    m.id,
    m.tipo,
    m.titulo,
    m.alvo,
    public.progresso_meta_roadmap(m.id),
    m.tipo in ('leitura', 'questoes', 'foco', 'resumo'),
    m.criado_em,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', st.id,
            'texto', st.texto,
            'concluido', st.concluido
          ) order by st.ordem
        )
        from public.roadmap_meta_subtopicos st
        where st.user_id = m.user_id and st.meta_id = m.id
      ),
      '[]'::jsonb
    )
  from public.roadmap_metas m
  join public.roadmap_itens r
    on r.id = m.roadmap_item_id and r.user_id = m.user_id
  where m.user_id = auth.uid() and r.versao = p_versao
  order by r.semana, r.ordem, m.criado_em, m.id;
$$;

revoke execute on function public.metas_do_roadmap(integer) from public, anon;
grant execute on function public.metas_do_roadmap(integer) to authenticated;

create or replace function public.progresso_metas_roadmap(p_versao integer)
returns table (
  roadmap_item_id uuid,
  metas_total integer,
  metas_concluidas integer,
  percentual integer
)
language sql
stable
security invoker
set search_path = public
as $$
  with progressos as (
    select
      m.roadmap_item_id,
      m.alvo,
      public.progresso_meta_roadmap(m.id) as progresso
    from public.roadmap_metas m
    join public.roadmap_itens r
      on r.id = m.roadmap_item_id and r.user_id = m.user_id
    where m.user_id = auth.uid() and r.versao = p_versao
  )
  select
    p.roadmap_item_id,
    count(*)::integer,
    count(*) filter (where p.progresso >= p.alvo)::integer,
    round(avg(least(100, (p.progresso * 100.0) / p.alvo)))::integer
  from progressos p
  group by p.roadmap_item_id;
$$;

revoke execute on function public.progresso_metas_roadmap(integer)
  from public, anon;
grant execute on function public.progresso_metas_roadmap(integer)
  to authenticated;

create or replace function public.salvar_meta_roadmap(
  p_roadmap_item_id uuid,
  p_meta_id uuid,
  p_tipo text,
  p_titulo text,
  p_alvo integer,
  p_subtopicos text[] default '{}'::text[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_subtopicos text[];
  v_concluidos text[] := '{}'::text[];
begin
  if v_user is null then
    raise exception 'sessão expirada' using errcode = '28000';
  end if;
  if p_tipo not in ('leitura', 'questoes', 'foco', 'resumo', 'anotacoes', 'subtopicos') then
    raise exception 'tipo de meta inválido' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_titulo, ''))) not between 1 and 120 then
    raise exception 'título de meta inválido' using errcode = '22023';
  end if;
  if p_alvo not between 1 and (case when p_tipo = 'foco' then 10000 else 1000 end) then
    raise exception 'alvo de meta inválido' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.roadmap_itens r
    join public.planos_estudo p
      on p.user_id = r.user_id and p.versao_roadmap = r.versao
    where r.id = p_roadmap_item_id and r.user_id = v_user
  ) then
    raise exception 'bloco vigente não encontrado' using errcode = '22023';
  end if;

  select coalesce(array_agg(limpo.texto order by limpo.ordem), '{}'::text[])
    into v_subtopicos
  from (
    select distinct on (lower(btrim(valor)))
      btrim(valor) as texto,
      ordem
    from unnest(coalesce(p_subtopicos, '{}'::text[]))
      with ordinality as entrada(valor, ordem)
    where char_length(btrim(valor)) between 1 and 160
    order by lower(btrim(valor)), ordem
  ) limpo;

  if p_tipo = 'subtopicos' then
    if cardinality(v_subtopicos) not between 1 and 30 then
      raise exception 'informe de 1 a 30 subtópicos' using errcode = '22023';
    end if;
    p_alvo := cardinality(v_subtopicos);
  end if;

  if p_meta_id is null then
    insert into public.roadmap_metas (
      user_id, roadmap_item_id, tipo, titulo, alvo
    ) values (
      v_user, p_roadmap_item_id, p_tipo, btrim(p_titulo), p_alvo
    )
    returning id into v_id;
  else
    select coalesce(array_agg(lower(btrim(st.texto))), '{}'::text[])
      into v_concluidos
    from public.roadmap_meta_subtopicos st
    join public.roadmap_metas m
      on m.id = st.meta_id and m.user_id = st.user_id
    where st.meta_id = p_meta_id
      and st.user_id = v_user
      and st.concluido;

    update public.roadmap_metas m
       set tipo = p_tipo,
           titulo = btrim(p_titulo),
           alvo = p_alvo
     where m.id = p_meta_id
       and m.user_id = v_user
       and m.roadmap_item_id = p_roadmap_item_id
    returning id into v_id;
    if v_id is null then
      raise exception 'meta não encontrada' using errcode = '22023';
    end if;
  end if;

  delete from public.roadmap_meta_subtopicos st
  where st.meta_id = v_id and st.user_id = v_user;

  if p_tipo = 'subtopicos' then
    insert into public.roadmap_meta_subtopicos (
      user_id, meta_id, texto, ordem, concluido, concluido_em
    )
    select
      v_user,
      v_id,
      texto,
      indice - 1,
      lower(btrim(texto)) = any(v_concluidos),
      case when lower(btrim(texto)) = any(v_concluidos) then now() else null end
    from unnest(v_subtopicos) with ordinality as item(texto, indice);
  end if;

  return v_id;
exception
  when unique_violation then
    raise exception 'este bloco já possui uma meta desse tipo'
      using errcode = '23505';
end;
$$;

revoke execute on function public.salvar_meta_roadmap(
  uuid, uuid, text, text, integer, text[]
) from public, anon;
grant execute on function public.salvar_meta_roadmap(
  uuid, uuid, text, text, integer, text[]
) to authenticated;

create or replace function public.atualizar_progresso_manual_meta(
  p_meta_id uuid,
  p_progresso integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_progresso integer;
begin
  update public.roadmap_metas m
     set progresso_manual = least(m.alvo, greatest(0, coalesce(p_progresso, 0)))
   where m.id = p_meta_id
     and m.user_id = v_user
     and m.tipo = 'anotacoes'
     and exists (
       select 1
       from public.roadmap_itens r
       join public.planos_estudo p
         on p.user_id = r.user_id and p.versao_roadmap = r.versao
       where r.id = m.roadmap_item_id and r.user_id = v_user
     )
  returning progresso_manual into v_progresso;
  if v_progresso is null then
    raise exception 'meta manual não encontrada' using errcode = '22023';
  end if;
  return v_progresso;
end;
$$;

revoke execute on function public.atualizar_progresso_manual_meta(uuid, integer)
  from public, anon;
grant execute on function public.atualizar_progresso_manual_meta(uuid, integer)
  to authenticated;

create or replace function public.marcar_subtopico_meta(
  p_subtopico_id uuid,
  p_concluido boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.roadmap_meta_subtopicos st
     set concluido = coalesce(p_concluido, false),
         concluido_em = case when coalesce(p_concluido, false) then now() else null end
    from public.roadmap_metas m
    join public.roadmap_itens r on r.id = m.roadmap_item_id
    join public.planos_estudo p
      on p.user_id = r.user_id and p.versao_roadmap = r.versao
   where st.id = p_subtopico_id
     and st.meta_id = m.id
     and st.user_id = auth.uid()
     and m.user_id = auth.uid();
  if not found then
    raise exception 'subtópico não encontrado' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public.marcar_subtopico_meta(uuid, boolean)
  from public, anon;
grant execute on function public.marcar_subtopico_meta(uuid, boolean)
  to authenticated;

create or replace function public.excluir_meta_roadmap(p_meta_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.roadmap_metas m
   where m.id = p_meta_id
     and m.user_id = auth.uid()
     and exists (
       select 1
       from public.roadmap_itens r
       join public.planos_estudo p
         on p.user_id = r.user_id and p.versao_roadmap = r.versao
       where r.id = m.roadmap_item_id and r.user_id = auth.uid()
     );
  if not found then
    raise exception 'meta não encontrada' using errcode = '22023';
  end if;
end;
$$;

revoke execute on function public.excluir_meta_roadmap(uuid) from public, anon;
grant execute on function public.excluir_meta_roadmap(uuid) to authenticated;

create or replace function public.copiar_metas_roadmap(p_mapeamentos jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_mapa record;
  v_meta public.roadmap_metas;
  v_nova_meta uuid;
  v_total integer := 0;
begin
  if v_user is null then
    raise exception 'sessão expirada' using errcode = '28000';
  end if;
  if jsonb_typeof(coalesce(p_mapeamentos, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_mapeamentos, '[]'::jsonb)) > 200 then
    raise exception 'mapeamento inválido' using errcode = '22023';
  end if;

  for v_mapa in
    select origem_id, destino_id
    from jsonb_to_recordset(coalesce(p_mapeamentos, '[]'::jsonb))
      as mapa(origem_id uuid, destino_id uuid)
  loop
    if not exists (
      select 1
      from public.roadmap_itens origem
      join public.roadmap_itens destino on destino.id = v_mapa.destino_id
      where origem.id = v_mapa.origem_id
        and origem.user_id = v_user
        and destino.user_id = v_user
        and destino.versao = origem.versao + 1
    ) then
      raise exception 'mapeamento de bloco inválido' using errcode = '22023';
    end if;

    for v_meta in
      select * from public.roadmap_metas m
      where m.user_id = v_user and m.roadmap_item_id = v_mapa.origem_id
      order by m.criado_em
    loop
      select m.id into v_nova_meta
      from public.roadmap_metas m
      where m.user_id = v_user
        and m.roadmap_item_id = v_mapa.destino_id
        and m.tipo = v_meta.tipo;

      if v_nova_meta is null then
        insert into public.roadmap_metas (
          user_id, roadmap_item_id, tipo, titulo, alvo,
          progresso_inicial, progresso_manual
        ) values (
          v_user,
          v_mapa.destino_id,
          v_meta.tipo,
          v_meta.titulo,
          v_meta.alvo,
          case
            when v_meta.tipo in ('leitura', 'questoes', 'foco', 'resumo')
              then public.progresso_meta_roadmap(v_meta.id)
            else 0
          end,
          case when v_meta.tipo = 'anotacoes' then v_meta.progresso_manual else 0 end
        ) returning id into v_nova_meta;

        if v_meta.tipo = 'subtopicos' then
          insert into public.roadmap_meta_subtopicos (
            user_id, meta_id, texto, ordem, concluido, concluido_em
          )
          select
            v_user, v_nova_meta, st.texto, st.ordem, st.concluido, st.concluido_em
          from public.roadmap_meta_subtopicos st
          where st.user_id = v_user and st.meta_id = v_meta.id
          order by st.ordem;
        end if;
        v_total := v_total + 1;
      end if;
    end loop;
  end loop;

  return v_total;
end;
$$;

revoke execute on function public.copiar_metas_roadmap(jsonb)
  from public, anon;
grant execute on function public.copiar_metas_roadmap(jsonb)
  to authenticated;
