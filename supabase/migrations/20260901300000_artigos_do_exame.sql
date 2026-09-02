-- ============================================================================
-- Quais dispositivos uma prova cobrou.
--
-- É o caminho inverso de `exames_do_artigo`, e existe por dois motivos que se
-- somam:
--
-- 1. **Conteúdo próprio na página do exame.** A ficha de um exame que só
--    repete edição, data e contagem é a mesma coisa que dezenas de outros
--    sites publicam. "Esta prova cobrou o art. 133 da CF/88 e o art. 20 do
--    Estatuto" é informação que sai do nosso acervo e de mais nenhum.
--
-- 2. **Caminho de rastreio.** Hoje a página do artigo aponta para o exame, e
--    o exame não aponta para artigo nenhum — o buscador entra e sai sem
--    encontrar as páginas profundas. Ligação nos dois sentidos resolve.
--
-- `security definer` porque `questoes` exige assinatura e a página do exame é
-- aberta. O que atravessa é a relação e a contagem; enunciado, nunca.
-- ============================================================================

create or replace function public.artigos_do_exame(p_exame_slug text)
returns table (
  lei_slug text,
  lei_sigla text,
  artigo_slug text,
  numero text,
  caput text,
  questoes int,
  tem_comentario boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select l.slug, l.sigla, a.slug, a.numero, a.caput,
         count(*)::int, a.comentario <> '{}'
  from public.questao_artigos qa
    join public.questoes q on q.id = qa.questao_id
    join public.exames e   on e.id = q.exame_id
    join public.artigos a  on a.id = qa.artigo_id
    join public.leis l     on l.id = a.lei_id
  where e.slug = p_exame_slug
  group by l.slug, l.sigla, a.slug, a.numero, a.caput, a.comentario, a.ordem
  order by count(*) desc, l.slug, a.ordem;
$$;

grant execute on function public.artigos_do_exame(text) to anon, authenticated;
