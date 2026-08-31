-- ============================================================================
-- OABase — schema inicial
--
-- A regra que organiza este arquivo é a fronteira aberto/pago, e ela é
-- aplicada por RLS, não por lógica de aplicação. Conteúdo de consulta libera
-- SELECT para o papel anônimo; questões e comentários exigem assinatura ativa.
-- Assim é impossível vazar o produto por engano ao criar uma rota nova.
-- ============================================================================

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- Utilidades
-- ---------------------------------------------------------------------------

create or replace function public.touch_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

-- ============================================================================
-- CAMADA PÚBLICA — indexável, SELECT liberado para anon
-- ============================================================================

create table public.disciplinas (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nome text not null,
  -- Média de questões por prova: alimenta /estatisticas e o cartão-resposta.
  media_por_prova numeric(4,1) not null default 0,
  criado_em timestamptz not null default now()
);

create table public.temas (
  id uuid primary key default gen_random_uuid(),
  disciplina_id uuid not null references public.disciplinas(id) on delete cascade,
  slug text not null,
  nome text not null,
  unique (disciplina_id, slug)
);

create table public.leis (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nome text not null,
  sigla text not null,
  ano int not null,
  resumo text not null default ''
);

create table public.artigos (
  id uuid primary key default gen_random_uuid(),
  lei_id uuid not null references public.leis(id) on delete cascade,
  disciplina_id uuid references public.disciplinas(id) on delete set null,
  numero text not null,
  slug text not null,
  caput text not null,
  paragrafos text[] not null default '{}',
  -- Comentário autoral: o diferencial. Vazio = ainda não redigido.
  comentario text[] not null default '{}',
  incidencia int not null default 0,
  -- Portão de qualidade. Sem comentário revisado a página existe e é útil,
  -- mas fica fora do sitemap e recebe noindex. É o que protege o domínio de
  -- ser avaliado como conteúdo raso quando a base escalar.
  indexavel boolean not null default false,
  atualizado_em timestamptz not null default now(),
  -- Mantido por trigger, e não por coluna gerada: `array_to_string` é
  -- STABLE (depende da função de saída do tipo do elemento), e o Postgres
  -- exige IMMUTABLE em expressão de geração. Guardar o comentário como
  -- texto único contornaria, mas o formato de parágrafos é o que a página
  -- consome — então o índice é que se ajusta ao dado, não o contrário.
  search_vector tsvector,
  unique (lei_id, slug)
);

create or replace function public.artigos_indexa_busca()
returns trigger
language plpgsql
as $$
begin
  new.search_vector := to_tsvector(
    'portuguese',
    coalesce(new.numero, '') || ' ' ||
    coalesce(new.caput, '') || ' ' ||
    coalesce(array_to_string(new.comentario, ' '), '')
  );
  return new;
end;
$$;

create trigger artigos_busca
  before insert or update of numero, caput, comentario on public.artigos
  for each row execute function public.artigos_indexa_busca();

create index artigos_busca_idx on public.artigos using gin (search_vector);
create index artigos_incidencia_idx on public.artigos (lei_id, incidencia desc);
-- O sitemap consulta exatamente isto; índice parcial mantém barato mesmo
-- quando só uma fração da base estiver publicada.
create index artigos_indexaveis_idx on public.artigos (atualizado_em desc)
  where indexavel;

create trigger artigos_touch
  before update on public.artigos
  for each row execute function public.touch_atualizado_em();

create table public.sumulas (
  id uuid primary key default gen_random_uuid(),
  tribunal text not null check (tribunal in ('stf', 'stj', 'tst', 'tse')),
  numero int not null,
  slug text not null,
  texto text not null,
  comentario text[] not null default '{}',
  vinculante boolean not null default false,
  indexavel boolean not null default false,
  unique (tribunal, numero)
);

create table public.termos_glossario (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  termo text not null,
  definicao text not null,
  indexavel boolean not null default false
);

create table public.exames (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  edicao int not null unique,
  ano int not null,
  data_prova date not null,
  total_questoes int not null default 80
);

create table public.exame_disciplinas (
  exame_id uuid not null references public.exames(id) on delete cascade,
  disciplina_id uuid not null references public.disciplinas(id) on delete cascade,
  questoes int not null,
  primary key (exame_id, disciplina_id)
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  titulo text not null,
  resumo text not null default '',
  corpo text not null default '',
  publicado_em timestamptz
);

-- ============================================================================
-- CAMADA DE PRODUTO — noindex, exige assinatura ativa
-- ============================================================================

create table public.questoes (
  id uuid primary key default gen_random_uuid(),
  exame_id uuid not null references public.exames(id) on delete cascade,
  tema_id uuid references public.temas(id) on delete set null,
  disciplina_id uuid references public.disciplinas(id) on delete set null,
  -- Chave natural do pipeline de ingestão: o upsert bate por aqui, o que
  -- torna a carga idempotente por mais vezes que ela rode.
  numero int not null,
  slug text not null unique,
  enunciado text not null,
  alternativas jsonb not null,
  gabarito char(1) check (gabarito in ('A', 'B', 'C', 'D')),
  anulada boolean not null default false,
  embedding extensions.vector(1536),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  search_vector tsvector generated always as (
    to_tsvector('portuguese', coalesce(enunciado, ''))
  ) stored,
  unique (exame_id, numero),
  -- Questão anulada não entra em simulado, mas continua valendo como
  -- conteúdo; se não foi anulada, o gabarito é obrigatório.
  constraint gabarito_obrigatorio check (anulada or gabarito is not null)
);

