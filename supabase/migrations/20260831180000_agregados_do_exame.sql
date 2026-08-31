-- ============================================================================
-- Agregados públicos por exame.
--
-- `questoes` é conteúdo pago e o papel anônimo não lê nem para contar. Mas
-- "quantas questões este exame teve e quantas foram anuladas" é informação de
-- catálogo, não é o produto — e é exatamente o tipo de dado que a camada
-- aberta existe para publicar.
--
-- Os números são escritos pelo pipeline de ingestão, a partir do que ele
-- carregou de fato. Nada aqui é estimativa.
-- ============================================================================

alter table public.exames
  add column questoes_carregadas int not null default 0,
  add column questoes_anuladas int not null default 0;

comment on column public.exames.questoes_carregadas is
  'Quantas questões deste exame estão no banco. 0 = ainda não ingerido.';
