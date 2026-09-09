-- ============================================================================
-- Roadmap interativo do plano de estudos.
--
-- O plano gerado pela IA continua sendo um documento JSON. O estado de cada
-- bloco mora em linhas próprias: replanejar não pode desfazer uma conclusão
-- que o aluno marcou. A versão separa o roteiro vigente dos anteriores.
-- ============================================================================

alter table public.planos_estudo
  add column versao_roadmap integer not null default 0;

create table public.roadmap_itens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  versao integer not null check (versao > 0),
  semana integer not null check (semana > 0),
  ordem integer not null check (ordem >= 0),
  disciplina text not null,
  objetivo text not null,
  horas numeric(5,2) not null check (horas > 0 and horas <= 80),
  estado text not null default 'a_estudar'
    check (estado in ('a_estudar', 'em_andamento', 'concluido')),
  iniciado_em timestamptz,
  concluido_em timestamptz,
  criado_em timestamptz not null default now(),
  unique (user_id, versao, semana, ordem)
);

comment on table public.roadmap_itens is
  'Blocos acionáveis do roteiro vigente. O estado pertence ao aluno, não ao JSON gerado pela IA.';

create index roadmap_itens_usuario_versao_idx
  on public.roadmap_itens (user_id, versao, semana, ordem);

alter table public.roadmap_itens enable row level security;

create policy dono on public.roadmap_itens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.roadmap_itens to authenticated;
