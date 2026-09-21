-- ============================================================================
-- Lista de interesse — concursos jurídicos
--
-- Esta não é uma tabela de conteúdo nem de produto: recebe só o mínimo para
-- descobrir qual carreira deve orientar a primeira versão. Não há SELECT
-- público, e a inscrição passa por uma função estreita para que a chave
-- anônima nunca ganhe acesso à lista inteira.
-- ============================================================================

create table if not exists public.interesses_concursos (
  email text primary key,
  carreira text not null check (carreira in (
    'tribunais',
    'procuradorias',
    'defensoria-publica',
    'ministerio-publico',
    'delegado-de-policia',
    'ainda-nao-sei'
  )),
  consentido_em timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.interesses_concursos enable row level security;

create trigger interesses_concursos_touch
  before update on public.interesses_concursos
  for each row execute function public.touch_atualizado_em();

-- A função não recebe a origem nem nenhum campo arbitrário: a única origem
-- possível é a landing de concursos. Reinscrever o mesmo e-mail atualiza a
-- carreira escolhida e renova o registro de consentimento, sem criar cópias.
create or replace function public.registrar_interesse_concursos(
  p_email text,
  p_carreira text,
  p_consentiu boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  email_normalizado text := lower(btrim(coalesce(p_email, '')));
  carreira_normalizada text := btrim(coalesce(p_carreira, ''));
begin
  if not p_consentiu then
    raise exception 'É necessário consentir com o recebimento de atualizações.';
  end if;

  if email_normalizado !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'E-mail inválido.';
  end if;

  if carreira_normalizada not in (
    'tribunais',
    'procuradorias',
    'defensoria-publica',
    'ministerio-publico',
    'delegado-de-policia',
    'ainda-nao-sei'
  ) then
    raise exception 'Carreira inválida.';
  end if;

  insert into public.interesses_concursos (email, carreira, consentido_em)
  values (email_normalizado, carreira_normalizada, now())
  on conflict (email) do update
    set carreira = excluded.carreira,
        consentido_em = excluded.consentido_em;
end;
$$;

revoke all on table public.interesses_concursos from anon, authenticated;
revoke all on function public.registrar_interesse_concursos(text, text, boolean) from public;
grant execute on function public.registrar_interesse_concursos(text, text, boolean)
  to anon, authenticated;
