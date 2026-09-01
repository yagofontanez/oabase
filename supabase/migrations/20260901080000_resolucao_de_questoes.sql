-- ============================================================================
-- Resolução de questões.
--
-- Três funções, e a divisão entre elas não é arbitrária:
--
-- `fila_de_questoes` é SECURITY INVOKER — a RLS de `questoes` continua sendo
-- quem decide se há acesso, e sem assinatura ativa a fila volta vazia. O
-- gabarito **não está** entre as colunas devolvidas: ele nunca sai do banco
-- rumo ao navegador, senão bastaria abrir o inspetor para "acertar" tudo.
--
-- `registrar_resposta` é SECURITY DEFINER pelo motivo oposto: quem decide se
-- a pessoa acertou é o banco, comparando com o gabarito. Se `acertou` viesse
-- do cliente, a taxa de acerto do painel seria ficção — e ela é o número que
-- diz se dá para passar na prova.
--
-- `meu_desempenho` existe porque a pergunta certa é por *questão*, não por
-- tentativa: quem errou uma questão três vezes e acertou na quarta tem uma
-- questão dominada, não três erros. `distinct on` resolve isso no banco; o
-- PostgREST não tem como expressar essa consulta.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A fila
-- ---------------------------------------------------------------------------
create or replace function public.fila_de_questoes(
  p_modo text default 'novas',
  p_exame text default null,
  p_disciplina text default null,
  p_limite int default 30
)
returns table (
  id uuid,
  numero int,
  slug text,
  enunciado text,
  alternativas jsonb,
  exame_edicao int,
  exame_slug text,
  exame_data date,
  disciplina_nome text,
  ja_respondida boolean,
  errou_antes boolean,
  revisao_em date
)
language sql
stable
security invoker
set search_path = public
as $$
  with ultima as (
    -- A última tentativa de cada questão. É ela que define se a questão está
    -- no caderno de erros; as anteriores são histórico.
    select distinct on (r.questao_id) r.questao_id, r.acertou
    from public.respostas r
    where r.user_id = auth.uid()
    order by r.questao_id, r.respondido_em desc
  )
  select
    q.id,
    q.numero,
    q.slug,
    q.enunciado,
    q.alternativas,
    e.edicao,
    e.slug,
    e.data_prova,
    d.nome,
    u.questao_id is not null,
    coalesce(u.acertou = false, false),
    v.proxima_em
  from public.questoes q
    join public.exames e on e.id = q.exame_id
    left join public.disciplinas d on d.id = q.disciplina_id
    left join ultima u on u.questao_id = q.id
    left join public.revisoes v
      on v.questao_id = q.id and v.user_id = auth.uid()
  where
    -- Anulada não entra na fila: ela não tem resposta certa para treinar.
    -- Continua no acervo como material de estudo, e é assim que /desempenho
    -- a apresenta.
    not q.anulada
    and q.gabarito is not null
    and (p_exame is null or e.slug = p_exame)
    and (p_disciplina is null or d.slug = p_disciplina)
    and case p_modo
          when 'erros'   then coalesce(u.acertou = false, false)
          when 'revisao' then v.proxima_em is not null and v.proxima_em <= current_date
          when 'novas'   then u.questao_id is null
          else true
        end
  order by
    -- Revisão vence primeiro pela data; o resto vem do exame mais recente
    -- para trás, porque o que caiu ano passado prediz melhor a próxima prova.
    case when p_modo = 'revisao' then v.proxima_em end asc nulls last,
    e.data_prova desc,
    q.numero asc
  limit greatest(1, least(p_limite, 80));
$$;

grant execute on function public.fila_de_questoes(text, text, text, int)
  to authenticated;

-- ---------------------------------------------------------------------------
-- O registro da resposta
-- ---------------------------------------------------------------------------
create or replace function public.registrar_resposta(
  p_questao_id uuid,
  p_alternativa char(1),
  p_tempo_ms int default null
)
returns table (acertou boolean, gabarito char(1), comentario text[])
language plpgsql
security definer
set search_path = public
as $$
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
  -- A checagem de assinatura é repetida aqui porque `security definer`
  -- ignora a RLS de `questoes`: sem isto, a função seria a porta dos fundos
  -- do produto pago.
  if not public.tem_assinatura_ativa() then
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
$$;

grant execute on function public.registrar_resposta(uuid, char, int)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Os números de quem estuda
-- ---------------------------------------------------------------------------
create or replace function public.meu_desempenho()
returns table (
  respondidas bigint,
  acertos bigint,
  erros bigint,
  tentativas bigint,
  revisao_hoje bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with ultima as (
    select distinct on (r.questao_id) r.questao_id, r.acertou
    from public.respostas r
    where r.user_id = auth.uid()
    order by r.questao_id, r.respondido_em desc
  )
  select
    (select count(*) from ultima),
    (select count(*) from ultima where acertou),
    (select count(*) from ultima where not acertou),
    (select count(*) from public.respostas where user_id = auth.uid()),
    (select count(*) from public.revisoes
      where user_id = auth.uid() and proxima_em <= current_date);
$$;

grant execute on function public.meu_desempenho() to authenticated;

-- A contagem por disciplina alimenta o desempenho por matéria. Fica de fora
-- enquanto `disciplina_confirmada` for falso em toda a base: um gráfico de
-- evolução por disciplina montado sobre classificação não revisada mente com
-- aparência de dado.
