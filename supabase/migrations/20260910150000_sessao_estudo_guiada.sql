-- ============================================================================
-- Sessão de estudo guiada.
--
-- O cronômetro sozinho já registra foco. Esta tabela liga a execução ao bloco
-- do roadmap e guarda as evidências que a revisão semanal poderá usar: leitura
-- marcada, respostas efetivamente gravadas, síntese e pendências.
-- ============================================================================

create table public.sessoes_estudo (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  roadmap_item_id uuid references public.roadmap_itens(id) on delete set null,
  disciplina_id uuid references public.disciplinas(id) on delete set null,
  status text not null default 'em_andamento'
    check (status in ('em_andamento', 'concluida')),
  modo_cronometro text not null default 'pomodoro'
    check (modo_cronometro in ('continuo', 'pomodoro')),
  minutos_planejados integer not null check (minutos_planejados between 5 and 360),
  segundos_foco integer not null default 0 check (segundos_foco between 0 and 43200),
  questoes_indicadas uuid[] not null default '{}'::uuid[],
  materiais_indicados text[] not null default '{}'::text[],
  materiais_lidos text[] not null default '{}'::text[],
  checklist jsonb not null default '{}'::jsonb check (jsonb_typeof(checklist) = 'object'),
  anotacao text not null default '' check (char_length(anotacao) <= 4000),
  resumo text not null default '' check (char_length(resumo) <= 4000),
  pendencias text not null default '' check (char_length(pendencias) <= 4000),
  questoes_respondidas integer not null default 0 check (questoes_respondidas >= 0),
  acertos integer not null default 0 check (acertos >= 0),
  iniciado_em timestamptz not null default now(),
  concluido_em timestamptz,
  atualizado_em timestamptz not null default now()
);

comment on table public.sessoes_estudo is
  'Execução guiada de um bloco, com tempo, evidências, síntese e pendências do aluno.';
comment on column public.sessoes_estudo.questoes_indicadas is
  'Fila exibida no início; o fechamento conta somente respostas reais a estas questões.';
comment on column public.sessoes_estudo.materiais_lidos is
  'Identificadores dos materiais indicados que o aluno marcou como trabalhados.';

create unique index sessoes_estudo_uma_aberta_idx
  on public.sessoes_estudo (user_id)
  where status = 'em_andamento';

create index sessoes_estudo_historico_idx
  on public.sessoes_estudo (user_id, iniciado_em desc);

alter table public.sessoes_estudo enable row level security;

create policy dono on public.sessoes_estudo
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update on public.sessoes_estudo to authenticated;

