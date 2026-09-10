-- ============================================================================
-- Revisão semanal assistida.
--
-- A leitura da semana é calculada no banco a partir de fatos: roadmap,
-- sessões de foco, respostas e revisões. Quando a pessoa fecha a semana, a
-- fotografia dessas métricas é preservada junto à reflexão e às ações que ela
-- escolheu para a próxima.
-- ============================================================================

create table public.revisoes_semanais (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  inicio date not null,
  fim date not null,
  metricas jsonb not null check (jsonb_typeof(metricas) = 'object'),
  reflexao text not null default '' check (char_length(reflexao) <= 4000),
  compromisso text not null default '' check (char_length(compromisso) <= 1000),
  acoes text[] not null default '{}'::text[],
  concluida_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (user_id, inicio),
  check (extract(isodow from inicio) = 1),
  check (fim = inicio + 6),
  check (cardinality(acoes) <= 8),
  check (acoes <@ array[
    'reagendar_pendencias',
    'reduzir_carga',
    'priorizar_revisoes',
    'praticar_questoes',
    'retomar_materia',
    'manter_ritmo'
  ]::text[])
);

comment on table public.revisoes_semanais is
  'Fotografia verificável da semana e compromisso escrito pelo aluno para a próxima.';
comment on column public.revisoes_semanais.metricas is
  'Snapshot produzido por minha_revisao_semanal; nunca recebe números calculados pelo navegador.';

alter table public.revisoes_semanais enable row level security;

create policy dono on public.revisoes_semanais
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update on public.revisoes_semanais to authenticated;

create index revisoes_semanais_historico_idx
  on public.revisoes_semanais (user_id, inicio desc);

create or replace function public.minha_revisao_semanal(p_inicio date)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_fim date := p_inicio + 6;
  v_versao integer;
  v_inicio_roadmap date;
  v_resultado jsonb;
