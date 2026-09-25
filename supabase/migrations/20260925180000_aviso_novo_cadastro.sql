-- ============================================================================
-- Aviso à equipe a cada conta nova.
--
-- O cadastro acontece no navegador (`auth.signUp` com a chave anônima), então
-- o aviso não pode sair de lá: uma rota que o navegador chama para "avisar
-- que se cadastrou" seria uma rota que qualquer pessoa chama para mandar
-- e-mail falso à equipe. Quem sabe que uma conta nasceu é o banco — o mesmo
-- lugar em que `criar_perfil_no_cadastro` já reage ao cadastro.
--
-- O gatilho chama /api/tarefas/novo-cadastro por `pg_net`, autenticado pelo
-- segredo `cron_email`: o que ele protege é justamente disparar e-mail, e ele
-- só existe aqui e no servidor. Com o segredo, o corpo da requisição é
-- confiável — ninguém de fora consegue forjar um cadastro que não houve.
--
-- **O aviso nunca derruba o cadastro.** `pg_net` só enfileira a requisição
-- (ela sai depois do commit, fora da transação), e qualquer erro aqui vira
-- warning. Recusar uma conta porque o e-mail interno falhou seria perder a
-- pessoa para avisar que ela chegou.
--
-- **O destino é configuração, não código.** Todo banco nasce com um
-- `cron_email` aleatório, o local inclusive; com a URL fixa aqui, cada
-- cadastro de teste bateria na produção. A URL mora em `interno.segredos`
-- (chave `url_aviso_cadastro`), começa ausente e só a produção a recebe, por
-- SQL — sem ela o gatilho não faz nada. É também o interruptor: ligar depois
-- de a rota estar no ar, desligar apagando a linha.
--
--   insert into interno.segredos (chave, valor)
--   values ('url_aviso_cadastro', 'https://oabase.com.br/api/tarefas/novo-cadastro');
-- ============================================================================

create extension if not exists pg_net with schema extensions;

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
      'nome', nullif(trim(new.raw_user_meta_data ->> 'nome'), ''),
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

-- Função de gatilho não é chamável por RPC, mas não custa fechar a porta.
revoke all on function public.avisar_novo_cadastro() from public, anon, authenticated;

drop trigger if exists avisar_novo_cadastro on auth.users;
create trigger avisar_novo_cadastro
  after insert on auth.users
  for each row execute function public.avisar_novo_cadastro();
