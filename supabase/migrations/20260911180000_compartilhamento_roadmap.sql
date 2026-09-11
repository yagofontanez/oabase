-- ============================================================================
-- Compartilhamento privado do roadmap.
--
-- O token em texto puro existe somente no instante da criação. O banco guarda
-- seu SHA-256, como uma credencial: nem a tela do dono consegue recuperá-lo
-- depois. Cada link fixa uma versão do roadmap e libera somente as anotações e
-- revisões que a pessoa escolheu explicitamente.
-- ============================================================================

create table public.roadmap_compartilhamentos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique
    check (token_hash ~ '^[0-9a-f]{64}$'),
  titulo text not null default 'Meu roadmap de estudos'
    check (char_length(btrim(titulo)) between 1 and 120),
  versao integer not null check (versao > 0),
  prazo date,
  incluir_progresso boolean not null default true,
  anotacoes_itens uuid[] not null default '{}'::uuid[]
    check (cardinality(anotacoes_itens) <= 30),
  revisoes_ids uuid[] not null default '{}'::uuid[]
    check (cardinality(revisoes_ids) <= 12),
  expira_em timestamptz not null,
  revogado_em timestamptz,
  acessos integer not null default 0 check (acessos >= 0),
  ultimo_acesso_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.roadmap_compartilhamentos is
  'Links privados, revogáveis e somente para leitura de uma versão do roadmap.';
comment on column public.roadmap_compartilhamentos.token_hash is
  'SHA-256 do segredo entregue uma única vez; o token puro nunca é persistido.';
comment on column public.roadmap_compartilhamentos.anotacoes_itens is
  'Lista explícita de blocos cujas anotações podem aparecer no link.';
comment on column public.roadmap_compartilhamentos.revisoes_ids is
  'Lista explícita de fechamentos semanais que podem aparecer no link.';

create index roadmap_compartilhamentos_dono_idx
  on public.roadmap_compartilhamentos (user_id, criado_em desc);
create index roadmap_compartilhamentos_ativos_idx
  on public.roadmap_compartilhamentos (user_id, expira_em)
  where revogado_em is null;

create trigger roadmap_compartilhamentos_touch
  before update on public.roadmap_compartilhamentos
  for each row execute function public.touch_atualizado_em();

alter table public.roadmap_compartilhamentos enable row level security;

create policy dono on public.roadmap_compartilhamentos
  for select using (auth.uid() = user_id);

grant select on public.roadmap_compartilhamentos to authenticated;

create or replace function public.criar_compartilhamento_roadmap(
  p_titulo text,
  p_validade_dias integer,
  p_incluir_progresso boolean,
  p_anotacoes uuid[] default '{}'::uuid[],
  p_revisoes uuid[] default '{}'::uuid[],
  p_prazo date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_versao integer;
  v_token text;
  v_id uuid;
  v_expira timestamptz;
  v_anotacoes uuid[];
  v_revisoes uuid[];
begin
  if v_user is null then
    raise exception 'sessão expirada' using errcode = '28000';
  end if;
  if p_validade_dias not between 1 and 365 then
    raise exception 'validade inválida' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_titulo, ''))) not between 1 and 120 then
    raise exception 'título inválido' using errcode = '22023';
  end if;
  if cardinality(coalesce(p_anotacoes, '{}'::uuid[])) > 30
     or cardinality(coalesce(p_revisoes, '{}'::uuid[])) > 12 then
    raise exception 'seleção grande demais' using errcode = '22023';
  end if;

  select p.versao_roadmap into v_versao
  from public.planos_estudo p
  where p.user_id = v_user and p.versao_roadmap > 0;

  if v_versao is null or not exists (
    select 1 from public.roadmap_itens r
    where r.user_id = v_user and r.versao = v_versao
  ) then
    raise exception 'crie um roadmap antes de compartilhar' using errcode = '22023';
  end if;

  if (
    select count(*) from public.roadmap_compartilhamentos c
    where c.user_id = v_user and c.revogado_em is null and c.expira_em > now()
  ) >= 10 then
    raise exception 'revogue um link ativo antes de criar outro' using errcode = '54000';
  end if;

  select coalesce(array_agg(distinct selecionado), '{}'::uuid[])
    into v_anotacoes
  from unnest(coalesce(p_anotacoes, '{}'::uuid[])) selecionado
  where exists (
    select 1 from public.roadmap_itens r
    where r.id = selecionado
      and r.user_id = v_user
      and r.versao = v_versao
      and btrim(r.anotacao) <> ''
  );

  select coalesce(array_agg(distinct selecionada), '{}'::uuid[])
    into v_revisoes
  from unnest(coalesce(p_revisoes, '{}'::uuid[])) selecionada
  where exists (
    select 1 from public.revisoes_semanais r
    where r.id = selecionada and r.user_id = v_user
  );

  -- Dois UUIDs independentes dão 244 bits aleatórios úteis após retirar os
  -- bits fixos de versão/variante. A URL recebe 64 caracteres hexadecimais.
  v_token := replace(gen_random_uuid()::text, '-', '')
    || replace(gen_random_uuid()::text, '-', '');
  v_expira := now() + make_interval(days => p_validade_dias);

  insert into public.roadmap_compartilhamentos (
    user_id, token_hash, titulo, versao, prazo, incluir_progresso,
    anotacoes_itens, revisoes_ids, expira_em
  ) values (
    v_user,
    encode(extensions.digest(v_token, 'sha256'), 'hex'),
    btrim(p_titulo),
    v_versao,
    p_prazo,
    coalesce(p_incluir_progresso, false),
    v_anotacoes,
    v_revisoes,
    v_expira
  ) returning id into v_id;

  return jsonb_build_object(
    'id', v_id,
    'token', v_token,
    'expiraEm', v_expira
  );