begin
  if v_user is null then
    raise exception 'sessão expirada' using errcode = '28000';
  end if;
  if p_inicio is null or extract(isodow from p_inicio) <> 1 then
    raise exception 'a semana precisa começar na segunda-feira' using errcode = '22023';
  end if;

  select p.versao_roadmap into v_versao
  from public.planos_estudo p
  where p.user_id = v_user;

  select date_trunc(
           'week',
           min(r.criado_em) at time zone 'America/Sao_Paulo'
         )::date
    into v_inicio_roadmap
  from public.roadmap_itens r
  where r.user_id = v_user and r.versao = v_versao;

  v_inicio_roadmap := coalesce(v_inicio_roadmap, p_inicio);

  with itens as (
    select
      r.id,
      r.disciplina,
      r.horas,
      r.estado,
      r.iniciado_em,
      r.concluido_em,
      coalesce(
        r.data_planejada,
        v_inicio_roadmap + ((greatest(1, r.semana) - 1) * 7)
      ) as planejado_em
    from public.roadmap_itens r
    where r.user_id = v_user and r.versao = v_versao
  ),
  planejados as (
    select * from itens
    where planejado_em between p_inicio and v_fim
  ),
  focos as (
    select sf.minutos, d.nome as disciplina
    from public.sessoes_foco sf
    left join public.disciplinas d on d.id = sf.disciplina_id
    where sf.user_id = v_user
      and (sf.concluido_em at time zone 'America/Sao_Paulo')::date
          between p_inicio and v_fim
  ),
  respostas_da_semana as (
    select distinct on (r.questao_id) r.questao_id, r.acertou
    from public.respostas r
    where r.user_id = v_user
      and (r.respondido_em at time zone 'America/Sao_Paulo')::date
          between p_inicio and v_fim
    order by r.questao_id, r.respondido_em desc
  ),
  guiadas as (
    select
      s.id,
      s.segundos_foco,
      s.materiais_lidos,
      s.resumo,
      s.pendencias,
      s.concluido_em,
      coalesce(d.nome, r.disciplina, 'Estudo livre') as disciplina
    from public.sessoes_estudo s
    left join public.disciplinas d on d.id = s.disciplina_id
    left join public.roadmap_itens r on r.id = s.roadmap_item_id
    where s.user_id = v_user
      and s.status = 'concluida'
      and (s.concluido_em at time zone 'America/Sao_Paulo')::date
          between p_inicio and v_fim
  ),
  nomes_disciplinas as (
    select disciplina as nome from planejados
    union
    select disciplina from focos where disciplina is not null
  ),
  disciplinas_metricas as (
    select
      n.nome,
      coalesce((select sum(p.horas) from planejados p where p.disciplina = n.nome), 0) as horas_planejadas,
      coalesce((select sum(f.minutos) from focos f where f.disciplina = n.nome), 0) as minutos_foco,
      (select count(*) from planejados p
        where p.disciplina = n.nome
          and p.concluido_em is not null
          and (p.concluido_em at time zone 'America/Sao_Paulo')::date <= v_fim) as concluidos,
      (select count(*) from planejados p
        where p.disciplina = n.nome
          and (
            p.concluido_em is null
            or (p.concluido_em at time zone 'America/Sao_Paulo')::date > v_fim
          )) as pendentes
    from nomes_disciplinas n
  )
  select jsonb_build_object(
    'inicio', p_inicio,
    'fim', v_fim,
    'planejado', jsonb_build_object(
      'horas', coalesce((select sum(horas) from planejados), 0),
      'blocos', (select count(*) from planejados)
    ),
    'executado', jsonb_build_object(
      'minutos', coalesce((select sum(minutos) from focos), 0),
      'sessoes', (select count(*) from focos)
    ),
    'roadmap', jsonb_build_object(
      'concluidos', (select count(*) from planejados
        where concluido_em is not null
          and (concluido_em at time zone 'America/Sao_Paulo')::date <= v_fim),
      'pendentes', (select count(*) from planejados
        where concluido_em is null
          or (concluido_em at time zone 'America/Sao_Paulo')::date > v_fim),
      'emAndamento', (select count(*) from planejados
        where iniciado_em is not null
          and (iniciado_em at time zone 'America/Sao_Paulo')::date <= v_fim
          and (
            concluido_em is null
            or (concluido_em at time zone 'America/Sao_Paulo')::date > v_fim
          ))
    ),
    'questoes', jsonb_build_object(
      'respondidas', (select count(*) from respostas_da_semana),
      'acertos', (select count(*) from respostas_da_semana where acertou),
      'taxa', case
        when (select count(*) from respostas_da_semana) < 5 then null
        else round(
          100.0 * (select count(*) from respostas_da_semana where acertou)
          / (select count(*) from respostas_da_semana)
        )::integer
      end
    ),
    'revisoesVencidas', (select count(*) from public.revisoes rv
      where rv.user_id = v_user and rv.proxima_em <= least(v_fim, current_date)),
    'materiaisLidos', coalesce((select sum(cardinality(materiais_lidos)) from guiadas), 0),
    'disciplinas', coalesce(
      (select jsonb_agg(jsonb_build_object(
        'nome', nome,
        'horasPlanejadas', horas_planejadas,
        'minutosFoco', minutos_foco,
        'concluidos', concluidos,
        'pendentes', pendentes
      ) order by horas_planejadas desc, nome) from disciplinas_metricas),
      '[]'::jsonb
    ),
    'registros', coalesce(
      (select jsonb_agg(jsonb_build_object(
        'id', g.id,
        'disciplina', g.disciplina,
        'minutos', round(g.segundos_foco / 60.0)::integer,
        'resumo', g.resumo,
        'pendencias', g.pendencias,
        'concluidoEm', g.concluido_em
      ) order by g.concluido_em desc)
      from (select * from guiadas order by concluido_em desc limit 12) g),
      '[]'::jsonb
    )
  ) into v_resultado;

  return v_resultado;
end;
$$;

comment on function public.minha_revisao_semanal(date) is
  'Fecha uma semana com métricas derivadas de roadmap, foco, respostas e sessões guiadas.';

grant execute on function public.minha_revisao_semanal(date) to authenticated;

create or replace function public.concluir_revisao_semanal(
  p_inicio date,
  p_reflexao text,
  p_compromisso text,
  p_acoes text[]
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_acoes text[];
begin
  if v_user is null then
    raise exception 'sessão expirada' using errcode = '28000';
  end if;
  if p_inicio is null or extract(isodow from p_inicio) <> 1 then
    raise exception 'semana inválida' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct acao), '{}'::text[])
    into v_acoes
  from unnest(coalesce(p_acoes, '{}'::text[])) acao
  where acao = any(array[
    'reagendar_pendencias',
    'reduzir_carga',
    'priorizar_revisoes',
    'praticar_questoes',
    'retomar_materia',
    'manter_ritmo'
  ]::text[]);

  insert into public.revisoes_semanais (
    user_id, inicio, fim, metricas, reflexao, compromisso, acoes
  ) values (
    v_user,
    p_inicio,
    p_inicio + 6,
    public.minha_revisao_semanal(p_inicio),
    left(coalesce(p_reflexao, ''), 4000),
    left(coalesce(p_compromisso, ''), 1000),
    v_acoes
  )
  on conflict (user_id, inicio) do update
    set metricas = excluded.metricas,
        reflexao = excluded.reflexao,
        compromisso = excluded.compromisso,
        acoes = excluded.acoes,
        concluida_em = now(),
        atualizado_em = now()
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.concluir_revisao_semanal(date, text, text, text[])
  to authenticated;
