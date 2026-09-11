-- ============================================================================
-- Flashcards vinculados à fonte.
--
-- Cartão jurídico aponta para artigo ou súmula do acervo. Sem fonte, a tela
-- o identifica como anotação pessoal. O agendamento é calculado no banco:
-- o navegador informa apenas como a lembrança se comportou nesta revisão.
-- ============================================================================

create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  frente text not null check (
    char_length(btrim(frente)) between 1 and 2000
  ),
  verso text not null check (
    char_length(btrim(verso)) between 1 and 5000
  ),
  artigo_id uuid references public.artigos(id) on delete restrict,
  sumula_id uuid references public.sumulas(id) on delete restrict,
  trecho_fonte text not null default ''
    check (char_length(trecho_fonte) <= 2000),
  proxima_revisao date not null default
    ((now() at time zone 'America/Sao_Paulo')::date),
  intervalo_dias integer not null default 0
    check (intervalo_dias between 0 and 3650),
  facilidade numeric(3,2) not null default 2.50
    check (facilidade between 1.30 and 2.80),
  repeticoes integer not null default 0 check (repeticoes >= 0),
  suspenso boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (user_id, id),
  check (num_nonnulls(artigo_id, sumula_id) <= 1),
  check (artigo_id is not null or sumula_id is not null or trecho_fonte = '')
);

comment on table public.flashcards is
  'Cartões pessoais com repetição espaçada e fonte oficial opcional.';
comment on column public.flashcards.trecho_fonte is
  'Cópia literal validada contra o artigo ou súmula no momento da gravação.';
comment on column public.flashcards.artigo_id is
  'A fonte não pode ser apagada enquanto sustentar um cartão do usuário.';
comment on column public.flashcards.sumula_id is
  'A fonte não pode ser apagada enquanto sustentar um cartão do usuário.';
comment on column public.flashcards.facilidade is
  'Fator de espaçamento entre 1,30 e 2,80; nunca é calculado pelo navegador.';

create table public.flashcard_revisoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  flashcard_id uuid not null,
  avaliacao text not null
    check (avaliacao in ('errei', 'dificil', 'bom', 'facil')),
  intervalo_antes integer not null,
  intervalo_depois integer not null,
  revisado_em timestamptz not null default now(),
  foreign key (user_id, flashcard_id)
    references public.flashcards(user_id, id) on delete cascade
);

comment on table public.flashcard_revisoes is
  'Histórico imutável das avaliações usadas para reagendar cada cartão.';

create index flashcards_fila_idx
  on public.flashcards (user_id, proxima_revisao, criado_em)
  where not suspenso;
create index flashcard_revisoes_historico_idx
  on public.flashcard_revisoes (user_id, revisado_em desc);

create trigger flashcards_touch
  before update on public.flashcards
  for each row execute function public.touch_atualizado_em();

alter table public.flashcards enable row level security;
alter table public.flashcard_revisoes enable row level security;

create policy dono on public.flashcards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy dono on public.flashcard_revisoes
  for select using (auth.uid() = user_id);

grant select, insert, update, delete on public.flashcards to authenticated;
grant select on public.flashcard_revisoes to authenticated;

