-- ============================================================================
-- Suporte: ticket com conversa.
--
-- Até aqui, quem tinha problema tinha o endereço de e-mail do rodapé. Isso
-- funciona no primeiro cliente e deixa de funcionar no décimo: some no meio
-- da caixa de entrada, ninguém sabe o que está aberto, e a pessoa que pagou
-- não tem onde ver que foi respondida.
--
-- Duas tabelas, e não uma: o ticket é o assunto, e as mensagens são a
-- conversa. Guardar a resposta como uma coluna `resposta` no ticket
-- funcionaria exatamente uma vez.
--
-- **Quem lê é o dono ou o admin.** Não existe grant amplo: `authenticated`
-- vê o próprio ticket pela política de dono, e `sou_admin()` abre o resto.
-- Suporte é o lugar onde a pessoa cola print, número de cartão errado e
-- desabafo — tratar como dado privado é o mínimo.
-- ============================================================================

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  assunto text not null check (length(btrim(assunto)) between 3 and 140),

  -- 'aberto' enquanto espera a equipe; 'respondido' quando a equipe falou por
  -- último; 'fechado' quando acabou. O estado é derivável da conversa, mas
  -- derivar a cada listagem custaria uma agregação por linha.
  status text not null default 'aberto'
    check (status in ('aberto', 'respondido', 'fechado')),

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists tickets_dono_idx
  on public.tickets (user_id, atualizado_em desc);
create index if not exists tickets_status_idx
  on public.tickets (status, atualizado_em desc);

create table if not exists public.ticket_mensagens (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  autor_id uuid not null references auth.users(id) on delete cascade,

  -- Quem falou, do ponto de vista de quem lê. Guardado na linha porque a
  -- resposta continua sendo "da equipe" mesmo que a conta que respondeu
  -- perca o papel de admin depois.
  da_equipe boolean not null default false,

  corpo text not null check (length(btrim(corpo)) between 1 and 5000),
  criado_em timestamptz not null default now()
);

create index if not exists ticket_mensagens_idx
  on public.ticket_mensagens (ticket_id, criado_em);

alter table public.tickets          enable row level security;
alter table public.ticket_mensagens enable row level security;

create policy dono_le on public.tickets
  for select using (auth.uid() = user_id or public.sou_admin());
create policy dono_abre on public.tickets
  for insert with check (auth.uid() = user_id);
-- Só a equipe muda status: deixar o dono fechar sozinho é aceitável, deixar
-- reabrir para sempre não — e a diferença entre os dois casos não vale uma
-- coluna a mais hoje.
create policy equipe_atualiza on public.tickets
  for update using (public.sou_admin()) with check (public.sou_admin());

create policy le_do_ticket on public.ticket_mensagens
  for select using (
    exists (
      select 1 from public.tickets t
       where t.id = ticket_id and (t.user_id = auth.uid() or public.sou_admin())
    )
  );

-- `da_equipe` não é escolha de quem escreve: forjá-lo faria uma mensagem de
-- cliente aparecer como resposta oficial na tela do próprio cliente.
create policy escreve_no_ticket on public.ticket_mensagens
  for insert with check (
    autor_id = auth.uid()
    and da_equipe = public.sou_admin()
    and exists (
      select 1 from public.tickets t
       where t.id = ticket_id and (t.user_id = auth.uid() or public.sou_admin())
    )
  );

grant select, insert on public.tickets to authenticated;
grant update on public.tickets to authenticated;
grant select, insert on public.ticket_mensagens to authenticated;

-- ---------------------------------------------------------------------------
-- Abrir ticket
--
-- Função em vez de dois inserts do navegador porque ticket sem a primeira
-- mensagem é um estado que não deveria existir nem por um instante — e dois
-- inserts separados criam exatamente isso quando o segundo falha.
-- ---------------------------------------------------------------------------
create or replace function public.abrir_ticket(p_assunto text, p_corpo text)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.tickets (user_id, assunto)
  values (auth.uid(), p_assunto)
  returning id into v_id;

  insert into public.ticket_mensagens (ticket_id, autor_id, da_equipe, corpo)
  values (v_id, auth.uid(), false, p_corpo);

  return v_id;
end;
$$;

grant execute on function public.abrir_ticket(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Responder
--
-- Uma função para os dois lados: quem responde define o status seguinte.
-- Resposta da equipe deixa o ticket 'respondido'; réplica do cliente o
-- devolve para 'aberto', que é o que faz a fila da equipe significar alguma
-- coisa.
-- ---------------------------------------------------------------------------
create or replace function public.responder_ticket(p_ticket uuid, p_corpo text)
returns void
language plpgsql
security definer
set search_path = public, interno
as $$
declare
  v_equipe boolean := public.sou_admin();
  v_dono uuid;
begin
  select user_id into v_dono from public.tickets where id = p_ticket;
  if v_dono is null then
    raise exception 'ticket não encontrado' using errcode = '22023';
  end if;
  if not v_equipe and v_dono <> auth.uid() then
    raise exception 'não autorizado' using errcode = '42501';
  end if;

  insert into public.ticket_mensagens (ticket_id, autor_id, da_equipe, corpo)
  values (p_ticket, auth.uid(), v_equipe, p_corpo);

  update public.tickets
     set status = case when v_equipe then 'respondido' else 'aberto' end,
         atualizado_em = now()
   where id = p_ticket;
end;
$$;

grant execute on function public.responder_ticket(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Dados para o aviso por e-mail
--
-- A rota precisa do e-mail de quem abriu para citar na mensagem que chega
-- para a equipe, e do e-mail do dono para avisá-lo quando a equipe responde.
-- `auth.users` não é legível pelo papel autenticado — e não deve ser.
-- ---------------------------------------------------------------------------
create or replace function public.dados_do_ticket(p_ticket uuid)
returns table (assunto text, status text, dono_email text, dono_nome text)
language plpgsql
stable
security definer
set search_path = public, interno, auth
as $$
begin
  if not exists (
    select 1 from public.tickets t
     where t.id = p_ticket and (t.user_id = auth.uid() or public.sou_admin())
  ) then
    raise exception 'não autorizado' using errcode = '42501';
  end if;

  return query
    select t.assunto, t.status, u.email::text, coalesce(p.nome, '')
      from public.tickets t
      join auth.users u on u.id = t.user_id
      left join public.perfis p on p.id = t.user_id
     where t.id = p_ticket;
end;
$$;

grant execute on function public.dados_do_ticket(uuid) to authenticated;
