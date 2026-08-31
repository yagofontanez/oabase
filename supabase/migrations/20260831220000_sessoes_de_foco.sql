-- ============================================================================
-- Sessões de foco.
--
-- Guarda apenas blocos de foco concluídos — pausa não é estudo e não entra na
-- conta. É a primeira métrica que o produto consegue registrar hoje: o banco
-- de questões ainda depende do checkout, mas qualquer pessoa com conta já
-- consegue produzir tempo de estudo medido.
--
-- `iniciado_em` e `concluido_em` são gravados pelo cliente a partir do
-- relógio dele. Serve para histórico e soma, não para auditoria — não há
-- nada a ganhar inflando o próprio tempo de estudo.
-- ============================================================================

create table public.sessoes_foco (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Opcional: a pessoa pode focar sem declarar em quê.
  disciplina_id uuid references public.disciplinas(id) on delete set null,
  minutos int not null check (minutos > 0 and minutos <= 180),
  iniciado_em timestamptz not null,
  concluido_em timestamptz not null default now()
);

comment on table public.sessoes_foco is
  'Blocos de foco concluídos no modo foco. Pausas não são registradas.';

create index sessoes_foco_usuario_idx
  on public.sessoes_foco (user_id, concluido_em desc);

alter table public.sessoes_foco enable row level security;

create policy dono on public.sessoes_foco
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, delete on public.sessoes_foco to authenticated;
