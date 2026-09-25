-- ============================================================================
-- Sequência curta de ativação para contas que ainda não começaram a estudar.
--
-- Não há analytics de página no OABase, por escolha: abrir uma tela não é um
-- marco confiável de estudo e não justifica rastrear navegação. A sequência
-- para diante de uma ação que realmente muda o produto (plano, resposta ou
-- sessão concluída). São no máximo dois e-mails opcionais, ambos obedecendo a
-- `perfis.avisos_email` e registrados na mesma trilha auditável dos demais.
-- ============================================================================

alter table public.emails_enviados
  drop constraint if exists emails_enviados_tipo_check;

alter table public.emails_enviados
  add constraint emails_enviados_tipo_check
  check (tipo in (
    'compra',
    'revisao',
    'plano_acabando',
    'calendario',
    'ativacao_boas_vindas',
    'ativacao_como_comecar'
  ));

-- Só o cron conhece o e-mail e o estado da pessoa. A função retorna a etapa
-- pronta para envio, em vez de expor auth.users ou emails_enviados ao cliente.
create or replace function public.destinatarios_ativacao(p_segredo text)
returns table (user_id uuid, email text, nome text, etapa text)
language plpgsql
security definer
set search_path = public, interno, auth
as $$
begin
  perform public.confere_segredo_cron(p_segredo);

  return query
  with atividade as (
    select pe.user_id from public.planos_estudo pe
    union
    select r.user_id from public.respostas r
    union
    select sf.user_id from public.sessoes_foco sf where sf.concluido_em is not null
    union
    select se.user_id from public.sessoes_estudo se
      where se.status = 'concluida' and se.concluido_em is not null
  ),
  elegiveis as (
    select
      u.id as user_id,
      u.email::text as email,
      coalesce(
        nullif(split_part(coalesce(p.nome, ''), ' ', 1), ''),
        nullif(split_part(coalesce(u.raw_user_meta_data ->> 'nome', ''), ' ', 1), ''),
        split_part(u.email, '@', 1)
      )::text as nome,
      case
        -- Dá tempo para a confirmação chegar e evita e-mail para endereço
        -- recém-cadastrado que ainda não foi validado.
        when u.created_at <= now() - interval '1 hour'
          and not exists (
            select 1 from public.emails_enviados e
             where e.user_id = u.id and e.tipo = 'ativacao_boas_vindas'
          ) then 'boas_vindas'
        when u.created_at <= now() - interval '3 days'
          and exists (
            select 1 from public.emails_enviados e
             where e.user_id = u.id and e.tipo = 'ativacao_boas_vindas'
          )
          and not exists (
            select 1 from public.emails_enviados e
             where e.user_id = u.id and e.tipo = 'ativacao_como_comecar'
          ) then 'como_comecar'
      end as etapa,
      u.created_at
    from auth.users u
    left join public.perfis p on p.id = u.id
    where u.email_confirmed_at is not null
      and coalesce(p.avisos_email, true)
      and not exists (select 1 from atividade a where a.user_id = u.id)
      -- Uma orientação não disputa a caixa de entrada com qualquer outro
      -- lembrete automático enviado nas últimas 24 horas.
      and not exists (
        select 1 from public.emails_enviados e
         where e.user_id = u.id and e.enviado_em > now() - interval '24 hours'
      )
  )
  select e.user_id, e.email, e.nome, e.etapa
    from elegiveis e
   where e.etapa is not null
   order by e.created_at asc;
end;
$$;

grant execute on function public.destinatarios_ativacao(text)
  to anon, authenticated;

comment on function public.destinatarios_ativacao(text) is
  'Até dois e-mails opcionais para conta confirmada sem atividade real; para após plano, resposta ou sessão concluída.';
