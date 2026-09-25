-- ============================================================================
-- Recorrência do plano Mensal.
--
-- Até aqui toda compra era avulsa: uma cobrança, um período, fim. O Mensal
-- passa a ser uma assinatura da Asaas (`/v3/subscriptions`), criada com
-- `billingType = UNDEFINED` — a pessoa escolhe o meio na fatura, como antes:
--
--   * paga com cartão → a Asaas guarda o token e troca a assinatura para
--     CREDIT_CARD sozinha; os meses seguintes são debitados sem ninguém agir;
--   * paga com Pix ou boleto → a assinatura continua UNDEFINED e a Asaas gera
--     uma fatura nova a cada mês, que o OABase avisa por e-mail.
--
-- (Comportamento conferido no sandbox em 25/09/2026, não suposto: a
-- documentação da Asaas não diz o que acontece com UNDEFINED pago no cartão.)
--
-- Experimentar e Até a prova continuam avulsos. Quem comprou antes continua
-- avulso: não se passa a cobrar automaticamente quem aceitou "sem renovação".
--
-- **Cada cobrança continua sendo uma linha em `cobrancas`** e continua
-- virando acesso pelo mesmo caminho (`confirmar_pagamento`). O que muda é
-- quem cria a linha: a primeira nasce no checkout, como sempre; as dos meses
-- seguintes a Asaas cria sozinha, e a linha nasce quando o pagamento chega,
-- por `registrar_cobranca_da_assinatura` — que só aceita assinatura que o
-- nosso checkout registrou.
-- ============================================================================

create table public.recorrencias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Só o Mensal renova. A restrição é o que impede uma assinatura de outro
  -- plano de nascer por engano de configuração.
  plano text not null check (plano in ('mensal')),
  ambiente text not null check (ambiente in ('sandbox', 'producao')),
  asaas_assinatura_id text not null unique,
  status text not null default 'ativa' check (status in ('ativa', 'cancelada')),
  criado_em timestamptz not null default now(),
  cancelada_em timestamptz
);

-- Duas assinaturas correndo é cobrança em dobro. O checkout recusa antes; o
-- índice é o que garante quando o checkout falhar.
create unique index recorrencias_uma_ativa
  on public.recorrencias (user_id) where status = 'ativa';

alter table public.recorrencias enable row level security;

-- Leitura do dono, para a tela de configurações. Escrita só por função.
create policy dono_le on public.recorrencias
  for select using (auth.uid() = user_id);

alter table public.cobrancas
  add column asaas_assinatura_id text,
  -- A primeira cobrança de uma assinatura ganha folga; as renovações, não
  -- (ver `diasDaCobranca` em src/lib/pagamento/confirmar.ts).
  add column renovacao boolean not null default false;

create index cobrancas_assinatura_idx
  on public.cobrancas (asaas_assinatura_id) where asaas_assinatura_id is not null;

-- ---------------------------------------------------------------------------
-- Checkout: a mesma função, agora sabendo de assinatura.
-- O parâmetro novo tem default, então a chamada antiga continua válida.
-- ---------------------------------------------------------------------------
drop function if exists public.registrar_cobranca(text, numeric, text, text, text);

