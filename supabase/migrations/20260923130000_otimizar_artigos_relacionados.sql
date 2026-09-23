-- A página de artigo usa esta relação apenas para montar quatro links.
-- Sem índice por disciplina, o Postgres precisava filtrar a base inteira e
-- ordenar por incidência; sob tráfego de crawler isso estourava o timeout do
-- Supabase e fazia o Server Handler falhar junto.
create index if not exists artigos_disciplina_incidencia_idx
  on public.artigos (disciplina_id, incidencia desc)
  where disciplina_id is not null;
