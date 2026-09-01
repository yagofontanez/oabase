-- ============================================================================
-- Dados de cobrança e histórico de cobranças.
--
-- CPF e telefone são dado pessoal: ficam em `perfis`, cuja política já
-- restringe leitura e escrita ao próprio dono. Nenhuma rota pública lê esta
-- tabela, e a aplicação usa apenas a chave anônima — quem separa é o RLS.
--
-- `asaas_cliente_id` é guardado para não recriar um cliente na Asaas a cada
-- tentativa de pagamento: o mesmo CPF criaria cadastro duplicado lá.
-- ============================================================================

alter table public.perfis
  add column cpf text,
  add column telefone text,
  add column asaas_cliente_id text;

comment on column public.perfis.cpf is
  'Somente dígitos. Exigido pela Asaas para emitir cobrança.';

create table public.cobrancas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plano text not null check (plano in ('experimentar', 'ate-a-prova', 'anual')),
  valor numeric(10,2) not null check (valor > 0),
  -- Registrado por cobrança, e não só em configuração: uma cobrança criada em
  -- sandbox não pode ser confundida com uma real depois que o ambiente mudar.
  ambiente text not null check (ambiente in ('sandbox', 'producao')),
  asaas_pagamento_id text not null unique,
  status text not null default 'PENDING',
  url_fatura text not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index cobrancas_usuario_idx on public.cobrancas (user_id, criado_em desc);

alter table public.cobrancas enable row level security;

create policy dono_le on public.cobrancas
  for select using (auth.uid() = user_id);

grant select on public.cobrancas to authenticated;

-- A escrita NÃO é liberada por política. Liberar `insert` ao papel
-- autenticado deixaria o navegador forjar uma cobrança já paga; e o servidor
-- da aplicação não pode usar service role, porque ele usa a chave anônima com
-- a sessão de quem está logado.
--
-- A saída é esta função: quem chama não escolhe o dono nem o status. Os dois
-- vêm daqui — `auth.uid()` e 'PENDING' fixo. O que o cliente informa é só o
-- que veio da resposta da Asaas.
create or replace function public.registrar_cobranca(
  p_plano text,
  p_valor numeric,
  p_ambiente text,
  p_pagamento_id text,
  p_url text
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

  insert into public.cobrancas
    (user_id, plano, valor, ambiente, asaas_pagamento_id, status, url_fatura)
  values
    (auth.uid(), p_plano, p_valor, p_ambiente, p_pagamento_id, 'PENDING', p_url)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function
  public.registrar_cobranca(text, numeric, text, text, text) to authenticated;
