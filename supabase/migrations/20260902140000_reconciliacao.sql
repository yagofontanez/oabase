-- ============================================================================
-- Reconciliação de cobranças: a rede de segurança do webhook.
--
-- Todo o acesso pago depende de um POST da Asaas chegar em
-- `/api/asaas/webhook`. Se ele não chegar — deploy no ar naquele minuto,
-- instabilidade de rede, token trocado no painel e não no ambiente —, a
-- pessoa paga, a Asaas registra o pagamento e `assinaturas` continua vazia.
-- Nada no sistema percebe. A primeira notícia vem por reclamação, e a essa
-- altura já se perdeu o cliente que mais confiava no produto: o que pagou.
--
-- A resposta é perguntar de novo, todo dia, para a mesma autoridade que o
-- webhook consulta: a Asaas. Esta função é só o lado do banco — devolver
-- quais cobranças ainda não foram confirmadas por aqui, para que a rota
-- reconsulte cada uma e chame `confirmar_pagamento` nas que estiverem pagas.
--
-- Três decisões:
--
-- 1. **O segredo é o do webhook, não o do cron.** A separação que existe em
--    `interno.segredos` é por capacidade: quem dispara e-mail não deve
--    conseguir confirmar pagamento. A reconciliação *confirma pagamento* —
--    é o webhook por outro caminho, e usa a credencial do webhook.
-- 2. **Janela curta.** Cobrança vence em 3 dias (`/api/assinar`). Sete dias
--    cobrem o atraso de compensação de boleto sem transformar a tarefa numa
--    varredura da tabela inteira a cada execução.
-- 3. **Devolve só id e plano.** Não é uma janela de leitura para `cobrancas`
--    — é a lista mínima para reconsultar na Asaas. Valor, CPF e URL de
--    fatura não saem daqui.
-- ============================================================================

create or replace function public.cobrancas_a_reconciliar(
  p_segredo text,
  p_ambiente text,
  p_dias int default 7,
  p_limite int default 40
)
returns table (pagamento_id text, plano text, criado_em timestamptz)
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

  if p_ambiente not in ('sandbox', 'producao') then
    raise exception 'ambiente inválido' using errcode = '22023';
  end if;

  return query
    select c.asaas_pagamento_id, c.plano, c.criado_em
      from public.cobrancas c
     where c.status = 'PENDING'
       and c.ambiente = p_ambiente
       and c.criado_em > now() - make_interval(days => greatest(p_dias, 1))
     order by c.criado_em
     limit least(greatest(p_limite, 1), 200);
end;
$$;

grant execute on function public.cobrancas_a_reconciliar(text, text, int, int)
  to anon, authenticated;
