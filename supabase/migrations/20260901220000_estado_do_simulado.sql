-- ============================================================================
-- O simulado acabou?
--
-- A página estava comparando `finaliza_em` com o relógio do processo Node.
-- `marcar_no_simulado` e `finalizar_simulado` comparam com o relógio do
-- Postgres. Dois relógios decidindo a mesma coisa é um bug esperando um
-- servidor com hora dessincronizada: a tela mostraria a prova aberta e o
-- banco recusaria cada marcação, sem explicar por quê.
--
-- Uma pergunta, um relógio.
-- ============================================================================

create or replace function public.simulado_encerrado(p_simulado_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select s.finalizado_em is not null or s.finaliza_em <= now()
  from public.simulados s
  where s.id = p_simulado_id and s.user_id = auth.uid();
$$;

grant execute on function public.simulado_encerrado(uuid) to authenticated;
