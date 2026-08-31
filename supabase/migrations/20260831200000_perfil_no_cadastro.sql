-- ============================================================================
-- Criação automática do perfil no cadastro.
--
-- `perfis` referencia `auth.users`, mas a aplicação não tem — e não deve ter
-- — permissão para escrever ali no momento do signup: nesse instante ainda
-- não existe sessão, então `auth.uid()` é nulo e qualquer política de dono
-- barraria a inserção. O caminho correto é o banco reagir ao próprio evento.
-- ============================================================================

create or replace function public.criar_perfil_no_cadastro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfis (id, nome)
  values (new.id, nullif(trim(new.raw_user_meta_data ->> 'nome'), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists criar_perfil_apos_signup on auth.users;

create trigger criar_perfil_apos_signup
  after insert on auth.users
  for each row execute function public.criar_perfil_no_cadastro();
