-- ============================================================================
-- Garantias do MCP que precisam sobreviver a processos e retries.
--
-- A busca de súmulas filtra antes do LIMIT. A resposta idempotente guarda o
-- resultado por usuário e chave: repetir uma chamada de ferramenta não cria
-- outra tentativa nem recalcula o calendário de revisão.
-- ============================================================================

create or replace function public.buscar_sumulas(
  termo text,
  limite int default 12
)
returns table (
  tipo text,
  id uuid,
  rotulo text,
  resumo text,
  href text,
  comentado boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  with entrada as (
    select
      btrim(coalesce(termo, '')) as bruto,
      upper(
        regexp_replace(
          regexp_replace(
            btrim(coalesce(termo, '')),
            '^\s*(súmulas?|sumulas?)\s*(vinculantes?)?\s*', '', 'i'
          ),
          '[º°.]', '', 'g'
        )
      ) as numero_possivel
  ),
  consulta as (
    select
      e.numero_possivel,
      e.numero_possivel ~ '^[0-9]+$' as parece_numero,
      websearch_to_tsquery('portuguese', public.sem_acento(e.bruto)) as tsq
    from entrada e
    where length(e.bruto) >= 2 or e.bruto ~ '^[0-9]$'
  ),
  achadas as (
    select
      'sumula'::text as tipo,
      s.id,
      case when s.vinculante
        then 'Súmula Vinculante ' || s.numero
        else 'Súmula ' || s.numero || ' do ' || upper(s.tribunal)
      end as rotulo,
      s.texto,
      '/sumulas/' || s.slug as href,
      cardinality(s.comentario) > 0 as comentado,
      case
        when c.parece_numero and s.numero::text = c.numero_possivel then 3.0
        else ts_rank(
          to_tsvector('portuguese', public.sem_acento(s.texto)),
          c.tsq
        )
      end::real as peso
    from consulta c
    join public.sumulas s
      on (c.parece_numero and s.numero::text = c.numero_possivel)
      or to_tsvector('portuguese', public.sem_acento(s.texto)) @@ c.tsq
  )
  select
    a.tipo,
    a.id,
    a.rotulo,
    case when length(a.texto) > 200
      then left(a.texto, 200) || '…'
      else a.texto
    end,
    a.href,
    a.comentado
  from achadas a
  order by a.peso desc, a.rotulo
  limit greatest(1, least(coalesce(limite, 12), 50));
$$;

comment on function public.buscar_sumulas(text, int) is
  'Busca exclusivamente súmulas e aplica o limite depois do filtro por tipo.';

grant execute on function public.buscar_sumulas(text, int)
  to anon, authenticated;

create table public.mcp_idempotencia (
  user_id uuid not null references auth.users(id) on delete cascade,
  operacao text not null check (operacao in ('registrar_resposta')),
  chave uuid not null,
  entrada jsonb not null check (jsonb_typeof(entrada) = 'object'),
  resposta jsonb not null check (jsonb_typeof(resposta) = 'object'),
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '30 days',
  primary key (user_id, operacao, chave)
);

comment on table public.mcp_idempotencia is
  'Resultados de mutações MCP para que retry de transporte não repita efeitos.';

create index mcp_idempotencia_expiracao_idx
  on public.mcp_idempotencia (expira_em);

alter table public.mcp_idempotencia enable row level security;

create policy dono on public.mcp_idempotencia
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Só o invólucro abaixo manipula o cache. Impedir escrita direta evita que o
-- cliente fabrique uma resposta idempotente sem passar por registrar_resposta.
revoke all on table public.mcp_idempotencia from public, anon, authenticated;

create or replace function public.registrar_resposta_mcp(
  p_questao_id uuid,
  p_alternativa char(1),
  p_tempo_ms int,
  p_idempotency_key uuid
)
returns table (acertou boolean, gabarito char(1), comentario text[])
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_entrada jsonb;
  v_guardada public.mcp_idempotencia;
  v_acertou boolean;
  v_gabarito char(1);
  v_comentario text[];
begin
  if v_user is null then
    raise exception 'sessão expirada' using errcode = '28000';
  end if;
  if not public.tem_assinatura_ativa() then
    raise exception 'assinatura inativa' using errcode = '42501';
  end if;
  if p_idempotency_key is null then
    raise exception 'chave de idempotência ausente' using errcode = '22023';
  end if;

  v_entrada := jsonb_build_object(
    'questao_id', p_questao_id,
    'alternativa', p_alternativa,
    'tempo_ms', p_tempo_ms
  );

  -- Serializa duas chamadas simultâneas com a mesma chave sem bloquear outros
  -- usuários ou outras respostas.
  perform pg_advisory_xact_lock(
    hashtextextended(v_user::text || ':' || p_idempotency_key::text, 0)
  );

  delete from public.mcp_idempotencia
  where user_id = v_user and expira_em < now();

  select * into v_guardada
  from public.mcp_idempotencia i
  where i.user_id = v_user
    and i.operacao = 'registrar_resposta'
    and i.chave = p_idempotency_key;

  if found then
    if v_guardada.entrada <> v_entrada then
      raise exception 'chave reutilizada com outra entrada' using errcode = '22023';
    end if;
    return query select
      (v_guardada.resposta ->> 'acertou')::boolean,
      (v_guardada.resposta ->> 'gabarito')::char(1),
      coalesce(
        array(
          select jsonb_array_elements_text(
            coalesce(v_guardada.resposta -> 'comentario', '[]'::jsonb)
          )
        ),
        '{}'::text[]
      );
    return;
  end if;

  select r.acertou, r.gabarito, r.comentario
    into v_acertou, v_gabarito, v_comentario
  from public.registrar_resposta(
    p_questao_id,
    p_alternativa,
    p_tempo_ms
  ) r;

  insert into public.mcp_idempotencia (
    user_id, operacao, chave, entrada, resposta
  ) values (
    v_user,
    'registrar_resposta',
    p_idempotency_key,
    v_entrada,
    jsonb_build_object(
      'acertou', v_acertou,
      'gabarito', v_gabarito,
      'comentario', to_jsonb(coalesce(v_comentario, '{}'::text[]))
    )
  );

  return query select v_acertou, v_gabarito, v_comentario;
end;
$$;

comment on function public.registrar_resposta_mcp(uuid, char, int, uuid) is
  'Invólucro idempotente de registrar_resposta para retries de clientes MCP.';

revoke execute on function public.registrar_resposta_mcp(uuid, char, int, uuid)
  from public, anon;
grant execute on function public.registrar_resposta_mcp(uuid, char, int, uuid)
  to authenticated;
