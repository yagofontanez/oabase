-- ============================================================================
-- Quadro de anotações.
--
-- Uma tela livre por pessoa, onde cartões de anotação e questões já
-- respondidas convivem e podem ser ligados entre si. O que se está modelando
-- é a relação que a pessoa enxerga — "esta questão caiu por causa desta
-- regra", "estes três erros são a mesma confusão" — e essa relação não cabe
-- em nenhuma taxonomia que a gente definisse de antemão.
--
-- Por isso a ligação é livre e sem semântica no banco: `origem`, `destino` e
-- um rótulo em texto. Tentar tipar a aresta ("causa", "exceção",
-- "fundamento") seria impor um esquema de estudo que ninguém pediu.
--
-- Posição é dado de primeira classe, não enfeite: um quadro que reorganiza
-- os cartões sozinho a cada abertura perde exatamente o que faz dele um
-- quadro. `x` e `y` são gravados a cada arraste.
-- ============================================================================

create table public.quadro_nos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  tipo text not null check (tipo in ('nota', 'questao')),

  -- Só em `tipo = 'questao'`. O cascade é intencional: se a questão sair do
  -- acervo, o cartão que aponta para ela deixa de fazer sentido.
  questao_id uuid references public.questoes(id) on delete cascade,

  titulo text not null default '',
  corpo  text not null default '',

  -- Cor é organização, não decoração: é como a pessoa agrupa sem precisar de
  -- pasta. Enumerada para não virar um seletor de dez mil tons.
  cor text not null default 'neutra'
    check (cor in ('neutra', 'esmeralda', 'ambar', 'ameixa')),

  x double precision not null default 0,
  y double precision not null default 0,
  largura double precision not null default 260,

  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  -- Cartão de questão sem questão, ou nota carregando questão, seriam duas
  -- formas de estado inconsistente que a aplicação teria de tratar para
  -- sempre. Barrado aqui, não existe.
  constraint quadro_nos_questao_coerente check (
    (tipo = 'questao' and questao_id is not null) or
    (tipo = 'nota'    and questao_id is null)
  )
);

-- A mesma questão duas vezes no quadro é sempre engano, nunca intenção.
create unique index quadro_nos_questao_unica
  on public.quadro_nos (user_id, questao_id)
  where questao_id is not null;

create index quadro_nos_dono_idx on public.quadro_nos (user_id);

create table public.quadro_ligacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  origem  uuid not null references public.quadro_nos(id) on delete cascade,
  destino uuid not null references public.quadro_nos(id) on delete cascade,
  rotulo  text not null default '',
  criado_em timestamptz not null default now(),

  constraint quadro_ligacoes_sem_laco check (origem <> destino),
  unique (origem, destino)
);

create index quadro_ligacoes_dono_idx on public.quadro_ligacoes (user_id);

comment on table public.quadro_nos is
  'Cartões do quadro de anotações: notas livres e questões já respondidas.';
comment on table public.quadro_ligacoes is
  'Ligações entre cartões. Sem semântica no banco — o sentido é o rótulo.';

-- ---------------------------------------------------------------------------
-- RLS
--
-- O quadro é escrito direto do navegador, com a chave anônima e a sessão de
-- quem está logado — como já acontece em `sessoes_foco`. Não há segredo a
-- proteger aqui (nada de gabarito, nada de preço), então quem guarda a porta
-- é a política de dono, e ela basta: `with check` impede gravar em nome de
-- outra pessoa mesmo que o corpo da requisição seja forjado.
-- ---------------------------------------------------------------------------
alter table public.quadro_nos      enable row level security;
alter table public.quadro_ligacoes enable row level security;

create policy dono on public.quadro_nos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy dono on public.quadro_ligacoes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete
  on public.quadro_nos, public.quadro_ligacoes to authenticated;
