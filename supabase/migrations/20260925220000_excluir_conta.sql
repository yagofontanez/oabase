-- ============================================================================
-- Exclusão de conta pela própria pessoa (LGPD, art. 18, VI).
--
-- Quase tudo que pertence a uma conta cai junto com `auth.users` por CASCADE,
-- e é isso que se quer: histórico de estudo, perfil, quadro, tickets. Duas
-- coisas não podem cair junto, e é por elas que a exclusão é uma função e não
-- um `delete` solto:
--
-- 1. **Cobrança.** A Política de Privacidade promete guardar os dados de
--    cobrança por 5 anos após a transação — guarda fiscal e art. 27 do CDC.
--    `cobrancas` tem CASCADE para `auth.users`; excluir a conta apagaria o
--    registro que a própria política diz que existe. A função copia antes
--    para `interno.cobrancas_retidas`, esquema sem permissão para papel
--    nenhum, com a data em que cada linha pode sair.
--
-- 2. **Fórum.** O CASCADE apagaria os tópicos da pessoa e, com eles, as
--    respostas dos outros — o mesmo defeito que fez a remoção de post virar
--    marca em vez de `delete`. O autor vira "Conta excluída" e a conversa
--    fica.
--
-- A assinatura mensal ativa **não** é cancelada aqui: cancelar é uma chamada
-- à Asaas, que o banco não faz. A função recusa enquanto houver recorrência
-- ativa, e a rota cancela na Asaas antes de chamá-la — excluir a conta com o
-- cartão ainda sendo cobrado é o pior resultado possível desta tela.
-- ============================================================================

create table interno.cobrancas_retidas (
  id uuid primary key,
  -- Sem FK: a conta não existe mais. O id fica para cruzar com a Asaas.
  user_id_original uuid not null,
  email text,
  nome text,
  cpf text,
  plano text not null,
  valor numeric(10, 2) not null,
  ambiente text not null,
  asaas_pagamento_id text not null,
  asaas_assinatura_id text,
  status text not null,
  criado_em timestamptz not null,
  confirmado_em timestamptz,
  retida_em timestamptz not null default now(),
  -- 5 anos contados da transação, não da exclusão.
  excluir_apos timestamptz not null
);

alter table interno.cobrancas_retidas enable row level security;

-- Fórum: o autor pode deixar de existir sem levar a conversa.
alter table public.forum_topicos alter column autor_id drop not null;
alter table public.forum_topicos drop constraint forum_topicos_autor_id_fkey;
alter table public.forum_topicos
  add constraint forum_topicos_autor_id_fkey
  foreign key (autor_id) references auth.users (id) on delete set null;

alter table public.forum_respostas alter column autor_id drop not null;
alter table public.forum_respostas drop constraint forum_respostas_autor_id_fkey;
alter table public.forum_respostas
  add constraint forum_respostas_autor_id_fkey
  foreign key (autor_id) references auth.users (id) on delete set null;

create function public.excluir_minha_conta()
returns void
language plpgsql
security definer
set search_path = public, interno, auth
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'É preciso estar autenticado.' using errcode = '28000';
  end if;

  if exists (
    select 1 from public.recorrencias where user_id = v_uid and status = 'ativa'
  ) then
    raise exception 'Cancele a renovação do plano Mensal antes de excluir a conta.'
      using errcode = '55000';
  end if;

  insert into interno.cobrancas_retidas
    (id, user_id_original, email, nome, cpf, plano, valor, ambiente,
     asaas_pagamento_id, asaas_assinatura_id, status, criado_em,
     confirmado_em, excluir_apos)
  select c.id, c.user_id, u.email, p.nome, p.cpf, c.plano, c.valor, c.ambiente,
         c.asaas_pagamento_id, c.asaas_assinatura_id, c.status, c.criado_em,
         c.confirmado_em, coalesce(c.confirmado_em, c.criado_em) + interval '5 years'
    from public.cobrancas c
    join auth.users u on u.id = c.user_id
    left join public.perfis p on p.id = c.user_id
   where c.user_id = v_uid
  on conflict (id) do nothing;

  update public.forum_topicos set autor_nome = 'Conta excluída' where autor_id = v_uid;
  update public.forum_respostas set autor_nome = 'Conta excluída' where autor_id = v_uid;

  -- O resto cai por CASCADE (e o fórum por SET NULL).
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.excluir_minha_conta() from public, anon;
grant execute on function public.excluir_minha_conta() to authenticated;

-- A retenção tem fim. Roda na tarefa diária de e-mail, que já tem o segredo
-- do cron — uma tarefa agendada nova só para isto seria mais uma peça para
-- esquecer configurada.
create function public.expurgar_cobrancas_retidas(p_segredo text)
returns integer
language plpgsql
security definer
set search_path = public, interno
as $$
declare
  v_n integer;
begin
  perform public.confere_segredo_cron(p_segredo);
  delete from interno.cobrancas_retidas where excluir_apos < now();
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

grant execute on function public.expurgar_cobrancas_retidas(text) to anon, authenticated;
