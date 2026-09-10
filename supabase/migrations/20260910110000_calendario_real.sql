-- ============================================================================
-- Calendário real do roadmap.
--
-- A data mora no próprio bloco porque calendário é uma apresentação do
-- roadmap, não outra lista de tarefas. A preferência é uma linha do aluno e
-- o lembrete diário reaproveita o cron e a idempotência já existentes.
-- ============================================================================

alter table public.roadmap_itens
  add column data_planejada date,
  add column horario_planejado time without time zone;

comment on column public.roadmap_itens.data_planejada is
  'Dia em que o bloco do roadmap será executado; nulo enquanto não distribuído.';
comment on column public.roadmap_itens.horario_planejado is
  'Horário local escolhido pelo aluno para iniciar o bloco.';

create index roadmap_itens_calendario_idx
  on public.roadmap_itens (user_id, versao, data_planejada)
  where data_planejada is not null;

create table public.calendario_preferencias (
  user_id uuid primary key references auth.users(id) on delete cascade,
  dias_indisponiveis smallint[] not null default '{}'::smallint[],
  datas_indisponiveis date[] not null default '{}'::date[],
  horario_preferido time without time zone not null default '19:00',
  lembrete_email boolean not null default false,
  atualizado_em timestamptz not null default now(),
  check (dias_indisponiveis <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  check (cardinality(dias_indisponiveis) < 7),
  check (cardinality(datas_indisponiveis) <= 90)
);

comment on table public.calendario_preferencias is
  'Disponibilidade recorrente, exceções e lembrete do calendário de cada aluno.';
comment on column public.calendario_preferencias.dias_indisponiveis is
  'Dias recorrentes sem estudo: 0 domingo, 1 segunda, até 6 sábado.';
comment on column public.calendario_preferencias.datas_indisponiveis is
  'Exceções específicas em que o aluno não pode estudar.';
comment on column public.calendario_preferencias.lembrete_email is
  'Autoriza o aviso matinal quando houver bloco planejado para o dia.';

alter table public.calendario_preferencias enable row level security;

create policy dono on public.calendario_preferencias
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.calendario_preferencias
  to authenticated;

create or replace function public.agendar_blocos_do_roadmap(
  p_versao integer,
  p_agendamentos jsonb
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  alterados integer;
begin
  if auth.uid() is null then
    raise exception 'sessão ausente' using errcode = '28000';
  end if;

  update public.roadmap_itens r
     set data_planejada = a.data_planejada,
         horario_planejado = a.horario_planejado,
         atualizado_em = now()
    from jsonb_to_recordset(coalesce(p_agendamentos, '[]'::jsonb))
      as a(id uuid, data_planejada date, horario_planejado time)
   where r.id = a.id
     and r.user_id = auth.uid()
     and r.versao = p_versao;

  get diagnostics alterados = row_count;
  return alterados;
end;
$$;

comment on function public.agendar_blocos_do_roadmap(integer, jsonb) is
  'Move vários blocos no calendário em uma escrita, sem tocar em conteúdo ou progresso.';

grant execute on function public.agendar_blocos_do_roadmap(integer, jsonb)
  to authenticated;

alter table public.emails_enviados
  drop constraint if exists emails_enviados_tipo_check;

alter table public.emails_enviados
  add constraint emails_enviados_tipo_check
  check (tipo in ('compra', 'revisao', 'plano_acabando', 'calendario'));

create or replace function public.destinatarios_calendario(p_segredo text)
returns table (
  user_id uuid,
  email text,
  nome text,
  blocos int,
  minutos int,
  disciplinas text,
  horario text
)
language plpgsql
security definer
set search_path = public, interno
as $$
declare
  hoje_brasilia date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  perform public.confere_segredo_cron(p_segredo);

  return query
  select
    r.user_id,
    u.email::text,
    coalesce(
      nullif(split_part(coalesce(p.nome, ''), ' ', 1), ''),
      nullif(split_part(coalesce(u.raw_user_meta_data ->> 'nome', ''), ' ', 1), ''),
      split_part(u.email, '@', 1)
    )::text,
    count(*)::int,
    round(sum(r.horas) * 60)::int,
    string_agg(distinct r.disciplina, ', ' order by r.disciplina)::text,
    to_char(min(coalesce(r.horario_planejado, c.horario_preferido)), 'HH24:MI')::text
  from public.roadmap_itens r
    join public.planos_estudo pe
      on pe.user_id = r.user_id and pe.versao_roadmap = r.versao
    join public.calendario_preferencias c on c.user_id = r.user_id
    join auth.users u on u.id = r.user_id
    left join public.perfis p on p.id = r.user_id
  where r.data_planejada = hoje_brasilia
    and r.estado <> 'concluido'
    and c.lembrete_email
    and exists (
      select 1 from public.assinaturas a
       where a.user_id = r.user_id and a.status = 'ativa' and a.fim > now()
    )
    and not exists (
      select 1 from public.emails_enviados e
       where e.user_id = r.user_id and e.tipo = 'calendario'
         and e.referencia = hoje_brasilia::text
    )
  group by r.user_id, u.email, u.raw_user_meta_data, p.nome
  order by min(coalesce(r.horario_planejado, c.horario_preferido));
end;
$$;

grant execute on function public.destinatarios_calendario(text)
  to anon, authenticated;
