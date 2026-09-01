-- ============================================================================
-- `dados_da_compra` precisa devolver o dono.
--
-- O webhook usa o retorno para montar o e-mail e, logo depois, para marcar o
-- envio em `emails_enviados` — que é chaveada por `user_id`. Sem ele, a rota
-- teria de fazer uma segunda consulta só para descobrir de quem era a compra
-- que ela acabou de confirmar.
--
-- Mudar o tipo de retorno exige derrubar e recriar; `create or replace` não
-- dá conta.
-- ============================================================================

drop function if exists public.dados_da_compra(text, text);

create function public.dados_da_compra(
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