create function public.registrar_cobranca(
  p_plano text,
  p_valor numeric,
  p_ambiente text,
  p_pagamento_id text,
  p_url text,
  p_assinatura_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'É preciso estar autenticado para registrar cobrança.';
  end if;

  if p_assinatura_id is not null then
    insert into public.recorrencias (user_id, plano, ambiente, asaas_assinatura_id)
    values (auth.uid(), p_plano, p_ambiente, p_assinatura_id)
    on conflict (asaas_assinatura_id) do nothing;
  end if;

  insert into public.cobrancas
    (user_id, plano, valor, ambiente, asaas_pagamento_id, status, url_fatura,
     asaas_assinatura_id)
  values
    (auth.uid(), p_plano, p_valor, p_ambiente, p_pagamento_id, 'PENDING', p_url,
     p_assinatura_id)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.registrar_cobranca(text, numeric, text, text, text, text) from public, anon;
grant execute on function public.registrar_cobranca(text, numeric, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Renovação: a Asaas criou a cobrança do mês e ela foi paga.
-- ---------------------------------------------------------------------------
create function public.registrar_cobranca_da_assinatura(
  p_segredo text,
  p_pagamento_id text,
  p_assinatura_id text,
  p_valor numeric,
  p_url text
)
returns text
language plpgsql
security definer
set search_path = public, interno
as $$
declare
  v_rec public.recorrencias%rowtype;
begin
  if p_segredo is null
     or p_segredo <> (select valor from interno.segredos where chave = 'webhook_asaas')
  then
    raise exception 'segredo inválido' using errcode = '28000';
  end if;

  -- Só assinatura que o nosso checkout registrou. Uma assinatura criada à mão
  -- no painel da Asaas, ou de outra integração na mesma conta, não vira
  -- acesso de ninguém.
  select * into v_rec from public.recorrencias where asaas_assinatura_id = p_assinatura_id;
  if not found then
    return null;
  end if;

  -- Cancelada não impede: se a fatura foi paga, o mês foi comprado.
  insert into public.cobrancas
    (user_id, plano, valor, ambiente, asaas_pagamento_id, status, url_fatura,
     asaas_assinatura_id, renovacao)
  values
    (v_rec.user_id, v_rec.plano, p_valor, v_rec.ambiente, p_pagamento_id,
     'PENDING', p_url, p_assinatura_id, true)
  on conflict (asaas_pagamento_id) do nothing;

  return v_rec.plano;
end;
$$;

-- O que `confirmarCobranca` precisa saber da nossa linha, além do plano.
create function public.cobranca_local(p_segredo text, p_pagamento_id text)
returns table (plano text, renovacao boolean, assinatura_id text)
language plpgsql
security definer
set search_path = public, interno
as $$
begin
  if p_segredo is null
     or p_segredo <> (select valor from interno.segredos where chave = 'webhook_asaas')
  then
    raise exception 'segredo inválido' using errcode = '28000';
  end if;

  return query
    select c.plano, c.renovacao, c.asaas_assinatura_id
      from public.cobrancas c
     where c.asaas_pagamento_id = p_pagamento_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cancelamento.
--
-- Pela pessoa: a rota cancela na Asaas primeiro e só então marca aqui — o
-- contrário deixaria a tela dizendo "cancelada" com a Asaas ainda cobrando.
-- Cancelar interrompe as cobranças futuras; o período já pago continua.
-- ---------------------------------------------------------------------------
create function public.cancelar_minha_recorrencia(p_assinatura_id text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'É preciso estar autenticado.';
  end if;

  update public.recorrencias
     set status = 'cancelada', cancelada_em = now()
   where asaas_assinatura_id = p_assinatura_id
     and user_id = auth.uid()
     and status = 'ativa';

  return found;
end;
$$;

revoke all on function public.cancelar_minha_recorrencia(text) from public, anon;
grant execute on function public.cancelar_minha_recorrencia(text) to authenticated;

-- Pelo webhook: assinatura removida no painel da Asaas ou inativada por ela.
create function public.encerrar_recorrencia(p_segredo text, p_assinatura_id text)
returns boolean
language plpgsql
security definer
set search_path = public, interno
as $$
begin
  if p_segredo is null
     or p_segredo <> (select valor from interno.segredos where chave = 'webhook_asaas')
  then
    raise exception 'segredo inválido' using errcode = '28000';
  end if;

  update public.recorrencias
     set status = 'cancelada', cancelada_em = now()
   where asaas_assinatura_id = p_assinatura_id
     and status = 'ativa';

  return found;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rede de segurança: a reconciliação horária pergunta à Asaas pelas
-- cobranças pagas de cada assinatura ativa. Renovação que o webhook perdeu
-- não está em `cobrancas` — a reconciliação antiga, que varre as PENDING,
-- nunca a veria.
-- ---------------------------------------------------------------------------
create function public.recorrencias_a_reconciliar(p_segredo text, p_ambiente text)
returns table (assinatura_id text)
language plpgsql
security definer
set search_path = public, interno
as $$
begin
  if p_segredo is null
     or p_segredo <> (select valor from interno.segredos where chave = 'webhook_asaas')
  then
    raise exception 'segredo inválido' using errcode = '28000';
  end if;

  return query
    select r.asaas_assinatura_id
      from public.recorrencias r
     where r.status = 'ativa' and r.ambiente = p_ambiente;
end;
$$;

-- ---------------------------------------------------------------------------
-- Aviso de fatura. A Asaas não avisa ninguém (`notificationDisabled` no
-- cliente: o aviso é nosso), então quem paga por Pix precisa saber que a
-- fatura do mês chegou — e quem paga no cartão, que o débito falhou.
-- ---------------------------------------------------------------------------
alter table public.emails_enviados
  drop constraint if exists emails_enviados_tipo_check;

alter table public.emails_enviados
  add constraint emails_enviados_tipo_check
  check (tipo in (
    'compra',
    'revisao',
    'plano_acabando',
    'calendario',
    'ativacao_boas_vindas',
    'ativacao_como_comecar',
    'fatura'
  ));

create function public.destinatarios_fatura(p_segredo text, p_ambiente text)
returns table (
  user_id uuid,
  email text,
  nome text,
  assinatura_id text,
  avisadas text[]
)
language plpgsql
security definer
set search_path = public, interno, auth
as $$
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
    r.asaas_assinatura_id,
    -- As faturas já avisadas: a rota pergunta à Asaas quais estão em aberto
    -- e pula estas. Cada fatura, um e-mail.
    coalesce(
      (select array_agg(e.referencia) from public.emails_enviados e
        where e.user_id = r.user_id and e.tipo = 'fatura'),
      '{}'
    )
  from public.recorrencias r
    join auth.users u on u.id = r.user_id
    left join public.perfis p on p.id = r.user_id
  where r.status = 'ativa' and r.ambiente = p_ambiente;
end;
$$;

-- ---------------------------------------------------------------------------
-- "Seu plano acaba em 7 dias" não vale para quem renova sozinho: seria falso
-- para quem paga no cartão e redundante com o aviso de fatura para quem paga
-- por Pix. Voltar a valer é automático quando a recorrência é cancelada.
-- ---------------------------------------------------------------------------
create or replace function public.destinatarios_plano_acabando(p_segredo text, p_dias integer default 7)
returns table (user_id uuid, email text, nome text, plano text, fim timestamptz, dias_restantes integer, referencia text)
language plpgsql
security definer
set search_path = public, interno
as $$
begin
  perform public.confere_segredo_cron(p_segredo);

  return query
  select
    a.user_id,
    u.email::text,
    coalesce(
      nullif(split_part(coalesce(p.nome, ''), ' ', 1), ''),
      nullif(split_part(coalesce(u.raw_user_meta_data ->> 'nome', ''), ' ', 1), ''),
      split_part(u.email, '@', 1)
    )::text,
    a.plano::text,
    a.fim,
    (a.fim::date - current_date)::int,
    a.id::text
  from public.assinaturas a
    join auth.users u on u.id = a.user_id
    left join public.perfis p on p.id = a.user_id
  where a.status = 'ativa'
    and a.fim > now()
    and a.fim::date - current_date <= p_dias
    -- Quem já renovou tem outra assinatura ativa terminando depois: avisar
    -- que "o plano acaba" seria falso.
    and not exists (
      select 1 from public.assinaturas b
       where b.user_id = a.user_id and b.status = 'ativa' and b.fim > a.fim
    )
    and not exists (
      select 1 from public.recorrencias r
       where r.user_id = a.user_id and r.status = 'ativa'
    )
    and not exists (
      select 1 from public.emails_enviados e
       where e.user_id = a.user_id and e.tipo = 'plano_acabando'
         and e.referencia = a.id::text
    );
end;
$$;

-- As funções de segredo ficam liberadas para anon, como as outras do
-- webhook e do cron: quem decide é o segredo, não o papel.
grant execute on function public.registrar_cobranca_da_assinatura(text, text, text, numeric, text) to anon, authenticated;
grant execute on function public.cobranca_local(text, text) to anon, authenticated;
grant execute on function public.encerrar_recorrencia(text, text) to anon, authenticated;
grant execute on function public.recorrencias_a_reconciliar(text, text) to anon, authenticated;
grant execute on function public.destinatarios_fatura(text, text) to anon, authenticated;