create index questoes_busca_idx on public.questoes using gin (search_vector);
create index questoes_disciplina_idx on public.questoes (disciplina_id);

create trigger questoes_touch
  before update on public.questoes
  for each row execute function public.touch_atualizado_em();

create table public.comentarios (
  id uuid primary key default gen_random_uuid(),
  questao_id uuid not null references public.questoes(id) on delete cascade,
  corpo text[] not null default '{}',
  autor text,
  status text not null default 'rascunho'
    check (status in ('rascunho', 'em_revisao', 'publicado')),
  revisado_em timestamptz,
  unique (questao_id)
);

-- ============================================================================
-- CAMADA DE USUÁRIO
-- ============================================================================

create table public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  -- Exame que a pessoa está mirando: origem do cronograma e da contagem.
  exame_alvo_id uuid references public.exames(id) on delete set null,
  criado_em timestamptz not null default now()
);

create table public.assinaturas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plano text not null check (plano in ('experimentar', 'ate-a-prova', 'anual')),
  status text not null default 'ativa'
    check (status in ('ativa', 'cancelada', 'expirada')),
  inicio timestamptz not null default now(),
  fim timestamptz not null,
  gateway_id text,
  criado_em timestamptz not null default now()
);

create index assinaturas_vigencia_idx
  on public.assinaturas (user_id, status, fim desc);

create table public.respostas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  questao_id uuid not null references public.questoes(id) on delete cascade,
  alternativa char(1) not null check (alternativa in ('A', 'B', 'C', 'D')),
  acertou boolean not null,
  tempo_ms int,
  respondido_em timestamptz not null default now()
);

-- Caderno de erros, estatísticas por tema e fila de revisão saem todos
-- desta tabela; o índice serve as três leituras.
create index respostas_usuario_idx
  on public.respostas (user_id, respondido_em desc);
create index respostas_erros_idx
  on public.respostas (user_id, questao_id) where not acertou;

create table public.revisoes (
  user_id uuid not null references auth.users(id) on delete cascade,
  questao_id uuid not null references public.questoes(id) on delete cascade,
  proxima_em date not null,
  intervalo_dias int not null default 1,
  facilidade numeric(3,2) not null default 2.50,
  primary key (user_id, questao_id)
);

create index revisoes_fila_idx on public.revisoes (user_id, proxima_em);

-- ============================================================================
-- RLS
-- ============================================================================

create or replace function public.tem_assinatura_ativa()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.assinaturas a
    where a.user_id = auth.uid()
      and a.status = 'ativa'
      and a.inicio <= now()
      and a.fim > now()
  );
$$;

alter table public.disciplinas       enable row level security;
alter table public.temas             enable row level security;
alter table public.leis              enable row level security;
alter table public.artigos           enable row level security;
alter table public.sumulas           enable row level security;
alter table public.termos_glossario  enable row level security;
alter table public.exames            enable row level security;
alter table public.exame_disciplinas enable row level security;
alter table public.posts             enable row level security;
alter table public.questoes          enable row level security;
alter table public.comentarios       enable row level security;
alter table public.perfis            enable row level security;
alter table public.assinaturas       enable row level security;
alter table public.respostas         enable row level security;
alter table public.revisoes          enable row level security;

-- Conteúdo aberto: leitura para todo mundo, inclusive anônimo.
create policy leitura_publica on public.disciplinas       for select using (true);
create policy leitura_publica on public.temas             for select using (true);
create policy leitura_publica on public.leis              for select using (true);
create policy leitura_publica on public.artigos           for select using (true);
create policy leitura_publica on public.exames            for select using (true);
create policy leitura_publica on public.exame_disciplinas for select using (true);
create policy leitura_publica on public.sumulas           for select using (true);
create policy leitura_publica on public.termos_glossario  for select using (true);
create policy leitura_publica on public.posts
  for select using (publicado_em is not null and publicado_em <= now());

-- Produto: só com assinatura ativa.
create policy leitura_assinante on public.questoes
  for select using (public.tem_assinatura_ativa());
create policy leitura_assinante on public.comentarios
  for select using (public.tem_assinatura_ativa());

-- Dados do usuário: só o dono.
create policy dono on public.perfis
  for all using (auth.uid() = id) with check (auth.uid() = id);
create policy dono on public.assinaturas
  for select using (auth.uid() = user_id);
create policy dono on public.respostas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy dono on public.revisoes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- O papel anônimo enxerga apenas o conteúdo aberto; as políticas acima
-- fazem o corte, mas o grant explícito evita depender só do default.
grant usage on schema public to anon, authenticated;
grant select on
  public.disciplinas, public.temas, public.leis, public.artigos,
  public.sumulas, public.termos_glossario, public.exames,
  public.exame_disciplinas, public.posts
to anon, authenticated;
grant select on public.questoes, public.comentarios to authenticated;
grant select, insert, update, delete
  on public.perfis, public.respostas, public.revisoes to authenticated;
grant select on public.assinaturas to authenticated;
