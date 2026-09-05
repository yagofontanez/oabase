alter table "public"."disciplinas" drop column "media_por_prova";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.comentarios_pendentes()
 RETURNS TABLE(rascunhos bigint, publicados bigint, questoes bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    count(*) filter (where c.status <> 'publicado'),
    count(*) filter (where c.status = 'publicado'),
    (select count(*) from public.questoes where not anulada)
  from public.comentarios c
  where public.sou_editor();
$function$
;

CREATE OR REPLACE FUNCTION public.distribuicao_por_disciplina()
 RETURNS TABLE(disciplina_slug text, disciplina_nome text, questoes bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select d.slug, d.nome, count(q.id)
    from public.disciplinas d
    left join public.questoes q on q.disciplina_id = d.id
   group by d.slug, d.nome
   order by count(q.id) desc, d.nome;
$function$
;

CREATE OR REPLACE FUNCTION public.fila_de_comentarios(p_limite integer DEFAULT 40)
 RETURNS TABLE(questao_id uuid, edicao integer, numero integer, enunciado text, alternativas jsonb, gabarito character, disciplina_nome text, corpo text[], status text, autor text, apoio jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    q.id, e.edicao, q.numero, q.enunciado, q.alternativas, q.gabarito,
    d.nome,
    coalesce(c.corpo, '{}'::text[]),
    coalesce(c.status, 'rascunho'),
    c.autor,
    coalesce(
      (select jsonb_agg(jsonb_build_object(
                'rotulo', 'Art. ' || a.numero || ' ' || l.sigla,
                'href', '/legislacao/' || l.slug || '/' || a.slug,
                'caput', a.caput,
                'comentario', a.comentario)
              order by a.incidencia desc)
         from public.questao_artigos qa
         join public.artigos a on a.id = qa.artigo_id
         join public.leis l on l.id = a.lei_id
        where qa.questao_id = q.id),
      '[]'::jsonb
    )
  from public.questoes q
  join public.exames e on e.id = q.exame_id
  left join public.disciplinas d on d.id = q.disciplina_id
  left join public.comentarios c on c.questao_id = q.id
 where public.sou_editor()
   and not q.anulada
   and coalesce(c.status, 'rascunho') <> 'publicado'
 order by (c.id is null), e.edicao desc, q.numero
 limit greatest(1, least(p_limite, 100));
$function$
;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.salvar_comentario(p_questao uuid, p_corpo text[], p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not public.sou_editor() then
    raise exception 'não autorizado' using errcode = '42501';
  end if;

  if p_status not in ('rascunho', 'em_revisao', 'publicado') then
    raise exception 'status inválido: %', p_status using errcode = '22023';
  end if;

  if p_status = 'publicado'
     and coalesce(array_length(p_corpo, 1), 0) = 0 then
    raise exception 'comentário vazio não pode ser publicado'
      using errcode = '22023';
  end if;

  insert into public.comentarios (questao_id, corpo, status, autor, revisado_em)
  values (
    p_questao,
    coalesce(p_corpo, '{}'),
    p_status,
    case when p_status = 'publicado' then 'revisado pela equipe OABase' end,
    case when p_status = 'publicado' then now() end
  )
  on conflict (questao_id) do update
    set corpo = excluded.corpo,
        status = excluded.status,
        -- Rascunho revisado e devolvido para rascunho não pode continuar
        -- assinado como revisado: a procedência acompanha o estado.
        autor = case
                  when excluded.status = 'publicado'
                    then 'revisado pela equipe OABase'
                  else public.comentarios.autor
                end,
        revisado_em = case
                        when excluded.status = 'publicado' then now()
                        else public.comentarios.revisado_em
                      end;
end;
$function$
;


