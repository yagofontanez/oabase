-- ============================================================================
-- Procedência do gabarito.
--
-- Até o 32º Exame, o arquivo oficial da OAB publica apenas os "Gabaritos
-- Preliminares" da prova objetiva — o que naquela época saía como "Resultado
-- Definitivo" era lista de aprovados, não gabarito. Das edições mais recentes
-- há gabarito definitivo, pós-recursos.
--
-- As duas origens são utilizáveis, mas divergem em anulações e em eventuais
-- mudanças de resposta. Misturá-las sem registrar qual foi usada é perder
-- procedência — o mesmo erro das datas de prova inventadas no seed.
-- ============================================================================

alter table public.exames
  add column gabarito_definitivo boolean not null default false;

comment on column public.exames.gabarito_definitivo is
  'true = gabarito definitivo (pós-recursos). false = preliminar, sujeito a '
  'divergência em anulações e respostas.';
