-- ============================================================================
-- Ordem do artigo dentro da lei.
--
-- `numero` é texto porque existe "5-A" e "1.337". Como texto, o art. 10 vem
-- antes do art. 2 e o 1.337 antes do 927 — ordem que ninguém que já folheou um
-- código reconhece. Enquanto a base tinha cinco artigos dava para ordenar por
-- incidência; com 5.756 artigos, 5.751 empatam em zero e a lista fica aleatória.
--
-- A coluna guarda a posição derivada do próprio número, e não a posição de
-- chegada: assim uma recarga parcial não embaralha o que já está gravado.
-- Fórmula: número × 100 + letra (A=1 … Z=26), de modo que 5, 5-A e 6 caiam em
-- 500, 501 e 600 — sempre com espaço para o que vier no meio.
-- ============================================================================

alter table public.artigos
  add column if not exists ordem int not null default 0;

-- Percorrer a lei em ordem e achar vizinho anterior/seguinte são a mesma
-- consulta com sinal trocado; um índice serve aos dois.
create index if not exists artigos_ordem_idx on public.artigos (lei_id, ordem);

-- Backfill do que já está carregado. Vale para os artigos sem letra, que são a
-- quase totalidade; os poucos com sufixo são corrigidos pela próxima carga do
-- pipeline, que envia `ordem` calculada na origem.
update public.artigos
set ordem = (regexp_replace(numero, '[^0-9].*$', '')::int) * 100
where ordem = 0
  and numero ~ '^[0-9]';
