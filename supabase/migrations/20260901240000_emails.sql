-- ============================================================================
-- E-mail transacional e de hábito.
--
-- Até aqui o projeto não enviava um e-mail sequer. Enquanto o pagamento não
-- funcionava isso era teórico; com o webhook criando assinatura de verdade,
-- alguém paga e não recebe confirmação nenhuma do OABase — só o comprovante
-- do gateway, que não diz o que foi liberado.
--
-- O cron não tem sessão, igual ao webhook, e a saída é a mesma: funções
-- `security definer` de poder estreito, guardadas por um segredo que vive em
-- `interno.segredos`. Segredo próprio, e não o do webhook: quem consegue
-- disparar e-mail não deveria, pelo mesmo vazamento, conseguir confirmar
-- pagamento.
-- ============================================================================

insert into interno.segredos (chave, valor)
values ('cron_email', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (chave) do nothing;

-- Preferência de quem recebe. O lembrete de revisão é o único opcional: a
-- confirmação de compra e o aviso de fim de plano são transacionais — quem
-- pagou tem direito de saber o que comprou e quando acaba.
alter table public.perfis
  add column if not exists avisos_email boolean not null default true;

comment on column public.perfis.avisos_email is
  'Lembrete diário de revisão. Não afeta e-mail transacional.';

-- ---------------------------------------------------------------------------
-- O que já foi enviado
--
-- A chave única é o que impede o cron rodando duas vezes — ou reexecutado
-- depois de uma falha no meio — de mandar o mesmo lembrete duas vezes no
-- mesmo dia. `referencia` é o que torna o envio único: a data, no lembrete
-- diário; o id do pagamento, na compra; o id da assinatura, no aviso de fim.
-- ---------------------------------------------------------------------------
create table public.emails_enviados (
  user_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('compra', 'revisao', 'plano_acabando')),
  referencia text not null,
  enviado_em timestamptz not null default now(),
  primary key (user_id, tipo, referencia)
);

create index emails_enviados_data_idx on public.emails_enviados (enviado_em desc);

-- Sem política e sem grant: a tabela só é tocada pelas funções abaixo.
alter table public.emails_enviados enable row level security;

create or replace function public.confere_segredo_cron(p_segredo text)
returns void
language plpgsql
security definer
set search_path = interno
as $$
begin
  if p_segredo is null
     or p_segredo <> (select valor from interno.segredos where chave = 'cron_email')
  then
    raise exception 'segredo inválido' using errcode = '28000';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Dados da compra, para o webhook montar o e-mail
-- ---------------------------------------------------------------------------
create or replace function public.dados_da_compra(
  p_segredo text,
  p_pagamento_id text
)
returns table (email text, nome text, plano text, fim timestamptz, ja_avisado boolean)
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
  select
    u.email::text,
    -- O primeiro nome basta e é o que soa como gente. `perfis` tem
    -- prioridade porque é o que a pessoa digitou no checkout.
    coalesce(
      nullif(split_part(coalesce(p.nome, ''), ' ', 1), ''),
      nullif(split_part(coalesce(u.raw_user_meta_data ->> 'nome', ''), ' ', 1), ''),
      split_part(u.email, '@', 1)
    )::text,
    c.plano::text,
    a.fim,
    exists (
      select 1 from public.emails_enviados e
      where e.user_id = c.user_id and e.tipo = 'compra'
        and e.referencia = p_pagamento_id
    )
  from public.cobrancas c
    join auth.users u on u.id = c.user_id
    left join public.perfis p on p.id = c.user_id
    left join lateral (
      select max(fim) as fim from public.assinaturas
       where user_id = c.user_id and status = 'ativa'
    ) a on true
  where c.asaas_pagamento_id = p_pagamento_id;
end;
$$;

grant execute on function public.dados_da_compra(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Quem deve receber o lembrete de revisão hoje
-- ---------------------------------------------------------------------------
create or replace function public.destinatarios_revisao(p_segredo text)
returns table (user_id uuid, email text, nome text, questoes int)
language plpgsql
security definer
set search_path = public, interno
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
    count(*)::int
  from public.revisoes r
    join auth.users u on u.id = r.user_id
    left join public.perfis p on p.id = r.user_id
  where r.proxima_em <= current_date
    -- Lembrar de revisar quem não tem mais acesso seria propaganda disfarçada
    -- de utilidade. O aviso de fim de plano é o e-mail certo para esse caso.
    and exists (
      select 1 from public.assinaturas a
       where a.user_id = r.user_id and a.status = 'ativa' and a.fim > now()
    )
    and coalesce(p.avisos_email, true)
    and not exists (
      select 1 from public.emails_enviados e
       where e.user_id = r.user_id and e.tipo = 'revisao'
         and e.referencia = current_date::text
    )
  group by r.user_id, u.email, u.raw_user_meta_data, p.nome
  -- Uma questão pendente não justifica um e-mail. Cinco justificam.
  having count(*) >= 5;
end;
$$;

grant execute on function public.destinatarios_revisao(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Quem está com o plano acabando
-- ---------------------------------------------------------------------------
create or replace function public.destinatarios_plano_acabando(
  p_segredo text,
  p_dias int default 7
)
returns table (
  user_id uuid,
  email text,
  nome text,
  plano text,
  fim timestamptz,
  dias_restantes int,
  referencia text
)
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
      select 1 from public.emails_enviados e
       where e.user_id = a.user_id and e.tipo = 'plano_acabando'
         and e.referencia = a.id::text
    );
end;
$$;

grant execute on function public.destinatarios_plano_acabando(text, int)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Marcar como enviado
--
-- Chamado **depois** do envio bem-sucedido. Marcar antes evitaria duplicata
-- ao custo de perder o e-mail em silêncio quando o provedor falhasse — e um
-- lembrete a mais incomoda menos do que um aviso de fim de plano que nunca
-- chegou.
-- ---------------------------------------------------------------------------
create or replace function public.registrar_email(
  p_segredo text,
  p_user_id uuid,
  p_tipo text,
  p_referencia text
)
returns void
language plpgsql
security definer
set search_path = public, interno
as $$
begin
  -- Aceita os dois segredos: a compra é disparada pelo webhook, os avisos
  -- pelo cron, e cada um só conhece o seu.
  if p_segredo is null or p_segredo not in (
    select valor from interno.segredos
     where chave in ('cron_email', 'webhook_asaas')
  ) then
    raise exception 'segredo inválido' using errcode = '28000';
  end if;

  insert into public.emails_enviados (user_id, tipo, referencia)
  values (p_user_id, p_tipo, p_referencia)
  on conflict do nothing;
end;
$$;

grant execute on function public.registrar_email(text, uuid, text, text)
  to anon, authenticated;