create or replace function public.salvar_flashcard(
  p_id uuid,
  p_frente text,
  p_verso text,
  p_lei_slug text default null,
  p_artigo_slug text default null,
  p_sumula_slug text default null,
  p_trecho_fonte text default ''
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_artigo_id uuid;
  v_sumula_id uuid;
  v_texto_fonte text;
  v_trecho text := btrim(coalesce(p_trecho_fonte, ''));
begin
  if v_user is null then
    raise exception 'sessão expirada' using errcode = '28000';
  end if;
  if char_length(btrim(coalesce(p_frente, ''))) not between 1 and 2000
     or char_length(btrim(coalesce(p_verso, ''))) not between 1 and 5000 then
    raise exception 'frente ou verso inválido' using errcode = '22023';
  end if;
  if char_length(v_trecho) > 2000 then
    raise exception 'trecho da fonte muito longo' using errcode = '22023';
  end if;
  if p_sumula_slug is not null
     and (p_lei_slug is not null or p_artigo_slug is not null) then
    raise exception 'use apenas uma fonte por cartão' using errcode = '22023';
  end if;
  if (p_lei_slug is null) <> (p_artigo_slug is null) then
    raise exception 'referência de artigo incompleta' using errcode = '22023';
  end if;

  if p_lei_slug is not null then
    select
      a.id,
      a.caput || case
        when cardinality(a.paragrafos) > 0
          then E'\n\n' || array_to_string(a.paragrafos, E'\n\n')
        else ''
      end
    into v_artigo_id, v_texto_fonte
    from public.artigos a
    join public.leis l on l.id = a.lei_id
    where l.slug = p_lei_slug and a.slug = p_artigo_slug;
    if not found then
      raise exception 'artigo não encontrado' using errcode = '22023';
    end if;
  elsif p_sumula_slug is not null then
    select s.id, s.texto into v_sumula_id, v_texto_fonte
    from public.sumulas s
    where s.slug = p_sumula_slug;
    if not found then
      raise exception 'súmula não encontrada' using errcode = '22023';
    end if;
  elsif v_trecho <> '' then
    raise exception 'trecho jurídico exige fonte' using errcode = '22023';
  end if;

  if v_trecho <> '' and position(v_trecho in v_texto_fonte) = 0 then
    raise exception 'trecho não corresponde à fonte oficial' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.flashcards (
      user_id, frente, verso, artigo_id, sumula_id, trecho_fonte
    ) values (
      v_user,
      btrim(p_frente),
      btrim(p_verso),
      v_artigo_id,
      v_sumula_id,
      v_trecho
    )
    returning id into v_id;
  else
    update public.flashcards f
       set frente = btrim(p_frente),
           verso = btrim(p_verso),
           artigo_id = v_artigo_id,
           sumula_id = v_sumula_id,
           trecho_fonte = v_trecho
     where f.id = p_id and f.user_id = v_user
    returning id into v_id;
    if v_id is null then
      raise exception 'flashcard não encontrado' using errcode = '22023';
    end if;
  end if;

  return v_id;
end;
$$;

revoke execute on function public.salvar_flashcard(
  uuid, text, text, text, text, text, text
) from public, anon;
grant execute on function public.salvar_flashcard(
  uuid, text, text, text, text, text, text
) to authenticated;

create or replace function public.revisar_flashcard(
  p_flashcard_id uuid,
  p_avaliacao text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_cartao public.flashcards;
  v_intervalo integer;
  v_facilidade numeric(3,2);
  v_repeticoes integer;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if v_user is null then
    raise exception 'sessão expirada' using errcode = '28000';
  end if;
  if p_avaliacao not in ('errei', 'dificil', 'bom', 'facil') then
    raise exception 'avaliação inválida' using errcode = '22023';
  end if;

  select * into v_cartao
  from public.flashcards f
  where f.id = p_flashcard_id and f.user_id = v_user
  for update;
  if not found then
    raise exception 'flashcard não encontrado' using errcode = '22023';
  end if;

  if p_avaliacao = 'errei' then
    v_intervalo := 1;
    v_facilidade := greatest(1.30, v_cartao.facilidade - 0.20);
    v_repeticoes := 0;
  elsif p_avaliacao = 'dificil' then
    v_intervalo := greatest(
      1,
      round(greatest(1, v_cartao.intervalo_dias) * 1.20)::integer
    );
    v_facilidade := greatest(1.30, v_cartao.facilidade - 0.15);
    v_repeticoes := v_cartao.repeticoes + 1;
  elsif p_avaliacao = 'bom' then
    v_intervalo := case
      when v_cartao.repeticoes = 0 then 1
      when v_cartao.repeticoes = 1 then 3
      else round(
        greatest(1, v_cartao.intervalo_dias) * v_cartao.facilidade
      )::integer
    end;
    v_facilidade := v_cartao.facilidade;
    v_repeticoes := v_cartao.repeticoes + 1;
  else
    v_intervalo := case
      when v_cartao.repeticoes = 0 then 4
      else round(
        greatest(1, v_cartao.intervalo_dias) *
        least(2.80, v_cartao.facilidade + 0.30)
      )::integer
    end;
    v_facilidade := least(2.80, v_cartao.facilidade + 0.10);
    v_repeticoes := v_cartao.repeticoes + 1;
  end if;

  v_intervalo := least(3650, v_intervalo);

  update public.flashcards
     set proxima_revisao = v_hoje + v_intervalo,
         intervalo_dias = v_intervalo,
         facilidade = v_facilidade,
         repeticoes = v_repeticoes
   where id = v_cartao.id;

  insert into public.flashcard_revisoes (
    user_id, flashcard_id, avaliacao, intervalo_antes, intervalo_depois
  ) values (
    v_user, v_cartao.id, p_avaliacao,
    v_cartao.intervalo_dias, v_intervalo
  );

  return jsonb_build_object(
    'proximaRevisao', v_hoje + v_intervalo,
    'intervaloDias', v_intervalo,
    'facilidade', v_facilidade,
    'repeticoes', v_repeticoes
  );
end;
$$;

revoke execute on function public.revisar_flashcard(uuid, text)
  from public, anon;
grant execute on function public.revisar_flashcard(uuid, text)
  to authenticated;

create or replace function public.listar_meus_flashcards()
returns table (
  id uuid,
  frente text,
  verso text,
  trecho_fonte text,
  proxima_revisao date,
  intervalo_dias integer,
  facilidade numeric,
  repeticoes integer,
  suspenso boolean,
  criado_em timestamptz,
  atualizado_em timestamptz,
  lei_slug text,
  lei_sigla text,
  artigo_slug text,
  artigo_numero text,
  sumula_slug text,
  sumula_numero integer,
  sumula_vinculante boolean,
  revisoes_total integer
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    f.id,
    f.frente,
    f.verso,
    f.trecho_fonte,
    f.proxima_revisao,
    f.intervalo_dias,
    f.facilidade,
    f.repeticoes,
    f.suspenso,
    f.criado_em,
    f.atualizado_em,
    l.slug,
    l.sigla,
    a.slug,
    a.numero,
    s.slug,
    s.numero,
    s.vinculante,
    (select count(*)::integer
       from public.flashcard_revisoes r
      where r.user_id = f.user_id and r.flashcard_id = f.id)
  from public.flashcards f
  left join public.artigos a on a.id = f.artigo_id
  left join public.leis l on l.id = a.lei_id
  left join public.sumulas s on s.id = f.sumula_id
  where f.user_id = auth.uid()
  order by
    (not f.suspenso and f.proxima_revisao <=
      (now() at time zone 'America/Sao_Paulo')::date) desc,
    f.proxima_revisao,
    f.atualizado_em desc
  limit 1000;
$$;

revoke execute on function public.listar_meus_flashcards()
  from public, anon;
grant execute on function public.listar_meus_flashcards()
  to authenticated;
