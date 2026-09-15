-- ============================================================================
-- Funil de ativacao, derivado do que a pessoa realmente fez.
--
-- Nao ha evento de pagina, cookie de analytics nem fornecedor novo. Cada marco
-- vem de uma tabela que ja e fonte de verdade do produto: plano salvo, foco,
-- resposta, retorno e cobranca confirmada. Assim a operacao mede resultado, nao
-- clique, e uma falha de telemetria nunca interfere no estudo.
-- ============================================================================

create or replace function public.funil_ativacao_admin()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, interno, auth
as $$
declare
  r jsonb;
begin
  if not public.sou_admin() then
    raise exception 'nao autorizado' using errcode = '42501';
  end if;

  with atividade as (
    select user_id, respondido_em as realizado_em from public.respostas
    union all
    select user_id, concluido_em from public.sessoes_foco
    union all
    select user_id, concluido_em
      from public.sessoes_estudo
     where status = 'concluida' and concluido_em is not null
  ),
  por_pessoa as (
    select
      u.id,
      u.created_at,
      u.email_confirmed_at,
      exists (
        select 1 from public.planos_estudo p
         where p.user_id = u.id and p.plano is not null
      ) as criou_plano,
      exists (
        select 1 from atividade a where a.user_id = u.id
      ) as iniciou_estudo,
      (
        select count(distinct x.questao_id)
          from public.respostas x where x.user_id = u.id
      ) >= 20 as respondeu_vinte,
      exists (
        select 1 from atividade a
         where a.user_id = u.id
           and a.realizado_em >= u.created_at + interval '7 days'
           and a.realizado_em < u.created_at + interval '8 days'
      ) as voltou_d7,
      exists (
        select 1 from public.cobrancas c
         where c.user_id = u.id
           and c.status = 'CONFIRMED'
           and c.ambiente = 'producao'
      ) as comprou
    from auth.users u
  )
  select jsonb_build_object(
    'contas', count(*),
    'confirmadas', count(*) filter (where email_confirmed_at is not null),
    'planos_criados', count(*) filter (where criou_plano),
    'primeiro_estudo', count(*) filter (where iniciou_estudo),
    'vinte_questoes', count(*) filter (where respondeu_vinte),
    'elegiveis_d7', count(*) filter (
      where email_confirmed_at is not null
        and created_at <= now() - interval '8 days'
    ),
    'retorno_d7', count(*) filter (
      where email_confirmed_at is not null
        and created_at <= now() - interval '8 days'
        and voltou_d7
    ),
    'compradores', count(*) filter (where comprou)
  ) into r
  from por_pessoa;

  return r;
end;
$$;

revoke execute on function public.funil_ativacao_admin() from public, anon;
grant execute on function public.funil_ativacao_admin() to authenticated;

comment on function public.funil_ativacao_admin() is
  'Marcos de ativacao derivados de dados reais, visiveis somente para admin.';
