-- ============================================================================
-- Radar de alteracoes legislativas.
--
-- Uma nova redacao oficial nao pode sobrescrever um comentario autoral, mas
-- tambem nao pode deixar a pagina servindo lei antiga. A carga guarda a
-- fotografia anterior, atualiza o ato oficial, fecha o portao de indexacao e
-- abre uma revisao humana com o comentario antigo preservado como rascunho.
-- ============================================================================

create table public.alteracoes_legislativas (
  id uuid primary key default gen_random_uuid(),
  artigo_id uuid not null references public.artigos(id) on delete cascade,
  caput_anterior text not null,
  paragrafos_anteriores text[] not null default '{}',
  caput_novo text not null,
  paragrafos_novos text[] not null default '{}',
  comentario_anterior text[] not null default '{}',
  indexavel_anterior boolean not null default false,
  status text not null default 'pendente'
    check (status in ('pendente', 'resolvida', 'informativa')),
  detectada_em timestamptz not null default now(),
  resolvida_em timestamptz,
  resolvida_por uuid references auth.users(id) on delete set null
);

create index alteracoes_legislativas_fila_idx
  on public.alteracoes_legislativas (status, detectada_em desc);
create unique index alteracoes_legislativas_uma_pendente_idx
  on public.alteracoes_legislativas (artigo_id)
  where status = 'pendente';

create or replace function public.artigo_aguarda_revisao_legal()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.comentario <> '{}' and exists (
    select 1 from public.alteracoes_legislativas alteracao
     where alteracao.artigo_id = new.id and alteracao.status = 'pendente'
  ) then
    raise exception 'alteracao legal pendente; revise pelo radar antes de publicar'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger artigo_aguarda_revisao_legal
  before update of comentario, indexavel on public.artigos
  for each row execute function public.artigo_aguarda_revisao_legal();

alter table public.alteracoes_legislativas enable row level security;
-- O projeto concede privilegios de tabela por padrao. Revogar explicitamente
-- evita que uma policy futura abra acesso direto por acidente.
revoke all on public.alteracoes_legislativas from public, anon, authenticated;
-- Sem policy: carga e funcoes estreitas sao as unicas portas.

create table public.destaques_legais_anteriores (
  destaque_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  artigo_id uuid not null references public.artigos(id) on delete cascade,
  inicio integer not null,
  fim integer not null,
  trecho text not null,
  cor text not null,
  arquivado_em timestamptz not null default now()
);

alter table public.destaques_legais_anteriores enable row level security;
revoke all on public.destaques_legais_anteriores from public, anon, authenticated;
create policy dono on public.destaques_legais_anteriores
  for select using (auth.uid() = user_id);
grant select on public.destaques_legais_anteriores to authenticated;

