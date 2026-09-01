-- ============================================================================
-- Plano mensal.
--
-- A oferta principal continua sendo o acesso até a data da prova — é o ciclo
-- real de quem estuda para a OAB. O mensal existe como porta de entrada de
-- preço baixo para quem ainda não sabe quanto tempo vai ficar.
--
-- A restrição de `plano` é enumerada no banco de propósito: é o que impede
-- que uma chave inventada em código, ou um corpo de requisição forjado, vire
-- linha de assinatura. Por isso qualquer plano novo em `src/lib/planos.ts`
-- exige passar por aqui — e é bom que exija.
-- ============================================================================

alter table public.assinaturas
  drop constraint assinaturas_plano_check;

alter table public.assinaturas
  add constraint assinaturas_plano_check
  check (plano in ('experimentar', 'mensal', 'ate-a-prova', 'anual'));

alter table public.cobrancas
  drop constraint cobrancas_plano_check;

alter table public.cobrancas
  add constraint cobrancas_plano_check
  check (plano in ('experimentar', 'mensal', 'ate-a-prova', 'anual'));
