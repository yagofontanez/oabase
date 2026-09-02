-- ============================================================================
-- Segunda passada do filtro: o desvio por espaçamento.
--
-- A comparação por palavra inteira resolve o falso positivo — "assumiu" não é
-- mais barrado por conter "cu" — e abre um buraco previsível: quem quer
-- xingar escreve "c a r a l h o" ou "c.a.r.a.l.h.o", e cada letra vira uma
-- palavra que não casa com nada.
--
-- A segunda passada compara o texto **sem separador nenhum** contra a lista.
-- Sozinha ela seria pior que o problema: "banco urbano", sem espaço, contém
-- "cu". Por isso só vale para termos de quatro letras ou mais, onde a colisão
-- acidental entre palavras vizinhas deixa de ser plausível.
--
-- Nenhum filtro fecha todos os desvios. Este fecha os que aparecem de fato, e
-- erra para o lado de deixar passar — num fórum de estudo, barrar a mensagem
-- honesta de quem está com dúvida custa mais do que deixar passar um palavrão
-- criativo, que a moderação remove depois.
-- ============================================================================

create or replace function public.linguagem_impropria(p_texto text)
returns text
language sql
stable
security definer
set search_path = public, interno
as $$
  with normal as (
    select public.normalizar_texto(p_texto) as texto
  ),
  colado as (
    -- Tirar o espaço **antes** de colapsar letra repetida, e não depois:
    -- "p o r r a" só vira "pora" — a forma que a lista guarda, porque a
    -- própria normalização colapsa "porra" — quando os dois erres ficam
    -- vizinhos. Na ordem trocada, o desvio mais banal do filtro passa.
    select regexp_replace(replace(texto, ' ', ''), '(.)\1+', '\1', 'g') as texto
      from normal
  )
  select b.palavra
    from interno.palavras_bloqueadas b
   where
     -- Palavra inteira, no texto normalizado.
     (select ' ' || texto || ' ' from normal)
       like '% ' || public.normalizar_texto(b.palavra) || ' %'
     -- Ou, para termos longos, o mesmo texto sem separador nenhum.
     or (
       length(replace(public.normalizar_texto(b.palavra), ' ', '')) >= 4
       and (select texto from colado)
           like '%' || replace(public.normalizar_texto(b.palavra), ' ', '') || '%'
     )
   limit 1;
$$;
