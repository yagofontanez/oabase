-- ============================================================================
-- Amostra gratuita: um exame inteiro aberto a qualquer conta logada.
--
-- Quem chegava pelo TikTok precisava pagar antes de ver uma questão resolvida.
-- A amostra é o produto de verdade — gabarito, comentário, revisão espaçada e
-- caderno de erros — sobre um pedaço dele: as 80 questões de um exame.
--
-- Um exame, e não "N questões por dia": a regra cabe numa expressão de RLS e
-- se audita lendo uma linha. Cota diária pediria contar respostas dentro da
-- política, a cada leitura.
--
-- O que muda na fronteira:
--   * visitante sem login continua vendo zero questões (auth.uid() nulo);
--   * conta sem plano vê as questões do exame marcado, e só elas;
--   * o gabarito continua não saindo antes da resposta (fila_de_questoes
--     não o devolve; quem corrige é registrar_resposta);
--   * simulado continua sendo do plano — criar_simulado agora checa.
-- ============================================================================

alter table public.exames
  add column if not exists amostra_gratuita boolean not null default false;

-- No máximo um exame aberto por vez: dois seria uma decisão de produto
-- tomada por engano num UPDATE sem WHERE.
create unique index if not exists exames_uma_amostra
  on public.exames (amostra_gratuita) where amostra_gratuita;

comment on column public.exames.amostra_gratuita is
  'Exame aberto a qualquer conta logada, sem plano. No máximo um. Troca-se por SQL.';

-- O exame da amostra. Leitura de `exames`, que já é aberta.
create or replace function public.exame_amostra()
returns uuid
language sql
stable
set search_path = public
as $$
  select id from public.exames where amostra_gratuita limit 1;
$$;

