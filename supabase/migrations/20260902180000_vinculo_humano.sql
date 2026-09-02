-- ============================================================================
-- Vínculo questão ↔ artigo confirmado por humano.
--
-- `dispositivos.py` acha 133 vínculos em 3.460 questões — 4%. Não é defeito do
-- regex: a FGV narra um caso e quase nunca nomeia o dispositivo. O resto do
-- acervo cobra artigo sem dizer qual.
--
-- A tentação é preencher isso por semelhança de texto e chamar de vínculo. A
-- migration que criou `questao_artigos` já recusou essa saída, e ela continua
-- recusada: `origem` só aceita 'citacao' e 'humano' justamente para que
-- `artigos.incidencia` continue sendo contagem, e não palpite com aparência
-- de medição.
--
-- O que falta, então, não é um algoritmo: é uma pessoa dizendo "sim, é este".
-- Estas funções existem para tornar esse gesto barato — a sugestão por
-- semelhança aparece na tela, e o que ela produz ao ser aceita é
-- `origem = 'humano'`, que é a verdade: alguém leu e afirmou.
--
-- `sugestoes_de_artigo` é `security definer` envolvendo uma função que é
-- `security invoker`. Sem isso, editor sem assinatura ativa recebe zero
-- sugestões — a RLS de `questoes` não sabe o que é um editor.
-- ============================================================================

create or replace function public.fila_de_vinculo(p_limite int default 12)
returns table (
  id uuid,
  numero int,
  edicao int,
  exame text,
  enunciado text,
  alternativas jsonb,
  disciplina text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.sou_editor() then
    raise exception 'não autorizado' using errcode = '42501';
  end if;

  return query
    select q.id, q.numero, e.edicao, e.slug, q.enunciado, q.alternativas, d.nome
      from public.questoes q
      join public.exames e on e.id = q.exame_id
      left join public.disciplinas d on d.id = q.disciplina_id
     where not exists (
             select 1 from public.questao_artigos qa where qa.questao_id = q.id
           )
       and not q.anulada
     order by e.edicao desc, q.numero
     limit least(greatest(p_limite, 1), 50);
end;
$$;

grant execute on function public.fila_de_vinculo(int) to authenticated;

create or replace function public.sugestoes_de_artigo(
  p_questao uuid,
  p_limite int default 6
)
returns table (
  lei_slug text,
  lei_sigla text,
  artigo_slug text,
  numero text,
  caput text,
  relevancia real
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.sou_editor() then
    raise exception 'não autorizado' using errcode = '42501';
  end if;

  return query
    select s.lei_slug, s.lei_sigla, s.artigo_slug, s.numero, s.caput,
           s.relevancia
      from public.artigos_proximos_da_questao(p_questao, p_limite) s;
end;
$$;

grant execute on function public.sugestoes_de_artigo(uuid, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Afirmar o vínculo
--
-- `origem = 'humano'` não é detalhe de auditoria: é o que separa este número
-- do palpite. O gatilho de `questao_artigos` recalcula `artigos.incidencia`
-- sozinho, então cada confirmação aqui reordena, na hora, a fila de quem
-- escreve comentário.
-- ---------------------------------------------------------------------------
create or replace function public.vincular_artigo(
  p_questao uuid,
  p_lei_slug text,
  p_artigo_slug text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_artigo uuid;
begin
  if not public.sou_editor() then
    raise exception 'não autorizado' using errcode = '42501';
  end if;

  select a.id into v_artigo
    from public.artigos a
    join public.leis l on l.id = a.lei_id
   where l.slug = p_lei_slug and a.slug = p_artigo_slug;

  if v_artigo is null then
    raise exception 'artigo %/% não existe', p_lei_slug, p_artigo_slug
      using errcode = '22023';
  end if;

  -- Vínculo por citação nunca é rebaixado a 'humano': o que já é verificável
  -- relendo a questão continua sendo a origem mais forte das duas.
  insert into public.questao_artigos (questao_id, artigo_id, origem)
  values (p_questao, v_artigo, 'humano')
  on conflict (questao_id, artigo_id) do nothing;
end;
$$;

grant execute on function public.vincular_artigo(uuid, text, text)
  to authenticated;
