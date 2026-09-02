-- ============================================================================
-- Fórum.
--
-- Aberto a todas as **contas** — não exige assinatura —, e fechado a quem não
-- está logado. A escolha não é de produto, é de sobrevivência do domínio:
-- conteúdo escrito por terceiros, indexável, num site cuja aquisição é 100%
-- orgânica, é a forma mais rápida de ser avaliado como fazenda de conteúdo. E
-- moderar fórum público aberto é um trabalho que ninguém aqui tem. Fica sob
-- `/app`, que já é `noindex` na rota e `Disallow` no robots.
--
-- `autor_nome` é cópia, e de propósito. A alternativa seria juntar com
-- `perfis` na leitura — e `perfis` tem política de dono, então listar o fórum
-- exigiria abrir a tabela de dados pessoais para todo mundo. O nome no
-- momento da publicação também é o que a pessoa quis assinar naquele dia.
--
-- Remoção é marca, não `delete`: apagar a linha some com a resposta que
-- citava ela e reabre a discussão do zero. `removido` esvazia o conteúdo na
-- tela e mantém o fio.
-- ============================================================================

create table if not exists public.forum_topicos (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null references auth.users(id) on delete cascade,
  autor_nome text not null default '',

  titulo text not null check (length(btrim(titulo)) between 5 and 140),
  corpo  text not null check (length(btrim(corpo)) between 10 and 8000),

  disciplina_id uuid references public.disciplinas(id) on delete set null,

  respostas int not null default 0,
  fixado   boolean not null default false,
  trancado boolean not null default false,
  removido boolean not null default false,

  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists forum_topicos_recentes_idx
  on public.forum_topicos (fixado desc, atualizado_em desc);
create index if not exists forum_topicos_disciplina_idx
  on public.forum_topicos (disciplina_id, atualizado_em desc);

create table if not exists public.forum_respostas (
  id uuid primary key default gen_random_uuid(),
  topico_id uuid not null references public.forum_topicos(id) on delete cascade,
  autor_id uuid not null references auth.users(id) on delete cascade,
  autor_nome text not null default '',

  corpo text not null check (length(btrim(corpo)) between 2 and 8000),
  removido boolean not null default false,

  criado_em timestamptz not null default now()
);

create index if not exists forum_respostas_idx
  on public.forum_respostas (topico_id, criado_em);

-- ---------------------------------------------------------------------------
-- Filtro de linguagem
--
-- Duas decisões que definem se um filtro presta:
--
-- 1. **Comparar por palavra inteira, sobre texto normalizado.** Procurar
--    trecho dentro de palavra é como se produz o clássico constrangimento de
--    barrar "assumir" por conter "cu" — e numa base jurídica, cheia de termos
--    latinos, isso aconteceria no primeiro dia.
-- 2. **Normalizar antes de comparar**: minúsculas, sem acento, com os
--    substitutos óbvios de teclado (@ por a, 0 por o, 1 por i, 3 por e, 4 por
--    a, 5 por s, $ por s) e sem letra repetida. Não fecha todos os desvios —
--    nenhum filtro fecha —, mas fecha os que aparecem de fato.
--
-- A lista mora em `interno`, sem permissão para papel nenhum: é a única forma
-- de ninguém a ler pelo PostgREST e usá-la como dicionário de contorno.
-- ---------------------------------------------------------------------------
create table if not exists interno.palavras_bloqueadas (
  palavra text primary key
);
revoke all on interno.palavras_bloqueadas from public;

insert into interno.palavras_bloqueadas (palavra) values
  ('caralho'), ('porra'), ('buceta'), ('boceta'), ('foda'), ('foder'),
  ('fodase'), ('puta'), ('putaria'), ('piranha'), ('vagabunda'),
  ('viado'), ('veado'), ('bicha'), ('paneleiro'), ('traveco'),
  ('macaco'), ('macaca'), ('preto imundo'), ('crioulo'),
  ('retardado'), ('mongoloide'), ('aleijado'),
  ('arrombado'), ('otario'), ('babaca'), ('escroto'), ('desgraçado'),
  ('desgracado'), ('merda'), ('bosta'), ('cacete'), ('pinto'), ('pau no cu'),
  ('cu'), ('cuzao'), ('cuzinho'), ('rola'), ('punheta'), ('siririca'),
  ('vsf'), ('vtnc'), ('fdp'), ('pqp'), ('krl'),
  ('corno'), ('chupa'), ('gozar na'), ('estupra'), ('pedofilo')
on conflict do nothing;

-- `unaccent` é extensão e nem sempre está no schema esperado; para as letras
-- do português a tradução direta resolve e não traz dependência nenhuma.
create or replace function public.unaccent_simples(p_texto text)
returns text
language sql
immutable
as $$
  select translate(
    p_texto,
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
  );
$$;

create or replace function public.normalizar_texto(p_texto text)
returns text
language sql
immutable
as $$
  select regexp_replace(
           regexp_replace(
             translate(
               lower(public.unaccent_simples(p_texto)),
               '@013457$', 'aoieasts'
             ),
             '[^a-z ]+', ' ', 'g'
           ),
           '(.)\1+', '\1', 'g'
         );
$$;

/**
 * Devolve a primeira palavra bloqueada encontrada, ou nulo.
 *
 * Devolver **qual** foi é deliberado: a mensagem de erro que diz "revise a
 * linguagem" sem dizer o quê faz a pessoa tentar de novo às cegas e desistir.
 */
create or replace function public.linguagem_impropria(p_texto text)
returns text
language sql
stable
security definer
set search_path = public, interno
as $$
  select b.palavra
    from interno.palavras_bloqueadas b
   where ' ' || public.normalizar_texto(p_texto) || ' '
         like '% ' || public.normalizar_texto(b.palavra) || ' %'
   limit 1;
$$;

-- ---------------------------------------------------------------------------
-- RLS
--
-- Leitura para qualquer conta; escrita só em nome próprio; moderação só para
-- admin. O filtro de linguagem não fica aqui — fica nas funções de escrita,
-- porque política de RLS não sabe explicar por que recusou.
-- ---------------------------------------------------------------------------
alter table public.forum_topicos  enable row level security;
alter table public.forum_respostas enable row level security;

create policy leitura on public.forum_topicos
  for select to authenticated using (true);
create policy leitura on public.forum_respostas
  for select to authenticated using (true);

create policy moderacao on public.forum_topicos
  for update to authenticated
  using (public.sou_admin()) with check (public.sou_admin());
create policy moderacao on public.forum_respostas
  for update to authenticated
  using (public.sou_admin()) with check (public.sou_admin());

grant select on public.forum_topicos, public.forum_respostas to authenticated;
grant update on public.forum_topicos, public.forum_respostas to authenticated;

-- ---------------------------------------------------------------------------
-- Escrita
--
-- Por função, e não por `insert` direto do navegador, por três motivos que só
-- existem juntos: aplicar o filtro de linguagem, copiar o nome do autor sem
-- abrir `perfis`, e manter o contador de respostas do tópico.
-- ---------------------------------------------------------------------------
create or replace function public.criar_topico(
  p_titulo text,
  p_corpo text,
  p_disciplina text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, interno
as $$
declare
  v_id uuid;
  v_palavra text;
  v_nome text;
begin
  if auth.uid() is null then
    raise exception 'não autorizado' using errcode = '42501';
  end if;

  v_palavra := public.linguagem_impropria(p_titulo || ' ' || p_corpo);
  if v_palavra is not null then
    raise exception 'linguagem imprópria: %', v_palavra using errcode = '22023';
  end if;

  select coalesce(nullif(btrim(nome), ''), 'Estudante') into v_nome
    from public.perfis where id = auth.uid();

  insert into public.forum_topicos (autor_id, autor_nome, titulo, corpo, disciplina_id)
  values (
    auth.uid(),
    coalesce(v_nome, 'Estudante'),
    btrim(p_titulo),
    btrim(p_corpo),
    (select id from public.disciplinas where slug = p_disciplina)
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.criar_topico(text, text, text) to authenticated;

create or replace function public.responder_topico(p_topico uuid, p_corpo text)
returns uuid
language plpgsql
security definer
set search_path = public, interno
as $$
declare
  v_id uuid;
  v_palavra text;
  v_nome text;
begin
  if auth.uid() is null then
    raise exception 'não autorizado' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.forum_topicos
     where id = p_topico and not trancado and not removido
  ) then
    raise exception 'tópico indisponível' using errcode = '22023';
  end if;

  v_palavra := public.linguagem_impropria(p_corpo);
  if v_palavra is not null then
    raise exception 'linguagem imprópria: %', v_palavra using errcode = '22023';
  end if;

  select coalesce(nullif(btrim(nome), ''), 'Estudante') into v_nome
    from public.perfis where id = auth.uid();

  insert into public.forum_respostas (topico_id, autor_id, autor_nome, corpo)
  values (p_topico, auth.uid(), coalesce(v_nome, 'Estudante'), btrim(p_corpo))
  returning id into v_id;

  -- Contador e data de atividade na mesma transação da resposta: derivar na
  -- listagem custaria uma agregação por tópico a cada abertura da tela.
  update public.forum_topicos
     set respostas = respostas + 1,
         atualizado_em = now()
   where id = p_topico;

  return v_id;
end;
$$;

grant execute on function public.responder_topico(uuid, text) to authenticated;
