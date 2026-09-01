-- ============================================================================
-- Confirmação de pagamento (webhook da Asaas).
--
-- Até aqui o fluxo de compra terminava na fatura: `/api/assinar` criava a
-- cobrança e gravava em `cobrancas`, e ninguém nunca escrevia em
-- `assinaturas`. Quem pagasse continuaria sem acesso.
--
-- O problema de fazer isso pelo caminho normal é que o webhook não tem
-- sessão: chega uma requisição da Asaas, sem cookie, sem `auth.uid()`. A RLS,
-- que é a guarda de tudo no projeto, não tem em quem se apoiar.
--
-- A saída **não** é service role no Next — a chave de serviço pertence ao
-- pipeline de ingestão, que roda fora daqui, e trazê-la para dentro da
-- aplicação daria a qualquer rota nova acesso irrestrito ao banco. A saída é
-- estender o padrão que `registrar_cobranca` já usa: uma função
-- `security definer` com poder estreito, que faz uma coisa só.
--
-- O que impede que qualquer pessoa chame a função e se dê um plano:
--
-- 1. um segredo guardado em `interno.segredos`, esquema sem permissão nenhuma
--    para `anon` e `authenticated` — só a função, que roda como dona, lê;
-- 2. a rota confere o token do webhook e **reconsulta o pagamento na Asaas**
--    antes de chamar aqui, então nem um id de pagamento vazado adianta;
-- 3. a duração vem em dias e é limitada — plano de 400 anos não existe.
--
-- O segredo é gerado pelo banco, não escrito nesta migration: migration vai
-- para o git, e segredo em git é segredo queimado.
-- ============================================================================

create schema if not exists interno;
revoke all on schema interno from public;

create table if not exists interno.segredos (
  chave text primary key,
  valor text not null,
  criado_em timestamptz not null default now()
);
revoke all on interno.segredos from public;

-- `gen_random_bytes` é do pgcrypto, que no Supabase mora em `extensions` e
-- não está no `search_path` da migration. Qualificar é mais barato do que
-- descobrir isso de novo daqui a seis meses.
insert into interno.segredos (chave, valor)
values ('webhook_asaas', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (chave) do nothing;

-- Marca quando a cobrança foi de fato confirmada. `atualizado_em` sozinho não
-- distingue "mudou de status" de "foi paga".
alter table public.cobrancas
  add column if not exists confirmado_em timestamptz;

-- ---------------------------------------------------------------------------
-- Confirmar
-- ---------------------------------------------------------------------------
create or replace function public.confirmar_pagamento(
  p_segredo text,
  p_pagamento_id text,
  p_dias int
)
returns table (situacao text, assinatura_fim timestamptz)
language plpgsql
security definer
set search_path = public, interno
as $$
declare
  v_cobranca public.cobrancas%rowtype;
  v_base timestamptz;
  v_fim timestamptz;
begin
  if p_segredo is null
     or p_segredo <> (select valor from interno.segredos where chave = 'webhook_asaas')
  then
    raise exception 'segredo inválido' using errcode = '28000';
  end if;

  if p_dias is null or p_dias < 1 or p_dias > 400 then
    raise exception 'duração fora da faixa' using errcode = '22023';
  end if;

  select * into v_cobranca
  from public.cobrancas
  where asaas_pagamento_id = p_pagamento_id;

  if not found then
    -- Cobrança desconhecida não é erro do remetente: pode ser um evento de
    -- outra integração no mesmo webhook. A rota devolve 200 e segue.
    return query select 'desconhecida'::text, null::timestamptz;
    return;
  end if;

  -- A Asaas reenvia o mesmo evento até receber 2xx, e reenvia de novo em
  -- falhas de rede. Confirmar duas vezes não pode dobrar a validade.
  if v_cobranca.status = 'CONFIRMED' then
    return query
      select 'ja_confirmada'::text,
             (select max(fim) from public.assinaturas
               where user_id = v_cobranca.user_id and status = 'ativa');
    return;
  end if;

  update public.cobrancas
     set status = 'CONFIRMED',
         confirmado_em = now(),
         atualizado_em = now()
   where id = v_cobranca.id;

  -- Renovação soma ao que ainda resta: quem renova uma semana antes não pode
  -- perder a semana que já pagou.
  select greatest(
           now(),
           coalesce(max(a.fim), now())
         )
    into v_base
    from public.assinaturas a
   where a.user_id = v_cobranca.user_id
     and a.status = 'ativa'
     and a.fim > now();

  v_fim := v_base + (p_dias || ' days')::interval;

  insert into public.assinaturas (user_id, plano, status, inicio, fim, gateway_id)
  values (v_cobranca.user_id, v_cobranca.plano, 'ativa', now(), v_fim,
          p_pagamento_id);

  return query select 'confirmada'::text, v_fim;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cancelar (estorno, chargeback)
-- ---------------------------------------------------------------------------
create or replace function public.cancelar_pagamento(
  p_segredo text,
  p_pagamento_id text,
  p_status text
)
returns text
language plpgsql
security definer
set search_path = public, interno
as $$
declare
  v_cobranca public.cobrancas%rowtype;
begin
  if p_segredo is null
     or p_segredo <> (select valor from interno.segredos where chave = 'webhook_asaas')
  then
    raise exception 'segredo inválido' using errcode = '28000';
  end if;

  select * into v_cobranca
  from public.cobrancas
  where asaas_pagamento_id = p_pagamento_id;

  if not found then
    return 'desconhecida';
  end if;

  update public.cobrancas
     set status = p_status, atualizado_em = now()
   where id = v_cobranca.id;

  -- Só a assinatura nascida deste pagamento é cancelada. Estornar a compra de
  -- março não pode derrubar o acesso que a pessoa comprou de novo em junho.
  update public.assinaturas
     set status = 'cancelada'
   where user_id = v_cobranca.user_id
     and gateway_id = p_pagamento_id
     and status = 'ativa';

  return 'cancelada';
end;
$$;

-- As duas funções são chamadas pela rota do webhook, que não tem sessão — daí
-- a permissão para `anon`. Quem guarda a porta é o segredo, não o papel.
grant execute on function public.confirmar_pagamento(text, text, int) to anon, authenticated;
grant execute on function public.cancelar_pagamento(text, text, text)  to anon, authenticated;
