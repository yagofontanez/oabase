-- ============================================================================
-- Caderno pessoal de lei seca.
--
-- O texto legal continua vindo de `artigos`: o caderno guarda somente a
-- interação do aluno com a fonte. Trecho e posição ficam juntos para que um
-- destaque possa reaparecer em qualquer tela que recomende o mesmo artigo.
-- ============================================================================

create table public.caderno_lei_seca (
  user_id uuid not null references auth.users(id) on delete cascade,
  artigo_id uuid not null references public.artigos(id) on delete cascade,
  nota text not null default '' check (char_length(nota) <= 5000),
  lido_em timestamptz,
  revisar_em date,
  favorito boolean not null default false,
  importante_para text not null default ''
    check (char_length(importante_para) <= 160),
  visto_em_questao boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (user_id, artigo_id)
);

comment on table public.caderno_lei_seca is
  'Estado pessoal de leitura, revisão e anotação de um artigo do acervo.';
comment on column public.caderno_lei_seca.visto_em_questao is
  'Marcação declarada pelo aluno; não substitui a incidência verificável do acervo.';

create table public.caderno_lei_destaques (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  artigo_id uuid not null,
  inicio integer not null check (inicio >= 0),
  fim integer not null check (fim > inicio),
  trecho text not null check (
    char_length(trecho) between 1 and 1000
    and char_length(trecho) = fim - inicio
  ),
  cor text not null default 'amarelo'
    check (cor in ('amarelo', 'verde', 'rosa')),
  criado_em timestamptz not null default now(),
  foreign key (user_id, artigo_id)
    references public.caderno_lei_seca(user_id, artigo_id) on delete cascade,
  unique (user_id, artigo_id, inicio, fim)
);

comment on table public.caderno_lei_destaques is
  'Trechos literais destacados; os deslocamentos são zero-based no texto completo do artigo.';

create index caderno_lei_seca_usuario_idx
  on public.caderno_lei_seca (user_id, atualizado_em desc);
create index caderno_lei_seca_revisao_idx
  on public.caderno_lei_seca (user_id, revisar_em)
  where revisar_em is not null;
create index caderno_lei_destaques_artigo_idx
  on public.caderno_lei_destaques (user_id, artigo_id, inicio);

create trigger caderno_lei_seca_touch
  before update on public.caderno_lei_seca
  for each row execute function public.touch_atualizado_em();

alter table public.caderno_lei_seca enable row level security;
alter table public.caderno_lei_destaques enable row level security;

create policy dono on public.caderno_lei_seca
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy dono on public.caderno_lei_destaques
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.caderno_lei_seca to authenticated;
grant select, insert, update, delete on public.caderno_lei_destaques to authenticated;

