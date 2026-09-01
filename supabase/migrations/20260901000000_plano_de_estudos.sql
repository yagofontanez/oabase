-- ============================================================================
-- Plano de estudos gerado por IA.
--
-- Uma linha por pessoa: o plano vigente e a conversa que o produziu. Guardar
-- a conversa não é histórico decorativo — é o que permite pedir um ajuste
-- ("tenho menos tempo às quartas") sem recomeçar do zero.
--
-- O conteúdo é JSON validado pela aplicação antes de gravar: o modelo só
-- pode citar disciplinas que existem na tabela `disciplinas`. Nada de
-- afirmação jurídica sai daqui — texto de lei vem do acervo, não do modelo.
-- ============================================================================

create table public.planos_estudo (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plano jsonb,
  conversa jsonb not null default '[]'::jsonb,
  atualizado_em timestamptz not null default now()
);

comment on table public.planos_estudo is
  'Plano de estudos por pessoa, gerado e ajustado por conversa.';

alter table public.planos_estudo enable row level security;

create policy dono on public.planos_estudo
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.planos_estudo to authenticated;
