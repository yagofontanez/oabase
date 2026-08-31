-- ============================================================================
-- Portão de qualidade da classificação por disciplina.
--
-- O classificador do pipeline de ingestão chega a ~78% de acurácia medida
-- contra revisão manual do 43º Exame — abaixo da barra de 90% que o projeto
-- adotou. Enunciado, alternativas, gabarito e anulação vêm de fonte oficial
-- e são confiáveis; a disciplina, não.
--
-- Em vez de escolher entre gravar dado errado ou não gravar nada, a coluna
-- registra a diferença: a classificação fica no banco como palpite, e nada
-- que dependa de disciplina — estatísticas, filtros, questões similares —
-- lê linha não confirmada. Mesmo padrão de `artigos.indexavel`.
-- ============================================================================

alter table public.questoes
  add column disciplina_confirmada boolean not null default false;

comment on column public.questoes.disciplina_confirmada is
  'true somente após revisão humana. Consultas que agrupam por disciplina '
  'devem filtrar por esta coluna.';

-- A fila de revisão editorial: o que já está no banco esperando confirmação.
create index questoes_revisao_pendente_idx
  on public.questoes (exame_id, numero)
  where not disciplina_confirmada;
