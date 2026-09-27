-- ============================================================================
-- Nome de quem entra com o Google.
--
-- O cadastro por e-mail grava o nome em `raw_user_meta_data->>'nome'`; o
-- Google grava em `full_name` e `name`. Os dois gatilhos que reagem à conta
-- nova liam só `nome` — o perfil nasceria sem nome e o aviso de cadastro à
-- equipe chegaria "não informado". Agora leem o que houver, nessa ordem.
-- ============================================================================

create or replace function public.criar_perfil_no_cadastro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfis (id, nome)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'nome'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), '')
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.avisar_novo_cadastro()
returns trigger
language plpgsql
security definer
set search_path = public, interno
as $$
declare
  v_url text;
  v_segredo text;
  v_total bigint;
begin
  select valor into v_url from interno.segredos where chave = 'url_aviso_cadastro';
  select valor into v_segredo from interno.segredos where chave = 'cron_email';
  if v_url is null or v_segredo is null then
    return new;
  end if;

  select count(*) into v_total from auth.users;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_segredo
    ),
    body := jsonb_build_object(
      'id', new.id,
      'email', new.email,
      'nome', coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'nome'), ''),
        nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
        nullif(trim(new.raw_user_meta_data ->> 'name'), '')
      ),
      'criado_em', new.created_at,
      'total', v_total
    ),
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  raise warning 'aviso de novo cadastro não enfileirado: %', sqlerrm;
  return new;
end;
$$;

revoke all on function public.avisar_novo_cadastro() from public, anon, authenticated;
