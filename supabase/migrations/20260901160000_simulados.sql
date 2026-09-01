-- ============================================================================
-- Simulado cronometrado.
--
-- É o item que `planos.ts` já vendia no plano "Até a prova" e que não
-- existia. A diferença para a tela de questões não é cosmética: aqui não há
-- gabarito até o fim. Ver o resultado a cada questão treina reconhecimento;
-- a prova cobra decisão sob incerteza e sob relógio, e é isso que precisa ser
-- ensaiado.
--
-- **O relógio é do banco.** `finaliza_em` é gravado na criação, e é ele que
-- decide se ainda dá para responder. Se o cronômetro morasse no navegador,
-- recarregar a página zeraria a prova — e um simulado que se pode pausar
-- fechando a aba não simula coisa nenhuma.
--
-- O gabarito não é enviado ao navegador em momento algum durante a prova:
-- `simulado_questoes` guarda a alternativa marcada, e a correção acontece em
-- `finalizar_simulado`, que é `security definer`.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A repetição espaçada, extraída
--
-- Estava embutida em `registrar_resposta`. O simulado precisa da mesma regra
-- ao corrigir 80 questões de uma vez, e duas cópias da fórmula divergiriam na
-- primeira mudança de intervalo.
-- ---------------------------------------------------------------------------
create or replace function public.agendar_revisao(
  p_user uuid,
  p_questao_id uuid,
  p_acertou boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intervalo int;
  v_facilidade numeric(3,2);
begin
  select r.intervalo_dias, r.facilidade into v_intervalo, v_facilidade
  from public.revisoes r
  where r.user_id = p_user and r.questao_id = p_questao_id;

  if not found then
    v_intervalo := 0;
    v_facilidade := 2.50;
  end if;

  if p_acertou then
    v_facilidade := least(2.80, v_facilidade + 0.10);
    v_intervalo := case
      when v_intervalo <= 0 then 1
      when v_intervalo = 1 then 3
      else greatest(1, round(v_intervalo * v_facilidade)::int)
    end;
  else
    -- Errar tem de doer no calendário, não só no número.
    v_facilidade := greatest(1.30, v_facilidade - 0.20);
    v_intervalo := 1;
  end if;

  insert into public.revisoes (user_id, questao_id, proxima_em, intervalo_dias, facilidade)
  values (p_user, p_questao_id, current_date + v_intervalo, v_intervalo, v_facilidade)
  on conflict (user_id, questao_id) do update
    set proxima_em     = excluded.proxima_em,
        intervalo_dias = excluded.intervalo_dias,
        facilidade     = excluded.facilidade;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create table public.simulados (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Null = mistura do acervo. Preenchido = a prova daquela edição, inteira.
  exame_id uuid references public.exames(id) on delete set null,
  minutos int not null check (minutos between 5 and 360),
  total int not null check (total between 1 and 80),
  iniciado_em timestamptz not null default now(),
  finaliza_em timestamptz not null,
  finalizado_em timestamptz,
  acertos int
);

create index simulados_dono_idx on public.simulados (user_id, iniciado_em desc);

create table public.simulado_questoes (
  simulado_id uuid not null references public.simulados(id) on delete cascade,
  ordem int not null,
  questao_id uuid not null references public.questoes(id) on delete cascade,
  alternativa char(1) check (alternativa in ('A', 'B', 'C', 'D')),
  primary key (simulado_id, ordem),
  unique (simulado_id, questao_id)
);

alter table public.simulados         enable row level security;
alter table public.simulado_questoes enable row level security;

create policy dono on public.simulados
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- O cartão-resposta pertence a quem é dono do simulado. Sem o `exists`, a
-- política teria de duplicar `user_id` na tabela filha.
create policy dono on public.simulado_questoes
  for all using (
    exists (select 1 from public.simulados s
             where s.id = simulado_id and s.user_id = auth.uid())
  )
  with check (
    exists (select 1 from public.simulados s
             where s.id = simulado_id and s.user_id = auth.uid())
  );

grant select, insert, update, delete
  on public.simulados, public.simulado_questoes to authenticated;

-- ---------------------------------------------------------------------------
-- Criar
-- ---------------------------------------------------------------------------
create or replace function public.criar_simulado(
  p_exame text default null,
  p_total int default 80,
  p_minutos int default 300
)
returns uuid
language plpgsql
security invoker  -- a RLS de `questoes` continua exigindo assinatura ativa
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_exame_id uuid;
  v_id uuid;
  v_inseridas int;
begin
  if v_user is null then
    raise exception 'sessão expirada' using errcode = '28000';
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
$$;

grant execute on function public.criar_simulado(text, int, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Marcar
-- ---------------------------------------------------------------------------
create or replace function public.marcar_no_simulado(
  p_simulado_id uuid,
  p_questao_id uuid,
  p_alternativa char(1)
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_prazo timestamptz;
  v_fim timestamptz;
begin
  select finaliza_em, finalizado_em into v_prazo, v_fim
  from public.simulados
  where id = p_simulado_id and user_id = auth.uid();

  if not found then
    raise exception 'simulado inexistente' using errcode = '42501';
  end if;
  -- O prazo é do banco. Um cliente com o relógio adiantado — ou adulterado —
  -- não ganha nem perde tempo de prova.
  if v_fim is not null or v_prazo <= now() then
    raise exception 'simulado encerrado' using errcode = '55006';
  end if;
  if p_alternativa is not null and p_alternativa not in ('A','B','C','D') then
    raise exception 'alternativa inválida' using errcode = '22023';
  end if;

  update public.simulado_questoes
     set alternativa = p_alternativa
   where simulado_id = p_simulado_id and questao_id = p_questao_id;
end;
$$;

grant execute on function public.marcar_no_simulado(uuid, uuid, char)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Finalizar e corrigir
-- ---------------------------------------------------------------------------
create or replace function public.finalizar_simulado(p_simulado_id uuid)
returns table (total int, respondidas int, acertos int, minutos_gastos int)
language plpgsql
security definer  -- precisa do gabarito, que o navegador nunca vê
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_simulado public.simulados%rowtype;
  v_acertos int;
  v_respondidas int;
  linha record;
begin
  if v_user is null then
    raise exception 'sessão expirada' using errcode = '28000';
  end if;

  select * into v_simulado
  from public.simulados
  where id = p_simulado_id and user_id = v_user;

  if not found then
    raise exception 'simulado inexistente' using errcode = '42501';
  end if;

  -- Corrigir duas vezes não pode dobrar o histórico de respostas.
  if v_simulado.finalizado_em is not null then
    return query
      select v_simulado.total,
             (select count(*)::int from public.simulado_questoes
               where simulado_id = p_simulado_id and alternativa is not null),
             coalesce(v_simulado.acertos, 0),
             ceil(extract(epoch from
               (v_simulado.finalizado_em - v_simulado.iniciado_em)) / 60)::int;
    return;
  end if;

  v_acertos := 0;
  v_respondidas := 0;

  for linha in
    select sq.questao_id, sq.alternativa, q.gabarito
    from public.simulado_questoes sq
      join public.questoes q on q.id = sq.questao_id
    where sq.simulado_id = p_simulado_id and sq.alternativa is not null
  loop
    v_respondidas := v_respondidas + 1;
    if linha.alternativa = linha.gabarito then
      v_acertos := v_acertos + 1;
    end if;

    -- O simulado alimenta o resto do produto: a questão errada aqui entra no
    -- caderno de erros e volta na fila de revisão como qualquer outra. Um
    -- simulado que não deixa rastro no estudo é só um número.
    insert into public.respostas (user_id, questao_id, alternativa, acertou)
    values (v_user, linha.questao_id, linha.alternativa,
            linha.alternativa = linha.gabarito);

    perform public.agendar_revisao(
      v_user, linha.questao_id, linha.alternativa = linha.gabarito);
  end loop;

  update public.simulados
     set finalizado_em = now(), acertos = v_acertos
   where id = p_simulado_id;

  return query
    select v_simulado.total, v_respondidas, v_acertos,
           ceil(extract(epoch from (now() - v_simulado.iniciado_em)) / 60)::int;
end;
$$;

grant execute on function public.finalizar_simulado(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- O caderno de prova (sem gabarito) e o relatório (com)
-- ---------------------------------------------------------------------------
create or replace function public.questoes_do_simulado(p_simulado_id uuid)
returns table (
  ordem int,
  questao_id uuid,
  numero int,
  enunciado text,
  alternativas jsonb,
  exame_edicao int,
  disciplina_nome text,
  marcada char(1)
)
language sql
stable
security invoker
set search_path = public
as $$
  -- Sem `gabarito` na lista de colunas, de propósito: durante a prova ele não
  -- pode sair do banco de jeito nenhum.
  select sq.ordem, q.id, q.numero, q.enunciado, q.alternativas,
         e.edicao, d.nome, sq.alternativa
  from public.simulado_questoes sq
    join public.simulados s on s.id = sq.simulado_id
    join public.questoes q  on q.id = sq.questao_id
    join public.exames e    on e.id = q.exame_id
    left join public.disciplinas d on d.id = q.disciplina_id
  where sq.simulado_id = p_simulado_id and s.user_id = auth.uid()
  order by sq.ordem;
$$;

grant execute on function public.questoes_do_simulado(uuid) to authenticated;

create or replace function public.relatorio_do_simulado(p_simulado_id uuid)
returns table (
  ordem int,
  questao_id uuid,
  numero int,
  exame_edicao int,
  exame_slug text,
  disciplina_nome text,
  marcada char(1),
  gabarito char(1),
  acertou boolean
)
language sql
stable
security definer  -- o gabarito só atravessa depois de a prova terminar
set search_path = public
as $$
  select sq.ordem, q.id, q.numero, e.edicao, e.slug, d.nome,
         sq.alternativa, q.gabarito,
         sq.alternativa is not null and sq.alternativa = q.gabarito
  from public.simulado_questoes sq
    join public.simulados s on s.id = sq.simulado_id
    join public.questoes q  on q.id = sq.questao_id
    join public.exames e    on e.id = q.exame_id
    left join public.disciplinas d on d.id = q.disciplina_id
  where sq.simulado_id = p_simulado_id
    and s.user_id = auth.uid()
    and s.finalizado_em is not null
  order by sq.ordem;
$$;

grant execute on function public.relatorio_do_simulado(uuid) to authenticated;