create or replace function public.meu_caderno_do_artigo(
  p_lei_slug text,
  p_artigo_slug text
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select case
    when auth.uid() is null then null
    else jsonb_build_object(
      'artigoId', a.id,
      'nota', coalesce(c.nota, ''),
      'lido', c.lido_em is not null,
      'revisarEm', c.revisar_em,
      'favorito', coalesce(c.favorito, false),
      'importantePara', coalesce(c.importante_para, ''),
      'vistoEmQuestao', coalesce(c.visto_em_questao, false),
      'destaques', coalesce((
        select jsonb_agg(jsonb_build_object(
          'inicio', d.inicio,
          'fim', d.fim,
          'trecho', d.trecho,
          'cor', d.cor
        ) order by d.inicio)
        from public.caderno_lei_destaques d
        where d.user_id = auth.uid() and d.artigo_id = a.id
      ), '[]'::jsonb)
    )
  end
  from public.artigos a
  join public.leis l on l.id = a.lei_id
  left join public.caderno_lei_seca c
    on c.user_id = auth.uid() and c.artigo_id = a.id
  where l.slug = p_lei_slug and a.slug = p_artigo_slug;
$$;

revoke execute on function public.meu_caderno_do_artigo(text, text)
  from public, anon;
grant execute on function public.meu_caderno_do_artigo(text, text)
  to authenticated;

create or replace function public.salvar_caderno_do_artigo(
  p_lei_slug text,
  p_artigo_slug text,
  p_nota text,
  p_lido boolean,
  p_revisar_em date,
  p_favorito boolean,
  p_importante_para text,
  p_visto_em_questao boolean,
  p_destaques jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_artigo public.artigos;
  v_texto text;
  v_destaques jsonb := coalesce(p_destaques, '[]'::jsonb);
begin
  if v_user is null then
    raise exception 'sessão expirada' using errcode = '28000';
  end if;

  select a.* into v_artigo
  from public.artigos a
  join public.leis l on l.id = a.lei_id
  where l.slug = p_lei_slug and a.slug = p_artigo_slug;
  if not found then
    raise exception 'artigo não encontrado' using errcode = '22023';
  end if;

  if jsonb_typeof(v_destaques) <> 'array'
     or jsonb_array_length(v_destaques) > 50 then
    raise exception 'destaques inválidos' using errcode = '22023';
  end if;

  v_texto := v_artigo.caput || case
    when cardinality(v_artigo.paragrafos) > 0
      then E'\n\n' || array_to_string(v_artigo.paragrafos, E'\n\n')
    else ''
  end;

  if exists (
    select 1
    from jsonb_to_recordset(v_destaques)
      as d(inicio integer, fim integer, trecho text, cor text)
    where d.inicio is null
       or d.fim is null
       or d.trecho is null
       or d.inicio < 0
       or d.fim <= d.inicio
       or d.fim > char_length(v_texto)
       or char_length(d.trecho) > 1000
       or char_length(d.trecho) <> d.fim - d.inicio
       or substring(v_texto from d.inicio + 1 for d.fim - d.inicio) <> d.trecho
       or d.cor not in ('amarelo', 'verde', 'rosa')
  ) then
    raise exception 'destaque não corresponde ao texto legal' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_destaques) with ordinality as a(valor, ordem)
    join jsonb_array_elements(v_destaques) with ordinality as b(valor, ordem)
      on a.ordem < b.ordem
     and (a.valor ->> 'inicio')::integer < (b.valor ->> 'fim')::integer
     and (b.valor ->> 'inicio')::integer < (a.valor ->> 'fim')::integer
  ) then
    raise exception 'destaques não podem se sobrepor' using errcode = '22023';
  end if;

  -- Desmarcar tudo devolve o artigo ao estado inicial em vez de deixar uma
  -- linha vazia poluindo a biblioteca pessoal.
  if btrim(coalesce(p_nota, '')) = ''
     and not coalesce(p_lido, false)
     and p_revisar_em is null
     and not coalesce(p_favorito, false)
     and btrim(coalesce(p_importante_para, '')) = ''
     and not coalesce(p_visto_em_questao, false)
     and jsonb_array_length(v_destaques) = 0 then
    delete from public.caderno_lei_seca c
    where c.user_id = v_user and c.artigo_id = v_artigo.id;
    return v_artigo.id;
  end if;

  insert into public.caderno_lei_seca (
    user_id, artigo_id, nota, lido_em, revisar_em, favorito,
    importante_para, visto_em_questao
  ) values (
    v_user,
    v_artigo.id,
    left(coalesce(p_nota, ''), 5000),
    case when coalesce(p_lido, false) then now() else null end,
    p_revisar_em,
    coalesce(p_favorito, false),
    left(coalesce(p_importante_para, ''), 160),
    coalesce(p_visto_em_questao, false)
  )
  on conflict (user_id, artigo_id) do update
    set nota = excluded.nota,
        lido_em = case
          when coalesce(p_lido, false)
            then coalesce(public.caderno_lei_seca.lido_em, now())
          else null
        end,
        revisar_em = excluded.revisar_em,
        favorito = excluded.favorito,
        importante_para = excluded.importante_para,
        visto_em_questao = excluded.visto_em_questao;

  delete from public.caderno_lei_destaques d
  where d.user_id = v_user and d.artigo_id = v_artigo.id;

  insert into public.caderno_lei_destaques (
    user_id, artigo_id, inicio, fim, trecho, cor
  )
  select v_user, v_artigo.id, d.inicio, d.fim, d.trecho, d.cor
  from jsonb_to_recordset(v_destaques)
    as d(inicio integer, fim integer, trecho text, cor text);

  return v_artigo.id;
end;
$$;

revoke execute on function public.salvar_caderno_do_artigo(
  text, text, text, boolean, date, boolean, text, boolean, jsonb
) from public, anon;
grant execute on function public.salvar_caderno_do_artigo(
  text, text, text, boolean, date, boolean, text, boolean, jsonb
) to authenticated;

create or replace function public.listar_meu_caderno_lei_seca()
returns table (
  artigo_id uuid,
  lei_slug text,
  lei_nome text,
  lei_sigla text,
  artigo_slug text,
  numero text,
  caput text,
  nota text,
  lido_em timestamptz,
  revisar_em date,
  favorito boolean,
  importante_para text,
  visto_em_questao boolean,
  atualizado_em timestamptz,
  destaques integer
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.artigo_id,
    l.slug,
    l.nome,
    l.sigla,
    a.slug,
    a.numero,
    a.caput,
    c.nota,
    c.lido_em,
    c.revisar_em,
    c.favorito,
    c.importante_para,
    c.visto_em_questao,
    c.atualizado_em,
    (select count(*)::integer from public.caderno_lei_destaques d
      where d.user_id = c.user_id and d.artigo_id = c.artigo_id)
  from public.caderno_lei_seca c
  join public.artigos a on a.id = c.artigo_id
  join public.leis l on l.id = a.lei_id
  where c.user_id = auth.uid()
  order by
    (c.revisar_em is not null and c.revisar_em <= current_date) desc,
    c.favorito desc,
    c.atualizado_em desc;
$$;

revoke execute on function public.listar_meu_caderno_lei_seca()
  from public, anon;
grant execute on function public.listar_meu_caderno_lei_seca()
  to authenticated;