create or replace function public.iniciar_sessao_estudo(
  p_roadmap_item_id uuid,
  p_minutos integer,
  p_modo text,
  p_questoes uuid[] default '{}'::uuid[],
  p_materiais text[] default '{}'::text[]
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_existente public.sessoes_estudo;
  v_item public.roadmap_itens;
  v_sessao_id uuid;
  v_disciplina_id uuid;
begin
  if v_user is null then
    raise exception 'sessão expirada' using errcode = '28000';
  end if;
  if p_minutos not between 5 and 360 or p_modo not in ('continuo', 'pomodoro') then
    raise exception 'configuração inválida' using errcode = '22023';
  end if;

  select * into v_item
  from public.roadmap_itens r
  where r.id = p_roadmap_item_id
    and r.user_id = v_user
    and exists (
      select 1 from public.planos_estudo p
      where p.user_id = v_user and p.versao_roadmap = r.versao
    );

  if not found then
    raise exception 'bloco não encontrado' using errcode = '22023';
  end if;

  select * into v_existente
  from public.sessoes_estudo s
  where s.user_id = v_user and s.status = 'em_andamento';

  if found then
    if v_existente.roadmap_item_id = p_roadmap_item_id then
      return v_existente.id;
    end if;
    raise exception 'já existe uma sessão em andamento' using errcode = '23505';
  end if;

  select d.id into v_disciplina_id
  from public.disciplinas d
  where lower(trim(d.nome)) = lower(trim(v_item.disciplina))
  limit 1;

  insert into public.sessoes_estudo (
    user_id, roadmap_item_id, disciplina_id, modo_cronometro,
    minutos_planejados, questoes_indicadas, materiais_indicados
  ) values (
    v_user,
    v_item.id,
    v_disciplina_id,
    p_modo,
    p_minutos,
    coalesce(p_questoes[1:20], '{}'::uuid[]),
    coalesce(p_materiais[1:20], '{}'::text[])
  ) returning id into v_sessao_id;

  update public.roadmap_itens
     set estado = case when estado = 'a_estudar' then 'em_andamento' else estado end,
         iniciado_em = coalesce(iniciado_em, now()),
         atualizado_em = now()
   where id = v_item.id and user_id = v_user;

  return v_sessao_id;
end;
$$;

grant execute on function public.iniciar_sessao_estudo(uuid, integer, text, uuid[], text[])
  to authenticated;

create or replace function public.salvar_sessao_estudo(
  p_sessao_id uuid,
  p_segundos integer,
  p_modo text,
  p_questoes uuid[],
  p_materiais_lidos text[],
  p_checklist jsonb,
  p_anotacao text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.sessoes_estudo s
     set segundos_foco = greatest(
           s.segundos_foco,
           least(greatest(coalesce(p_segundos, 0), 0), 43200)
         ),
         modo_cronometro = case
           when p_modo in ('continuo', 'pomodoro') then p_modo
           else s.modo_cronometro
         end,
         questoes_indicadas = coalesce(
           array(
             select distinct questao
             from unnest(s.questoes_indicadas || coalesce(p_questoes, '{}'::uuid[])) questao
             limit 20
           ),
           '{}'::uuid[]
         ),
         materiais_lidos = coalesce(
           array(
             select distinct material
             from unnest(coalesce(p_materiais_lidos, '{}'::text[])) material
             where material = any(s.materiais_indicados)
             limit 20
           ),
           '{}'::text[]
         ),
         checklist = case
           when jsonb_typeof(p_checklist) = 'object' then p_checklist
           else s.checklist
         end,
         anotacao = left(coalesce(p_anotacao, ''), 4000),
         atualizado_em = now()
   where s.id = p_sessao_id
     and s.user_id = auth.uid()
     and s.status = 'em_andamento';

  if not found then
    raise exception 'sessão não encontrada' using errcode = '22023';
  end if;
end;
$$;

grant execute on function public.salvar_sessao_estudo(uuid, integer, text, uuid[], text[], jsonb, text)
  to authenticated;

create or replace function public.encerrar_sessao_estudo(
  p_sessao_id uuid,
  p_segundos integer,
  p_modo text,
  p_questoes uuid[],
  p_materiais_lidos text[],
  p_checklist jsonb,
  p_anotacao text,
  p_resumo text,
  p_pendencias text,
  p_concluir_bloco boolean
)
returns table (
  segundos_foco integer,
  questoes_respondidas integer,
  acertos integer,
  materiais_lidos integer,
  bloco_concluido boolean
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_sessao public.sessoes_estudo;
  v_segundos integer;
  v_respondidas integer := 0;
  v_acertos integer := 0;
  v_materiais text[];
  v_questoes uuid[];
begin
  if v_user is null then
    raise exception 'sessão expirada' using errcode = '28000';
  end if;

  select * into v_sessao
  from public.sessoes_estudo s
  where s.id = p_sessao_id and s.user_id = v_user
  for update;

  if not found then
    raise exception 'sessão não encontrada' using errcode = '22023';
  end if;

  if v_sessao.status = 'concluida' then
    return query select
      v_sessao.segundos_foco,
      v_sessao.questoes_respondidas,
      v_sessao.acertos,
      cardinality(v_sessao.materiais_lidos),
      coalesce((select r.estado = 'concluido' from public.roadmap_itens r where r.id = v_sessao.roadmap_item_id), false);
    return;
  end if;

  -- O cliente mede apenas o tempo em que o relógio esteve rodando. O teto de
  -- tempo de parede impede gravar mais foco do que a sessão poderia ter tido.
  v_segundos := greatest(
    v_sessao.segundos_foco,
    least(
      greatest(coalesce(p_segundos, 0), 0),
      least(43200, greatest(0, extract(epoch from (now() - v_sessao.iniciado_em))::integer))
    )
  );

  v_materiais := coalesce(
    array(
      select distinct material
      from unnest(coalesce(p_materiais_lidos, '{}'::text[])) material
      where material = any(v_sessao.materiais_indicados)
      limit 20
    ),
    '{}'::text[]
  );

  v_questoes := coalesce(
    array(
      select distinct questao
      from unnest(v_sessao.questoes_indicadas || coalesce(p_questoes, '{}'::uuid[])) questao
      limit 20
    ),
    '{}'::uuid[]
  );

  -- A contagem não vem do navegador. Ela é reconstruída das respostas reais
  -- gravadas durante a sessão, limitada à fila que a tela mostrou.
  select count(*), count(*) filter (where ultima.acertou)
    into v_respondidas, v_acertos
  from (
    select distinct on (r.questao_id) r.questao_id, r.acertou
    from public.respostas r
    where r.user_id = v_user
      and r.respondido_em >= v_sessao.iniciado_em
      and r.respondido_em <= now()
      and r.questao_id = any(v_questoes)
    order by r.questao_id, r.respondido_em desc
  ) ultima;

  update public.sessoes_estudo s
     set status = 'concluida',
         modo_cronometro = case
           when p_modo in ('continuo', 'pomodoro') then p_modo
           else s.modo_cronometro
         end,
         segundos_foco = v_segundos,
         questoes_indicadas = v_questoes,
         materiais_lidos = v_materiais,
         checklist = case
           when jsonb_typeof(p_checklist) = 'object' then p_checklist
           else s.checklist
         end,
         anotacao = left(coalesce(p_anotacao, ''), 4000),
         resumo = left(coalesce(p_resumo, ''), 4000),
         pendencias = left(coalesce(p_pendencias, ''), 4000),
         questoes_respondidas = v_respondidas,
         acertos = v_acertos,
         concluido_em = now(),
         atualizado_em = now()
   where s.id = v_sessao.id;

  if v_segundos >= 30 then
    insert into public.sessoes_foco (
      user_id, disciplina_id, minutos, iniciado_em, concluido_em
    ) values (
      v_user,
      v_sessao.disciplina_id,
      greatest(1, least(180, round(v_segundos / 60.0)::integer)),
      v_sessao.iniciado_em,
      now()
    );
  end if;

  if v_sessao.roadmap_item_id is not null then
    update public.roadmap_itens r
       set estado = case when coalesce(p_concluir_bloco, false) then 'concluido' else 'em_andamento' end,
           iniciado_em = coalesce(r.iniciado_em, v_sessao.iniciado_em),
           concluido_em = case when coalesce(p_concluir_bloco, false) then now() else null end,
           atualizado_em = now()
     where r.id = v_sessao.roadmap_item_id and r.user_id = v_user;
  end if;

  return query select
    v_segundos,
    v_respondidas,
    v_acertos,
    cardinality(v_materiais),
    coalesce(p_concluir_bloco, false);
end;
$$;

grant execute on function public.encerrar_sessao_estudo(uuid, integer, text, uuid[], text[], jsonb, text, text, text, boolean)
  to authenticated;
