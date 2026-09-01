-- ============================================================================
-- Vínculo entre questão e artigo de lei.
--
-- Motivação: `artigos.incidencia` — o número que ordena "por onde começar",
-- alimenta o plano de estudos e aparece na landing — era placeholder. Cinco
-- artigos de 5.756 tinham valor, e os cinco vinham do seed.
--
-- O que se descobriu ao medir: **apenas 61 das 1.120 questões citam número de
-- artigo** em qualquer lugar do enunciado ou das alternativas. A prova da FGV
-- narra um caso e pede a alternativa correta; ela quase nunca diz o
-- dispositivo. Extrair citação por regex, portanto, produz vínculo preciso e
-- pouco — e é exatamente por isso que ele fica separado de palpite.
--
-- `origem` é o que sustenta essa separação:
--
--   'citacao' — o texto da questão nomeia o artigo. Verificável relendo.
--   'humano'  — alguém revisou e afirmou o vínculo.
--
-- Não existe origem 'automatica'. Sugestão por semelhança de texto é
-- calculada na hora da leitura (`artigos_proximos_da_questao`) e a tela diz
-- que é sugestão. Guardar palpite na mesma tabela do dado verificável é como
-- se perde a diferença entre os dois — e `incidencia` voltaria a ser ficção,
-- só que agora com aparência de medição.
-- ============================================================================

create table public.questao_artigos (
  questao_id uuid not null references public.questoes(id) on delete cascade,
  artigo_id  uuid not null references public.artigos(id)  on delete cascade,
  origem text not null check (origem in ('citacao', 'humano')),
  criado_em timestamptz not null default now(),
  primary key (questao_id, artigo_id)
);

create index questao_artigos_artigo_idx on public.questao_artigos (artigo_id);

comment on table public.questao_artigos is
  'Questões que cobram um artigo. Só vínculo verificável — sugestão por '
  'semelhança não entra aqui.';

-- Leitura pública. O que a tabela expõe é a relação (qual questão de qual
-- exame cobra qual artigo), não o conteúdo da questão — esse continua atrás
-- da RLS de `questoes`. E é essa relação que faz a página de legislação poder
-- dizer "cobrado no 43º e no 38º Exame", que é conteúdo aberto por desenho.
alter table public.questao_artigos enable row level security;
create policy leitura_publica on public.questao_artigos for select using (true);
grant select on public.questao_artigos to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Incidência: contada, não estimada
-- ---------------------------------------------------------------------------
create or replace function public.recalcular_incidencia(p_artigos uuid[])
returns void
language sql
security definer
set search_path = public
as $$
  update public.artigos a
     set incidencia = coalesce(
           (select count(*) from public.questao_artigos qa
             where qa.artigo_id = a.id),
           0
         )
   where a.id = any(p_artigos);
$$;

create or replace function public.artigos_incidencia_gatilho()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Tabelas de transição: uma carga de milhares de vínculos faz uma
  -- atualização por artigo afetado, não uma por linha inserida.
  if tg_op = 'INSERT' then
    perform public.recalcular_incidencia(
      array(select distinct artigo_id from novos));
  elsif tg_op = 'DELETE' then
    perform public.recalcular_incidencia(
      array(select distinct artigo_id from antigos));
  end if;
  return null;
end;
$$;

create trigger questao_artigos_incidencia_ins
  after insert on public.questao_artigos
  referencing new table as novos
  for each statement execute function public.artigos_incidencia_gatilho();

create trigger questao_artigos_incidencia_del
  after delete on public.questao_artigos
  referencing old table as antigos
  for each statement execute function public.artigos_incidencia_gatilho();

-- A base já tinha cinco incidências vindas do seed. Zerar todas antes de
-- começar é o que garante que o número passe a significar uma coisa só.
update public.artigos set incidencia = 0 where incidencia <> 0;

-- ---------------------------------------------------------------------------
-- Onde a questão caiu, do lado do artigo
-- ---------------------------------------------------------------------------
create or replace function public.exames_do_artigo(p_artigo_id uuid)
returns table (exame_slug text, edicao int, data_prova date, questoes int)
language sql
stable
security definer
set search_path = public
as $$
  -- `security definer` porque `questoes` exige assinatura e esta consulta
  -- roda em página aberta. O que sai é só contagem por exame — número de
  -- questões, nunca enunciado.
  select e.slug, e.edicao, e.data_prova, count(*)::int
  from public.questao_artigos qa
    join public.questoes q on q.id = qa.questao_id
    join public.exames e   on e.id = q.exame_id
  where qa.artigo_id = p_artigo_id
  group by e.slug, e.edicao, e.data_prova
  order by e.data_prova desc;
$$;

grant execute on function public.exames_do_artigo(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Artigos de uma questão, e artigos apenas parecidos com ela
-- ---------------------------------------------------------------------------
create or replace function public.artigos_da_questao(p_questao_id uuid)
returns table (
  lei_slug text,
  lei_sigla text,
  artigo_slug text,
  numero text,
  caput text,
  tem_comentario boolean,
  origem text
)
language sql
stable
security invoker
set search_path = public
as $$
  select l.slug, l.sigla, a.slug, a.numero, a.caput,
         a.comentario <> '{}', qa.origem
  from public.questao_artigos qa
    join public.artigos a on a.id = qa.artigo_id
    join public.leis l    on l.id = a.lei_id
  where qa.questao_id = p_questao_id
  order by a.ordem;
$$;

grant execute on function public.artigos_da_questao(uuid) to authenticated;

/*
 * Sugestão por semelhança de texto.
 *
 * Calculada na leitura e nunca gravada: é palpite, e palpite gravado ao lado
 * de dado verificável vira dado verificável na cabeça de quem lê o schema
 * seis meses depois.
 *
 * `websearch_to_tsquery` sobre o enunciado inteiro devolveria uma consulta
 * gigantesca e sem foco. O que entra são os termos mais distintivos do
 * enunciado, extraídos pelo próprio `ts_stat` do Postgres — sem depender de
 * nenhum serviço externo, e em português.
 */
create or replace function public.artigos_proximos_da_questao(
  p_questao_id uuid,
  p_limite int default 4
)
returns table (
  lei_slug text,
  lei_sigla text,
  artigo_slug text,
  numero text,
  caput text,
  tem_comentario boolean,
  relevancia real
)
language sql
stable
security invoker
set search_path = public
as $$
  with alvo as (
    select to_tsvector('portuguese', q.enunciado) as vetor
    from public.questoes q
    where q.id = p_questao_id
  )
  select l.slug, l.sigla, a.slug, a.numero, a.caput,
         a.comentario <> '{}',
         ts_rank(a.search_vector, consulta.q) as relevancia
  from alvo,
    lateral (
      -- Os termos do enunciado viram uma consulta OR. `plainto_tsquery` sobre
      -- o texto cru exigiria todos os termos ao mesmo tempo e não casaria
      -- com artigo nenhum.
      select string_agg(palavra, ' | ')::tsquery as q
      from (
        select (unnest(tsvector_to_array(alvo.vetor)))::text as palavra
        limit 40
      ) termos
    ) consulta,
    public.artigos a
    join public.leis l on l.id = a.lei_id
  where a.search_vector @@ consulta.q
  order by relevancia desc
  limit greatest(1, least(p_limite, 10));
$$;

grant execute on function public.artigos_proximos_da_questao(uuid, int)
  to authenticated;
