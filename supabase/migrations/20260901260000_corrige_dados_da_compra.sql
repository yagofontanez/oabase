-- ============================================================================
-- `fim` era parâmetro de saída e coluna ao mesmo tempo.
--
-- Dentro do `lateral`, `max(fim)` não sabia se apontava para a variável do
-- PL/pgSQL ou para `assinaturas.fim`, e o Postgres recusava com "column
-- reference is ambiguous". Como a chamada mora dentro do `try/catch` do
-- webhook, a falha não aparecia: a compra era confirmada, o e-mail não saía,
-- e só o log registrava. Bug silencioso do pior tipo — o que só o comprador
-- percebe, e percebe pela ausência.
--
-- Qualificar a coluna com um alias resolve; é mais barato do que renomear o
-- retorno, que a rota já consome.
-- ============================================================================

create or replace function public.dados_da_compra(
  p_segredo text,
  p_pagamento_id text
)
returns table (
  user_id uuid,
  email text,
  nome text,
  plano text,
  fim timestamptz,
  ja_avisado boolean
)
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
    c.user_id,
    u.email::text,
    coalesce(
      nullif(split_part(coalesce(p.nome, ''), ' ', 1), ''),
      nullif(split_part(coalesce(u.raw_user_meta_data ->> 'nome', ''), ' ', 1), ''),
      split_part(u.email, '@', 1)
    )::text,
    c.plano::text,
    vigente.ate,
    exists (
      select 1 from public.emails_enviados e
      where e.user_id = c.user_id and e.tipo = 'compra'
        and e.referencia = p_pagamento_id
    )
  from public.cobrancas c
    join auth.users u on u.id = c.user_id
    left join public.perfis p on p.id = c.user_id
    left join lateral (
      select max(a.fim) as ate
      from public.assinaturas a
      where a.user_id = c.user_id and a.status = 'ativa'
    ) vigente on true
  where c.asaas_pagamento_id = p_pagamento_id;
end;
$$;

grant execute on function public.dados_da_compra(text, text) to anon, authenticated;
