-- ============================================================================
-- Painel de administração.
--
-- Quem opera o produto precisa ver o que está acontecendo: quantas pessoas
-- entraram, quantas pagaram, quantas questões foram respondidas, o que está
-- sendo estudado. Hoje isso só existia no `psql`.
--
-- **Admin não é editor.** `interno.editores` dá acesso às ferramentas de
-- conteúdo; ver dado de pessoa — e-mail, plano, quanto pagou — é outra coisa,
-- e misturar as duas capacidades faria com que dar acesso de escrita a
-- alguém desse, de brinde, a lista de clientes. Mesma razão de os segredos do
-- cron e do webhook serem separados.
--
-- O sinalizador mora em `interno.admins` pelo motivo de sempre: em `perfis`,
-- cuja política é de dono com `with check`, seria uma coluna que a própria
-- pessoa marca como verdadeira do navegador.
--
-- **As métricas saem de funções, não de grants.** Liberar `select` em
-- `auth.users` ou em `respostas` para um papel resolveria em uma linha e
-- deixaria a tabela inteira aberta para qualquer consulta futura. Cada função
-- aqui devolve exatamente o agregado que a tela mostra.
-- ============================================================================

create table if not exists interno.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now()
);
revoke all on interno.admins from public;

create or replace function public.sou_admin()
returns boolean
language sql
stable
security definer
set search_path = public, interno
as $$
  select exists (select 1 from interno.admins a where a.user_id = auth.uid());
$$;

grant execute on function public.sou_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Números do produto
-- ---------------------------------------------------------------------------
create or replace function public.metricas_admin()
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
    raise exception 'não autorizado' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'contas', (select count(*) from auth.users),
    'contas_7d', (
      select count(*) from auth.users where created_at > now() - interval '7 days'
    ),
    'contas_confirmadas', (
      select count(*) from auth.users where email_confirmed_at is not null
    ),
    'assinaturas_ativas', (
      select count(*) from public.assinaturas
       where status = 'ativa' and fim > now()
    ),
    'assinaturas_cortesia', (
      select count(*) from public.assinaturas
       where status = 'ativa' and fim > now() and plano = 'cortesia'
    ),
    -- Receita confirmada, só de produção: cobrança de sandbox no mesmo número
    -- transformaria teste em faturamento.
    'receita_total', coalesce((
      select sum(valor) from public.cobrancas
       where status = 'CONFIRMED' and ambiente = 'producao'
    ), 0),
    'receita_30d', coalesce((
      select sum(valor) from public.cobrancas
       where status = 'CONFIRMED' and ambiente = 'producao'
         and confirmado_em > now() - interval '30 days'
    ), 0),
    'cobrancas_pendentes', (
      select count(*) from public.cobrancas
       where status = 'PENDING' and ambiente = 'producao'
    ),
    'respostas', (select count(*) from public.respostas),
    'respostas_7d', (
      select count(*) from public.respostas
       where respondido_em > now() - interval '7 days'
    ),
    'taxa_acerto', (
      -- Primeira tentativa de cada pessoa em cada questão, pelo mesmo motivo
      -- de `dificuldade_da_questao`: depois de ver o gabarito, acertar de
      -- novo é memória, não conhecimento.
      select round(avg(case when acertou then 100.0 else 0 end), 1)
        from (
          select distinct on (user_id, questao_id) acertou
            from public.respostas
           order by user_id, questao_id, respondido_em
        ) primeiras
    ),
    'questoes_distintas', (
      select count(distinct questao_id) from public.respostas
    ),
    'simulados', (select count(*) from public.simulados),
    'simulados_finalizados', (
      select count(*) from public.simulados where finalizado_em is not null
    ),
    'cartoes_quadro', (select count(*) from public.quadro_nos),
    'acervo_questoes', (select count(*) from public.questoes),
    'acervo_artigos', (select count(*) from public.artigos),
    'acervo_comentados', (
      select count(*) from public.artigos where indexavel
    ),
    'acervo_sumulas', (select count(*) from public.sumulas)
  ) into r;

  return r;
end;
$$;

grant execute on function public.metricas_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Pessoas
--
-- Devolve o que a operação precisa e nada além: e-mail, quando entrou, plano
-- vigente e volume de estudo. Nem CPF, nem telefone, nem id de gateway — a
-- política de privacidade promete que esses dados existem para emitir a
-- cobrança, e uma tela de listagem não é motivo para trafegá-los.
-- ---------------------------------------------------------------------------
create or replace function public.usuarios_admin(
  p_busca text default null,
  p_limite int default 50
)
returns table (
  user_id uuid,
  email text,
  nome text,
  criado_em timestamptz,
  confirmado boolean,
  plano text,
  plano_ate timestamptz,
  respostas bigint,
  acertos bigint,
  ultimo_estudo timestamptz
)
language plpgsql
stable
security definer
set search_path = public, interno, auth
as $$
begin
  if not public.sou_admin() then
    raise exception 'não autorizado' using errcode = '42501';
  end if;

  return query
    select u.id,
           u.email::text,
           coalesce(p.nome, ''),
           u.created_at,
           u.email_confirmed_at is not null,
           a.plano,
           a.fim,
           coalesce(r.total, 0),
           coalesce(r.acertos, 0),
           r.ultimo
      from auth.users u
      left join public.perfis p on p.id = u.id
      left join lateral (
        select s.plano, s.fim
          from public.assinaturas s
         where s.user_id = u.id and s.status = 'ativa' and s.fim > now()
         order by s.fim desc
         limit 1
      ) a on true
      left join lateral (
        select count(*) as total,
               count(*) filter (where x.acertou) as acertos,
               max(x.respondido_em) as ultimo
          from public.respostas x
         where x.user_id = u.id
      ) r on true
     where p_busca is null
        or u.email::text ilike '%' || p_busca || '%'
        or coalesce(p.nome, '') ilike '%' || p_busca || '%'
     order by u.created_at desc
     limit least(greatest(p_limite, 1), 200);
end;
$$;

grant execute on function public.usuarios_admin(text, int) to authenticated;

-- ---------------------------------------------------------------------------
-- O que está sendo estudado
-- ---------------------------------------------------------------------------
create or replace function public.atividade_admin()
returns table (dia date, respostas bigint, pessoas bigint)
language plpgsql
stable
security definer
set search_path = public, interno
as $$
begin
  if not public.sou_admin() then
    raise exception 'não autorizado' using errcode = '42501';
  end if;

  return query
    select d::date,
           count(r.id),
           count(distinct r.user_id)
      from generate_series(
             (now() - interval '29 days')::date, now()::date, interval '1 day'
           ) d
      left join public.respostas r
        on r.respondido_em >= d and r.respondido_em < d + interval '1 day'
     group by d
     order by d;
end;
$$;

grant execute on function public.atividade_admin() to authenticated;

create or replace function public.disciplinas_admin()
returns table (nome text, respostas bigint, acertos bigint)
language plpgsql
stable
security definer
set search_path = public, interno
as $$
begin
  if not public.sou_admin() then
    raise exception 'não autorizado' using errcode = '42501';
  end if;

  return query
    select d.nome,
           count(r.id),
           count(*) filter (where r.acertou)
      from public.respostas r
      join public.questoes q on q.id = r.questao_id
      join public.disciplinas d on d.id = q.disciplina_id
     group by d.nome
     order by count(r.id) desc;
end;
$$;

grant execute on function public.disciplinas_admin() to authenticated;
