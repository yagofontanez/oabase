-- ============================================================================
-- Busca de dispositivo por texto.
--
-- `artigos.search_vector` existia desde o schema inicial, era mantido por
-- gatilho a cada escrita, tinha índice GIN — e **não era consultado por
-- nenhuma linha do sistema**. Índice sem consumidor é custo de escrita puro.
-- Este é o consumidor.
--
-- O que ele conserta é uma premissa: o seletor do quadro de anotações pedia o
-- número do artigo dentro de uma norma escolhida, partindo de que "quem está
-- anotando já sabe qual artigo quer". Quem está anotando é quem estuda para a
-- 1ª fase — a mesma pessoa a quem o site diz, com a medição na mão, que só 4%
-- das questões citam artigo expressamente e que decorar número rende pouco.
-- Ela sabe "furto", não sabe "155".
--
-- **Security invoker de propósito.** `artigos`, `leis` e `sumulas` são leitura
-- aberta ao papel anônimo; é a RLS que decide, e a função segue o que ela
-- decidir. Definer aqui seria privilégio sem nenhuma necessidade — e a porta
-- dos fundos de qualquer restrição futura nessas tabelas.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Acento não pode ser requisito.
--
-- `to_tsvector('portuguese', ...)` distingue "prisão" de "prisao" e
-- "honorários" de "honorarios". Como as pessoas digitam sem acento — no
-- celular, com pressa, na véspera —, a busca voltava vazia para o termo
-- certo. Vazio é o pior resultado possível: ele diz "não existe" quando o
-- dispositivo está no acervo.
-- ---------------------------------------------------------------------------

create extension if not exists unaccent with schema extensions;

/*
 * `unaccent` é STABLE, e expressão de índice exige IMMUTABLE — é a mesma
 * pedra em que `array_to_string` esbarrou quando `artigos.search_vector`
 * precisou de gatilho. O invólucro é o caminho conhecido para isso.
 *
 * A promessa de imutabilidade é verdadeira enquanto o dicionário `unaccent`
 * do servidor não mudar, o que não acontece sem uma migração de versão maior
 * do Postgres. Se um dia acontecer, os índices que dependem daqui precisam
 * ser reconstruídos — e é por isso que este comentário existe.
 */
create or replace function public.sem_acento(texto text)
returns text
language sql
immutable
parallel safe
strict
as $$ select extensions.unaccent('extensions.unaccent', texto) $$;

comment on function public.sem_acento(text) is
  'unaccent() embrulhado como IMMUTABLE, para poder entrar em expressão de '
  'índice e no vetor de busca. Ver o comentário da função.';

-- O vetor de `artigos` passa a ser gravado sem acento. Vale para toda escrita
-- futura, inclusive a do pipeline de ingestão.
create or replace function public.artigos_indexa_busca()
returns trigger
language plpgsql
as $$
begin
  new.search_vector := to_tsvector(
    'portuguese',
    public.sem_acento(
      coalesce(new.numero, '') || ' ' ||
      coalesce(new.caput, '') || ' ' ||
      coalesce(array_to_string(new.comentario, ' '), '')
    )
  );
  return new;
end;
$$;

/*
 * Recarga do vetor nas 10.168 linhas existentes.
 *
 * `artigos_touch` é um gatilho de update sem condição: qualquer escrita põe
 * `now()` em `atualizado_em`. Como essa coluna alimenta o `lastmod` do
 * sitemap, a recarga faria o site anunciar ao rastreador que todas as páginas
 * de legislação mudaram hoje — e nenhuma mudou. Nada mudou para o leitor;
 * mudou o índice interno.
 *
 * Desligar o gatilho durante a recarga é o que mantém a data honesta.
 */
alter table public.artigos disable trigger artigos_touch;
update public.artigos set numero = numero;
alter table public.artigos enable trigger artigos_touch;

