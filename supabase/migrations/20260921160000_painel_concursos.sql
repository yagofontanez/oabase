-- ============================================================================
-- Painel administrativo da lista de interesse em concursos.
--
-- A tabela de interesse continua sem SELECT para qualquer papel do app. Esta
-- função é o único recorte que chega ao painel, e só depois da mesma checagem
-- de admin que protege receita, planos e a lista de pessoas.
-- ============================================================================

create or replace function public.concursos_admin()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, interno
as $$
begin
  if not public.sou_admin() then
    raise exception 'não autorizado' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'total', (select count(*) from public.interesses_concursos),
    'ultimos_7d', (
      select count(*)
        from public.interesses_concursos
       where criado_em > now() - interval '7 days'
    ),
    'por_carreira', coalesce((
      select jsonb_agg(
        jsonb_build_object('carreira', carreira, 'inscricoes', inscricoes)
        order by inscricoes desc, carreira
      )
        from (
          select carreira, count(*)::int as inscricoes
            from public.interesses_concursos
           group by carreira
        ) distribuicao
    ), '[]'::jsonb),
    'recentes', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'email', email,
          'carreira', carreira,
          'criado_em', criado_em
        ) order by criado_em desc
      )
        from (
          select email, carreira, criado_em
            from public.interesses_concursos
           order by criado_em desc
           limit 20
        ) recentes
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.concursos_admin() to authenticated;
