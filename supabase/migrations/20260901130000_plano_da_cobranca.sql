-- ============================================================================
-- Qual plano foi comprado.
--
-- O webhook precisa saber o plano para calcular quantos dias de acesso a
-- compra vale — e `ate-a-prova` depende da data do próximo exame, que mora no
-- TypeScript (`proximoExame`, em src/lib/content/data.ts). Duplicar essa data
-- numa tabela de configuração criaria duas verdades que sairiam de sincronia
-- no primeiro edital novo.
--
-- Então o banco responde o que é dele — qual plano aquele pagamento comprou —
-- e a rota calcula os dias. O plano nunca vem do corpo do evento: é o mesmo
-- princípio do preço em `/api/assinar`, onde o cliente informa a chave e o
-- servidor decide o valor.
-- ============================================================================

create or replace function public.plano_da_cobranca(
  p_segredo text,
  p_pagamento_id text
)
returns text
language plpgsql
security definer
set search_path = public, interno
as $$
declare
  v_plano text;
begin
  if p_segredo is null
     or p_segredo <> (select valor from interno.segredos where chave = 'webhook_asaas')
  then
    raise exception 'segredo inválido' using errcode = '28000';
  end if;

  select plano into v_plano
  from public.cobrancas
  where asaas_pagamento_id = p_pagamento_id;

  return v_plano;
end;
$$;

grant execute on function public.plano_da_cobranca(text, text) to anon, authenticated;