end;
$$;

revoke execute on function public.criar_compartilhamento_roadmap(
  text, integer, boolean, uuid[], uuid[], date
) from public, anon;
grant execute on function public.criar_compartilhamento_roadmap(
  text, integer, boolean, uuid[], uuid[], date
) to authenticated;

create or replace function public.revogar_compartilhamento_roadmap(p_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  update public.roadmap_compartilhamentos
     set revogado_em = coalesce(revogado_em, now())
   where id = p_id and user_id = auth.uid()
  returning true;
$$;

revoke execute on function public.revogar_compartilhamento_roadmap(uuid)
  from public, anon;
grant execute on function public.revogar_compartilhamento_roadmap(uuid)
  to authenticated;

create or replace function public.roadmap_compartilhado(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.roadmap_compartilhamentos%rowtype;
  v_blocos jsonb;
  v_revisoes jsonb;
  v_total integer;
  v_concluidos integer;
  v_em_andamento integer;
  v_horas numeric;
  v_minutos integer;
  v_questoes integer;
  v_materiais integer;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then
    return null;
  end if;

  select * into v_link
  from public.roadmap_compartilhamentos c
  where c.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and c.revogado_em is null
    and c.expira_em > now();

  if not found then
    return null;
  end if;

  select
    count(*)::integer,
    count(*) filter (where r.estado = 'concluido')::integer,
    count(*) filter (where r.estado = 'em_andamento')::integer,
    coalesce(sum(r.horas), 0),
    coalesce(jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'semana', r.semana,
        'ordem', r.ordem,
        'disciplina', r.disciplina,
        'objetivo', r.objetivo,
        'horas', r.horas,
        'estado', r.estado,
        'anotacao', case
          when r.id = any(v_link.anotacoes_itens) then nullif(r.anotacao, '')
          else null
        end,
        'minutosFoco', case when v_link.incluir_progresso then coalesce((
          select floor(sum(s.segundos_foco) / 60.0)::integer
          from public.sessoes_estudo s
          where s.user_id = v_link.user_id and s.roadmap_item_id = r.id
        ), 0) else null end,
        'questoesRespondidas', case when v_link.incluir_progresso then coalesce((
          select sum(s.questoes_respondidas)::integer
          from public.sessoes_estudo s
          where s.user_id = v_link.user_id and s.roadmap_item_id = r.id
        ), 0) else null end,
        'materiaisLidos', case when v_link.incluir_progresso then coalesce((
          select count(distinct material)::integer
          from public.sessoes_estudo s
          cross join lateral unnest(s.materiais_lidos) material
          where s.user_id = v_link.user_id and s.roadmap_item_id = r.id
        ), 0) else null end
      ) order by r.semana, r.ordem
    ), '[]'::jsonb)
  into v_total, v_concluidos, v_em_andamento, v_horas, v_blocos
  from public.roadmap_itens r
  where r.user_id = v_link.user_id and r.versao = v_link.versao;

  if v_link.incluir_progresso then
    select
      floor(coalesce(sum(s.segundos_foco), 0) / 60.0)::integer,
      coalesce(sum(s.questoes_respondidas), 0)::integer,
      coalesce(sum(cardinality(s.materiais_lidos)), 0)::integer
    into v_minutos, v_questoes, v_materiais
    from public.sessoes_estudo s
    join public.roadmap_itens r on r.id = s.roadmap_item_id
    where s.user_id = v_link.user_id and r.versao = v_link.versao;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'inicio', r.inicio,
      'fim', r.fim,
      'metricas', r.metricas,
      'reflexao', r.reflexao,
      'compromisso', r.compromisso,
      'acoes', r.acoes,
      'concluidaEm', r.concluida_em
    ) order by r.inicio desc
  ), '[]'::jsonb)
  into v_revisoes
  from public.revisoes_semanais r
  where r.user_id = v_link.user_id and r.id = any(v_link.revisoes_ids);

  update public.roadmap_compartilhamentos
     set acessos = acessos + 1, ultimo_acesso_em = now()
   where id = v_link.id;

  return jsonb_build_object(
    'titulo', v_link.titulo,
    'versao', v_link.versao,
    'prazo', v_link.prazo,
    'criadoEm', v_link.criado_em,
    'expiraEm', v_link.expira_em,
    'incluirProgresso', v_link.incluir_progresso,
    'resumo', jsonb_build_object(
      'blocos', v_total,
      'concluidos', v_concluidos,
      'emAndamento', v_em_andamento,
      'horasPlanejadas', v_horas,
      'minutosFoco', case when v_link.incluir_progresso then v_minutos else null end,
      'questoesRespondidas', case when v_link.incluir_progresso then v_questoes else null end,
      'materiaisLidos', case when v_link.incluir_progresso then v_materiais else null end
    ),
    'blocos', v_blocos,
    'revisoes', v_revisoes
  );
end;
$$;

comment on function public.roadmap_compartilhado(text) is
  'Entrega pública mínima autorizada por token, sem identidade ou campos não selecionados.';

revoke execute on function public.roadmap_compartilhado(text) from public;
grant execute on function public.roadmap_compartilhado(text) to anon, authenticated;