/*
 * O número gravado também precisa ser normalizado, não só o digitado.
 *
 * Um único artigo em 10.168 tem ordinal em `numero`: o art. **5º** da
 * Constituição — que é, provavelmente, o dispositivo mais procurado do
 * direito brasileiro, e o de maior incidência medida no acervo depois do
 * furto. Comparar o texto cru faria "art. 5" achar o art. 5 de doze outras
 * leis e não achar aquele.
 *
 * Normalizar só o lado digitado resolveria hoje e voltaria a quebrar na
 * próxima carga que trouxesse "1º" ou "2º". O índice mantém a comparação
 * barata mesmo com a função no meio.
 */
create index if not exists artigos_numero_normalizado_idx
  on public.artigos (upper(regexp_replace(numero, '[º°.]', '', 'g')));

-- Súmula não precisa de coluna: com o invólucro IMMUTABLE, o índice de
-- expressão basta para 779 linhas de texto curto.
create index if not exists sumulas_busca_idx
  on public.sumulas
  using gin (to_tsvector('portuguese', public.sem_acento(texto)));

create or replace function public.buscar_dispositivos(
  termo text,
  lei_slug text default null,
  limite int default 12
)
returns table (
  tipo text,
  id uuid,
  rotulo text,
  resumo text,
  href text,
  comentado boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  with entrada as (
    select
      btrim(coalesce(termo, '')) as bruto,
      -- "art. 155", "Artigo 5º", "217-a" → "155", "5", "217-A".
      -- É a normalização que faltava: hoje `.eq("numero", ...)` recusa todas
      -- essas formas, e quem digitou o número certo conclui que o artigo não
      -- existe no acervo.
      upper(
        regexp_replace(
          regexp_replace(
            btrim(coalesce(termo, '')),
            '^\s*(arts?\.?|artigos?)\s*', '', 'i'
          ),
          '[º°.]', '', 'g'
        )
      ) as numero_possivel
  ),
  consulta as (
    select
      e.bruto,
      e.numero_possivel,
      -- Só é "número" o que é número inteiro, com o sufixo de letra que o
      -- Planalto usa (155, 217-A). "5 anos" não é.
      (e.numero_possivel ~ '^[0-9]+(-[A-Z])?$') as parece_numero,
      -- `websearch_to_tsquery` nunca levanta exceção com entrada do usuário,
      -- ao contrário de `to_tsquery`. Aqui a entrada vem de um campo livre.
      websearch_to_tsquery('portuguese', public.sem_acento(e.bruto)) as tsq
    from entrada e
    -- Uma letra solta é ruído; um dígito solto é o art. 5. O piso não pode
    -- ser o mesmo para os dois.
    where length(e.bruto) >= 2 or e.bruto ~ '^[0-9]$'
  ),

  -- 1. Artigo cujo número é exatamente o que foi digitado. Peso máximo: quem
  --    digita "155" quer o art. 155, não um artigo que menciona 155.
  por_numero as (
    select
      'artigo'::text as tipo,
      a.id,
      'Art. ' || a.numero || ' ' || l.sigla as rotulo,
      a.caput as resumo,
      '/legislacao/' || l.slug || '/' || a.slug as href,
      -- `cardinality`, e não `array_length`: em array vazio o segundo devolve
      -- NULL, não 0, e `NULL > 0` é NULL. O selo "comentado" sumia sozinho.
      (cardinality(a.comentario) > 0) as comentado,
      3.0::real as peso,
      -- Entre os 42 artigos "155" das 42 leis, primeiro o que a prova cobra.
      -- É a incidência medida, o mesmo número da página aberta.
      a.incidencia
    from consulta c
    join public.artigos a
      on upper(regexp_replace(a.numero, '[º°.]', '', 'g')) = c.numero_possivel
    join public.leis l on l.id = a.lei_id
    where c.parece_numero
      and (lei_slug is null or l.slug = lei_slug)
  ),

  -- 2. Artigo por texto — o caso que não existia. O vetor cobre número, caput
  --    e comentário.
  por_texto as (
    select
      'artigo'::text as tipo,
      a.id,
      'Art. ' || a.numero || ' ' || l.sigla as rotulo,
      a.caput as resumo,
      '/legislacao/' || l.slug || '/' || a.slug as href,
      -- `cardinality`, e não `array_length`: em array vazio o segundo devolve
      -- NULL, não 0, e `NULL > 0` é NULL. O selo "comentado" sumia sozinho.
      (cardinality(a.comentario) > 0) as comentado,
      -- A incidência entra no peso, e não só no desempate. Sem ela, "furto"
      -- devolvia o art. 250 da Constituição à frente do roubo e do dano, que
      -- a prova cobra seis vezes cada: `ts_rank` mede semelhança de texto e
      -- não sabe o que cai. O teto de 10 impede que um dispositivo muito
      -- citado suba em busca que não tem nada a ver com ele.
      (ts_rank(a.search_vector, c.tsq)
        * (1 + least(a.incidencia, 10) * 0.15))::real as peso,
      a.incidencia
    from consulta c
    join public.artigos a on a.search_vector @@ c.tsq
    join public.leis l on l.id = a.lei_id
    where (lei_slug is null or l.slug = lei_slug)
  ),

  -- 3. Súmula por texto ou por número. Fica de fora quando há filtro de lei:
  --    o filtro é de norma, e súmula não é artigo de norma nenhuma.
  --    Ninguém lembra que a Vinculante 11 é a das algemas; todo mundo lembra
  --    "algemas".
  sumulas_achadas as (
    select
      'sumula'::text as tipo,
      s.id,
      case when s.vinculante
        then 'Súmula Vinculante ' || s.numero
        else 'Súmula ' || s.numero || ' do ' || upper(s.tribunal)
      end as rotulo,
      s.texto as resumo,
      '/sumulas/' || s.slug as href,
      (cardinality(s.comentario) > 0) as comentado,
      case
        when c.parece_numero and s.numero::text = c.numero_possivel then 3.0
        else ts_rank(to_tsvector('portuguese', public.sem_acento(s.texto)), c.tsq)
      end::real as peso,
      0 as incidencia
    from consulta c
    join public.sumulas s
      on (c.parece_numero and s.numero::text = c.numero_possivel)
      or to_tsvector('portuguese', public.sem_acento(s.texto)) @@ c.tsq
    where lei_slug is null
  ),

  tudo as (
    select * from por_numero
    union all
    select * from por_texto
    union all
    select * from sumulas_achadas
  )

  -- O mesmo artigo pode chegar pelo número e pelo texto. `distinct on` fica
  -- com a melhor ocorrência de cada um — sem isso, digitar "155" devolveria
  -- o art. 155 duas vezes, e o quadro recusaria o segundo pelo índice único
  -- com uma mensagem de erro que não faz sentido nenhum para quem clicou.
  select
    t.tipo,
    t.id,
    t.rotulo,
    -- O caput inteiro é um muro dentro de uma lista de resultados.
    case when length(t.resumo) > 200
      then left(t.resumo, 200) || '…'
      else t.resumo
    end as resumo,
    t.href,
    t.comentado
  from (
    select distinct on (x.id) x.*
    from tudo x
    order by x.id, x.peso desc
  ) t
  order by t.peso desc, t.incidencia desc, t.rotulo
  limit greatest(1, least(coalesce(limite, 12), 50));
$$;

comment on function public.buscar_dispositivos(text, text, int) is
  'Busca artigo de lei e súmula por texto livre ou por número, com o número '
  'normalizado ("art. 155", "5º", "217-a"). Ordena por relevância e desempata '
  'pela incidência medida. É o primeiro consumidor de artigos.search_vector.';

grant execute on function public.buscar_dispositivos(text, text, int)
  to anon, authenticated;
