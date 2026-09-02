-- ============================================================================
-- Plano de cortesia.
--
-- Acesso liberado sem pagamento: convidado, parceiro, teste de longa duração.
-- Existe como chave própria, e não como um `anual` com `fim` em 2126, porque
-- registro de cortesia disfarçado de venda é indistinguível de venda de
-- verdade seis meses depois — some da contagem de receita só se alguém
-- lembrar de descontar à mão, e reaparece como churn no dia em que expirar.
-- O mesmo raciocínio que mantém `exames.data_prova` fora do seed.
--
-- **`cortesia` entra em `assinaturas`, mas não em `cobrancas`.** Cortesia não
-- tem fatura: nenhuma linha de cobrança deveria existir com esse plano, e a
-- restrição é o que garante isso mesmo se alguém tentar. Pelo mesmo motivo
-- ela não está em `src/lib/planos.ts` — o que não está lá não pode ser
-- comprado por `/api/assinar`, que lê o preço de lá. Cortesia se concede por
-- SQL, com a mão de quem opera, e é bom que exija isso.
--
-- `fim` continua obrigatório: `tem_assinatura_ativa()` compara com `now()` e
-- uma coluna nula viraria um `null` silencioso no meio da política de RLS.
-- Vitalício aqui é uma data distante o bastante para não chegar — e visível,
-- que é melhor do que um caso especial escondido na função de acesso.
-- ============================================================================

alter table public.assinaturas
  drop constraint assinaturas_plano_check;

alter table public.assinaturas
  add constraint assinaturas_plano_check
  check (plano in ('experimentar', 'mensal', 'ate-a-prova', 'anual', 'cortesia'));
