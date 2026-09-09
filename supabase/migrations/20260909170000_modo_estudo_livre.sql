-- O plano pode preparar para a OAB ou organizar estudo livre dentro do
-- acervo. Contexto fica ao lado do cronograma para uma conversa futura não
-- transformar, por engano, um plano de faculdade em plano de Exame de Ordem.
alter table public.planos_estudo
  add column contexto jsonb not null default '{"modo":"oab","disciplinas":[]}'::jsonb;

comment on column public.planos_estudo.contexto is
  'Objetivo e matérias escolhidas para o plano vigente; não é conteúdo jurídico.';
