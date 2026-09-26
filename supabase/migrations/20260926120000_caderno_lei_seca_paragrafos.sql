-- ============================================================================
-- O caderno de lei seca passa a devolver os parágrafos de cada artigo.
--
-- A lista mostrava só o caput, e bastava: é índice, e o artigo inteiro fica
-- a um clique. Ouvir o caderno em sequência muda isso — quem escuta no ônibus
-- não clica, e ouvir "Art. 7º. São direitos do advogado:" e pular para o
-- próximo é ouvir a metade que não cai. Por isso os parágrafos (incisos e
-- alíneas inclusos, que é onde o Planalto os guarda) vêm junto.
--
-- Mudar o tipo de retorno exige recriar a função. Continua `security
-- invoker` e liberada só para `authenticated`: quem recorta é a RLS de
-- `caderno_lei_seca`, como antes.
-- ============================================================================

drop function if exists public.listar_meu_caderno_lei_seca();

create function public.listar_meu_caderno_lei_seca()
returns table (
  artigo_id uuid,
  lei_slug text,
  lei_nome text,
  lei_sigla text,
  artigo_slug text,
  numero text,
  caput text,
  paragrafos text[],
  nota text,
  lido_em timestamptz,
  revisar_em date,
  favorito boolean,
  importante_para text,
  visto_em_questao boolean,
  atualizado_em timestamptz,
  destaques integer
)
language sql
stable
set search_path = public
as $$
  select
    c.artigo_id,
    l.slug,
    l.nome,
    l.sigla,
    a.slug,
    a.numero,
    a.caput,
    a.paragrafos,
    c.nota,
    c.lido_em,
    c.revisar_em,
    c.favorito,
    c.importante_para,
    c.visto_em_questao,
    c.atualizado_em,
    (select count(*)::integer from public.caderno_lei_destaques d
      where d.user_id = c.user_id and d.artigo_id = c.artigo_id)
  from public.caderno_lei_seca c
  join public.artigos a on a.id = c.artigo_id
  join public.leis l on l.id = a.lei_id
  where c.user_id = auth.uid()
  order by
    (c.revisar_em is not null and c.revisar_em <= current_date) desc,
    c.favorito desc,
    c.atualizado_em desc;
$$;

revoke execute on function public.listar_meu_caderno_lei_seca() from public, anon;
grant execute on function public.listar_meu_caderno_lei_seca() to authenticated;
