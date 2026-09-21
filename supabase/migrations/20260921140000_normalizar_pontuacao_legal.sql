-- Algumas entidades numéricas do HTML antigo do Planalto chegaram ao banco
-- como controles C1, embora representem pontuação de Windows-1252. Além de
-- aparecerem quebradas na página, podiam contaminar snippets automáticos.
-- A troca é só de codificação: aspas e travessão continuam sendo os mesmos
-- sinais que a fonte pretendia exibir.
with pontuacao as (
  select
    chr(145) || chr(146) || chr(147) || chr(148) || chr(150) as origem,
    '‘’“”–'::text as destino
)
update public.artigos artigo
   set caput = translate(artigo.caput, pontuacao.origem, pontuacao.destino),
       paragrafos = array(
         select translate(paragrafo, pontuacao.origem, pontuacao.destino)
           from unnest(artigo.paragrafos) with ordinality
                as parte(paragrafo, ordem)
          order by ordem
       )
  from pontuacao
 where artigo.caput ~ ('[' || pontuacao.origem || ']')
    or exists (
      select 1
        from unnest(artigo.paragrafos) as paragrafo
       where paragrafo ~ ('[' || pontuacao.origem || ']')
    );