create or replace function public.carregar_artigos_oficiais(
  p_lei_slug text,
  p_disciplina_slug text,
  p_artigos jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if jsonb_typeof(p_artigos) <> 'array' or jsonb_array_length(p_artigos) > 500 then
    raise exception 'lote de artigos invalido' using errcode = '22023';
  end if;

  -- Se uma segunda mudanca oficial chegar antes da revisao humana, a mesma
  -- pendencia acompanha a redacao mais recente. A fotografia anterior e o
  -- comentario original continuam intactos.
  with oficiais as (
    select
      l.id as lei_id,
      d.id as disciplina_id,
      o.numero,
      o.slug,
      o.caput,
      coalesce(o.paragrafos, '{}'::text[]) as paragrafos,
      o.ordem
    from jsonb_to_recordset(p_artigos) as o(
      numero text, slug text, caput text, paragrafos text[], ordem integer
    )
    cross join public.leis l
    left join public.disciplinas d on d.slug = p_disciplina_slug
    where l.slug = p_lei_slug
  )
  update public.alteracoes_legislativas alteracao
     set caput_novo = oficial.caput,
         paragrafos_novos = oficial.paragrafos,
         detectada_em = now()
    from oficiais oficial
    join public.artigos artigo
      on artigo.lei_id = oficial.lei_id and artigo.slug = oficial.slug
   where alteracao.artigo_id = artigo.id
     and alteracao.status = 'pendente'
     and (artigo.caput is distinct from oficial.caput
       or artigo.paragrafos is distinct from oficial.paragrafos);

  with oficiais as (
    select
      l.id as lei_id,
      d.id as disciplina_id,
      o.numero,
      o.slug,
      o.caput,
      coalesce(o.paragrafos, '{}'::text[]) as paragrafos,
      o.ordem
    from jsonb_to_recordset(p_artigos) as o(
      numero text, slug text, caput text, paragrafos text[], ordem integer
    )
    cross join public.leis l
    left join public.disciplinas d on d.slug = p_disciplina_slug
    where l.slug = p_lei_slug
  )
  insert into public.alteracoes_legislativas (
    artigo_id, caput_anterior, paragrafos_anteriores, caput_novo,
    paragrafos_novos, comentario_anterior, indexavel_anterior
  )
  select
    artigo.id, artigo.caput, artigo.paragrafos, oficial.caput,
    oficial.paragrafos, artigo.comentario, artigo.indexavel
  from oficiais oficial
  join public.artigos artigo
    on artigo.lei_id = oficial.lei_id and artigo.slug = oficial.slug
  where artigo.comentario <> '{}'
    and (artigo.caput is distinct from oficial.caput
      or artigo.paragrafos is distinct from oficial.paragrafos)
    and not exists (
      select 1 from public.alteracoes_legislativas pendente
       where pendente.artigo_id = artigo.id and pendente.status = 'pendente'
    );

  -- Artigo sem comentario nao precisa de editor, mas quem o guardou no
  -- caderno ou fez flashcard precisa saber que a fonte mudou.
  with oficiais as (
    select
      l.id as lei_id,
      o.slug,
      o.caput,
      coalesce(o.paragrafos, '{}'::text[]) as paragrafos
    from jsonb_to_recordset(p_artigos) as o(
      numero text, slug text, caput text, paragrafos text[], ordem integer
    )
    cross join public.leis l
    where l.slug = p_lei_slug
  )
  insert into public.alteracoes_legislativas (
    artigo_id, caput_anterior, paragrafos_anteriores, caput_novo,
    paragrafos_novos, comentario_anterior, indexavel_anterior, status
  )
  select
    artigo.id, artigo.caput, artigo.paragrafos, oficial.caput,
    oficial.paragrafos, '{}'::text[], false, 'informativa'
  from oficiais oficial
  join public.artigos artigo
    on artigo.lei_id = oficial.lei_id and artigo.slug = oficial.slug
  where artigo.comentario = '{}'
    and (artigo.caput is distinct from oficial.caput
      or artigo.paragrafos is distinct from oficial.paragrafos)
    and (exists (
      select 1 from public.caderno_lei_seca caderno
       where caderno.artigo_id = artigo.id
    ) or exists (
      select 1 from public.flashcards cartao
       where cartao.artigo_id = artigo.id
    ))
    and not exists (
      select 1 from public.alteracoes_legislativas pendente
       where pendente.artigo_id = artigo.id and pendente.status = 'pendente'
    );

  with oficiais as (
    select
      l.id as lei_id,
      d.id as disciplina_id,
      o.numero,
      o.slug,
      o.caput,
      coalesce(o.paragrafos, '{}'::text[]) as paragrafos,
      o.ordem
    from jsonb_to_recordset(p_artigos) as o(
      numero text, slug text, caput text, paragrafos text[], ordem integer
    )
    cross join public.leis l
    left join public.disciplinas d on d.slug = p_disciplina_slug
    where l.slug = p_lei_slug
  )
  insert into public.artigos (
    lei_id, disciplina_id, numero, slug, caput, paragrafos, ordem
  )
  select
    lei_id, disciplina_id, numero, slug, caput, paragrafos, ordem
  from oficiais
  on conflict (lei_id, slug) do update set
    disciplina_id = excluded.disciplina_id,
    numero = excluded.numero,
    caput = excluded.caput,
    paragrafos = excluded.paragrafos,
    ordem = excluded.ordem,
    -- O comentario antigo ja esta na fila. A pagina passa a mostrar somente
    -- o ato oficial atual e sai do indice ate a revisao ser publicada.
    comentario = case
      when (public.artigos.caput is distinct from excluded.caput
         or public.artigos.paragrafos is distinct from excluded.paragrafos)
       and public.artigos.comentario <> '{}'
      then '{}'::text[]
      else public.artigos.comentario
    end,
    indexavel = case
      when (public.artigos.caput is distinct from excluded.caput
         or public.artigos.paragrafos is distinct from excluded.paragrafos)
       and public.artigos.comentario <> '{}'
      then false
      else public.artigos.indexavel
    end,
    atualizado_em = case
      when public.artigos.caput is distinct from excluded.caput
        or public.artigos.paragrafos is distinct from excluded.paragrafos
      then now()
      else public.artigos.atualizado_em
    end;

  -- Um destaque cuja posicao nao corresponde mais ao texto novo e guardado
  -- como fotografia recuperavel antes que uma futura edicao do caderno limpe
  -- os destaques ativos. A nota do aluno nunca e tocada.
  insert into public.destaques_legais_anteriores (
    destaque_id, user_id, artigo_id, inicio, fim, trecho, cor
  )
  select destaque.id, destaque.user_id, destaque.artigo_id,
         destaque.inicio, destaque.fim, destaque.trecho, destaque.cor
    from public.caderno_lei_destaques destaque
    join public.artigos artigo on artigo.id = destaque.artigo_id
    join public.alteracoes_legislativas alteracao
      on alteracao.artigo_id = artigo.id
     and alteracao.status in ('pendente', 'informativa')
   where substring(
     artigo.caput || case
       when cardinality(artigo.paragrafos) > 0
       then E'\n\n' || array_to_string(artigo.paragrafos, E'\n\n')
       else ''
     end
     from destaque.inicio + 1 for destaque.fim - destaque.inicio
   ) is distinct from destaque.trecho
  on conflict (destaque_id) do nothing;

  -- Um cartao baseado em trecho que nao consta mais no ato oficial nao pode
  -- continuar voltando na fila de revisao. O cartao e seu historico ficam
  -- preservados para a pessoa adaptar a propria pergunta depois.
  update public.flashcards cartao
     set suspenso = true
    from public.alteracoes_legislativas alteracao
    join public.artigos artigo on artigo.id = alteracao.artigo_id
   where cartao.artigo_id = artigo.id
     and alteracao.status in ('pendente', 'informativa')
     and cartao.trecho_fonte <> ''
     and position(
       cartao.trecho_fonte in
       (artigo.caput || E'\n\n' || array_to_string(artigo.paragrafos, E'\n\n'))
     ) = 0;
end;
$$;

revoke execute on function public.carregar_artigos_oficiais(text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.carregar_artigos_oficiais(text, text, jsonb)
  to service_role;

create or replace function public.fila_alteracoes_legislativas()
returns table (
  id uuid,
  artigo_id uuid,
  lei_slug text,
  lei_sigla text,
  artigo_slug text,
  numero text,
  caput_anterior text,
  paragrafos_anteriores text[],
  caput_novo text,
  paragrafos_novos text[],
  comentario_anterior text[],
  indexavel_anterior boolean,
  detectada_em timestamptz
)
language plpgsql
stable
security definer
set search_path = public, interno
as $$
begin
  if not public.sou_editor() then
    raise exception 'nao autorizado' using errcode = '42501';
  end if;

  return query
  select alteracao.id, artigo.id, lei.slug, lei.sigla, artigo.slug, artigo.numero,
         alteracao.caput_anterior, alteracao.paragrafos_anteriores,
         alteracao.caput_novo, alteracao.paragrafos_novos,
         alteracao.comentario_anterior, alteracao.indexavel_anterior,
         alteracao.detectada_em
    from public.alteracoes_legislativas alteracao
    join public.artigos artigo on artigo.id = alteracao.artigo_id
    join public.leis lei on lei.id = artigo.lei_id
   where alteracao.status = 'pendente'
   order by alteracao.detectada_em, lei.sigla, artigo.ordem;
end;
$$;

revoke execute on function public.fila_alteracoes_legislativas()
  from public, anon;
grant execute on function public.fila_alteracoes_legislativas()
  to authenticated;

create or replace function public.resolver_alteracao_legislativa(
  p_alteracao uuid,
  p_comentario text[],
  p_indexavel boolean
)
returns void
language plpgsql
security definer
set search_path = public, interno
as $$
declare
  v_artigo uuid;
begin
  if not public.sou_editor() then
    raise exception 'nao autorizado' using errcode = '42501';
  end if;
  if coalesce(p_indexavel, false) and cardinality(coalesce(p_comentario, '{}')) = 0 then
    raise exception 'pagina indexavel exige comentario revisado' using errcode = '23514';
  end if;

  select artigo_id into v_artigo
    from public.alteracoes_legislativas
   where id = p_alteracao and status = 'pendente'
   for update;
  if not found then
    raise exception 'alteracao nao encontrada' using errcode = '22023';
  end if;

  update public.alteracoes_legislativas
     set status = 'resolvida',
         resolvida_em = now(),
         resolvida_por = auth.uid()
   where id = p_alteracao;

  update public.artigos
     set comentario = coalesce(p_comentario, '{}'),
         indexavel = coalesce(p_indexavel, false),
         atualizado_em = now()
   where id = v_artigo;
end;
$$;

revoke execute on function public.resolver_alteracao_legislativa(uuid, text[], boolean)
  from public, anon;
grant execute on function public.resolver_alteracao_legislativa(uuid, text[], boolean)
  to authenticated;

-- Aviso individual sem duplicar notificacoes: a relacao com o aluno ja esta
-- no caderno. Enquanto a alteracao existir no historico, o artigo pode dizer
-- que sua redacao mudou depois de ter sido guardado.
create or replace function public.minhas_alteracoes_legislativas()
returns table (
  artigo_id uuid,
  lei_slug text,
  lei_sigla text,
  artigo_slug text,
  numero text,
  detectada_em timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (artigo.id)
         artigo.id, lei.slug, lei.sigla, artigo.slug, artigo.numero,
         alteracao.detectada_em
    from public.caderno_lei_seca caderno
    join public.artigos artigo on artigo.id = caderno.artigo_id
    join public.leis lei on lei.id = artigo.lei_id
    join public.alteracoes_legislativas alteracao
      on alteracao.artigo_id = artigo.id
   where caderno.user_id = auth.uid()
     and alteracao.detectada_em >= caderno.criado_em
   order by artigo.id, alteracao.detectada_em desc;
$$;

revoke execute on function public.minhas_alteracoes_legislativas()
  from public, anon;
grant execute on function public.minhas_alteracoes_legislativas()
  to authenticated;

-- O caderno mostra somente destaques cuja posicao ainda casa com a redacao
-- atual. Os antigos permanecem no arquivo acima e nao impedem salvar notas.
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
      'artigoId', artigo.id,
      'nota', coalesce(caderno.nota, ''),
      'lido', caderno.lido_em is not null,
      'revisarEm', caderno.revisar_em,
      'favorito', coalesce(caderno.favorito, false),
      'importantePara', coalesce(caderno.importante_para, ''),
      'vistoEmQuestao', coalesce(caderno.visto_em_questao, false),
      'destaques', coalesce((
        select jsonb_agg(jsonb_build_object(
          'inicio', destaque.inicio,
          'fim', destaque.fim,
          'trecho', destaque.trecho,
          'cor', destaque.cor
        ) order by destaque.inicio)
        from public.caderno_lei_destaques destaque
        where destaque.user_id = auth.uid()
          and destaque.artigo_id = artigo.id
          and substring(
            artigo.caput || case
              when cardinality(artigo.paragrafos) > 0
              then E'\n\n' || array_to_string(artigo.paragrafos, E'\n\n')
              else ''
            end
            from destaque.inicio + 1 for destaque.fim - destaque.inicio
          ) = destaque.trecho
      ), '[]'::jsonb)
    )
  end
  from public.artigos artigo
  join public.leis lei on lei.id = artigo.lei_id
  left join public.caderno_lei_seca caderno
    on caderno.user_id = auth.uid() and caderno.artigo_id = artigo.id
  where lei.slug = p_lei_slug and artigo.slug = p_artigo_slug;
$$;