-- A regra inteira num lugar só, para as funções security definer (que não
-- passam pela RLS). As políticas abaixo dizem a mesma coisa em SQL direto,
-- com os `(select ...)` que o Postgres avalia uma vez por consulta, não por
-- linha.
create or replace function public.pode_ver_questao(p_questao_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.tem_assinatura_ativa()
      or (auth.uid() is not null and exists (
            select 1 from public.questoes q
            where q.id = p_questao_id and q.exame_id = public.exame_amostra()));
$$;

revoke all on function public.pode_ver_questao(uuid) from public, anon;
grant execute on function public.pode_ver_questao(uuid) to authenticated;

drop policy if exists leitura_assinante on public.questoes;
create policy leitura_assinante on public.questoes
  for select using (
    (select public.tem_assinatura_ativa())
    or ((select auth.uid()) is not null and exame_id = (select public.exame_amostra()))
  );

drop policy if exists leitura_assinante on public.comentarios;
create policy leitura_assinante on public.comentarios
  for select using (
    (select public.tem_assinatura_ativa())
    or ((select auth.uid()) is not null and questao_id in (
          select q.id from public.questoes q
          where q.exame_id = (select public.exame_amostra())))
  );

CREATE OR REPLACE FUNCTION public.registrar_resposta(p_questao_id uuid, p_alternativa character, p_tempo_ms integer DEFAULT NULL::integer)
 RETURNS TABLE(acertou boolean, gabarito character, comentario text[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user uuid := auth.uid();
  v_gabarito char(1);
  v_acertou boolean;
  v_intervalo int;
  v_facilidade numeric(3,2);
begin
  if v_user is null then
    raise exception 'sessão expirada' using errcode = '28000';
  end if;
  -- A checagem de acesso é repetida aqui porque `security definer` ignora a
  -- RLS de `questoes`: sem isto, a função seria a porta dos fundos do produto
  -- pago. É a mesma regra da RLS — plano ativo, ou a questão é da amostra.
  if not public.pode_ver_questao(p_questao_id) then
    raise exception 'sem assinatura ativa' using errcode = '42501';
  end if;
  if p_alternativa not in ('A', 'B', 'C', 'D') then
    raise exception 'alternativa inválida' using errcode = '22023';
  end if;

  select q.gabarito into v_gabarito
  from public.questoes q
  where q.id = p_questao_id and not q.anulada;

  if v_gabarito is null then
    raise exception 'questão sem gabarito' using errcode = '22023';
  end if;

  v_acertou := (p_alternativa = v_gabarito);

  insert into public.respostas (user_id, questao_id, alternativa, acertou, tempo_ms)
  values (v_user, p_questao_id, p_alternativa, v_acertou, p_tempo_ms);

  -- Repetição espaçada, na forma enxuta do SM-2. Acerto multiplica o
  -- intervalo pela facilidade; erro joga a questão para amanhã e derruba a
  -- facilidade — errar de novo tem de doer no calendário, não só no número.
  select r.intervalo_dias, r.facilidade into v_intervalo, v_facilidade
  from public.revisoes r
  where r.user_id = v_user and r.questao_id = p_questao_id;

  if not found then
    v_intervalo := 0;
    v_facilidade := 2.50;
  end if;

  if v_acertou then
    v_facilidade := least(2.80, v_facilidade + 0.10);
    v_intervalo := case
      when v_intervalo <= 0 then 1
      when v_intervalo = 1 then 3
      else greatest(1, round(v_intervalo * v_facilidade)::int)
    end;
  else
    v_facilidade := greatest(1.30, v_facilidade - 0.20);
    v_intervalo := 1;
  end if;

  insert into public.revisoes (user_id, questao_id, proxima_em, intervalo_dias, facilidade)
  values (v_user, p_questao_id, current_date + v_intervalo, v_intervalo, v_facilidade)
  on conflict (user_id, questao_id) do update
    set proxima_em     = excluded.proxima_em,
        intervalo_dias = excluded.intervalo_dias,
        facilidade     = excluded.facilidade;

  return query
    select
      v_acertou,
      v_gabarito,
      coalesce(
        (select c.corpo
         from public.comentarios c
         where c.questao_id = p_questao_id and c.status = 'publicado'),
        '{}'::text[]
      );
end;
$function$;

CREATE OR REPLACE FUNCTION public.registrar_resposta_mcp(p_questao_id uuid, p_alternativa character, p_tempo_ms integer, p_idempotency_key uuid)
 RETURNS TABLE(acertou boolean, gabarito character, comentario text[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  if not public.pode_ver_questao(p_questao_id) then
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
$function$;

CREATE OR REPLACE FUNCTION public.criar_simulado(p_exame text DEFAULT NULL::text, p_total integer DEFAULT 80, p_minutos integer DEFAULT 300)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_user uuid := auth.uid();
  v_exame_id uuid;
  v_id uuid;
  v_inseridas int;
begin
  if v_user is null then
    raise exception 'sessão expirada' using errcode = '28000';
  end if;

  -- Simulado é do plano, amostra ou não. A função é security invoker e
  -- confiava na RLS para devolver zero questões a quem não assina — e desde
  -- que o exame da amostra ficou visível, a RLS deixaria montar um simulado
  -- dele. A regra passa a ser dita, não deduzida.
  if not public.tem_assinatura_ativa() then
    raise exception 'sem assinatura ativa' using errcode = '42501';
  end if;

  if p_exame is not null then
    select id into v_exame_id from public.exames where slug = p_exame;
    if v_exame_id is null then
      raise exception 'exame inexistente' using errcode = '22023';
    end if;
  end if;

  -- Um simulado em aberto de cada vez. Dois relógios correndo ao mesmo tempo
  -- não é uma funcionalidade, é uma forma de perder os dois.
  if exists (
    select 1 from public.simulados
     where user_id = v_user and finalizado_em is null and finaliza_em > now()
  ) then
    raise exception 'já existe um simulado em andamento' using errcode = '55006';
  end if;

  insert into public.simulados (user_id, exame_id, minutos, total, finaliza_em)
  values (v_user, v_exame_id, p_minutos,
          least(greatest(p_total, 1), 80),
          now() + (p_minutos || ' minutes')::interval)
  returning id into v_id;

  insert into public.simulado_questoes (simulado_id, ordem, questao_id)
  select v_id, row_number() over (order by sel.chave), sel.id
  from (
    select q.id,
           -- Prova de uma edição sai na ordem original; mistura sai
           -- embaralhada, para o simulado não virar decoreba de sequência.
           case when v_exame_id is not null then q.numero::numeric
                else random() end as chave
    from public.questoes q
    where not q.anulada
      and q.gabarito is not null
      and (v_exame_id is null or q.exame_id = v_exame_id)
    order by chave
    limit least(greatest(p_total, 1), 80)
  ) sel;

  get diagnostics v_inseridas = row_count;
  if v_inseridas = 0 then
    -- Sem assinatura a RLS devolve zero questões. Deixar o simulado nascer
    -- vazio seria criar um relógio correndo sobre nada.
    delete from public.simulados where id = v_id;
    raise exception 'sem questões disponíveis' using errcode = '42501';
  end if;

  update public.simulados set total = v_inseridas where id = v_id;
  return v_id;
end;
$function$;

-- A amostra: o 46º Exame, o mais recente com gabarito definitivo. Em banco
-- novo, sem exames carregados, não marca nada — a fronteira volta a ser a de
-- antes, fechada.
update public.exames set amostra_gratuita = true where edicao = 46;
