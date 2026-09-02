-- ============================================================================
-- Dispositivo no quadro de anotações.
--
-- O quadro nasceu com dois tipos de cartão: nota livre e questão respondida.
-- Faltava o terceiro lado do triângulo que a pessoa de fato monta na cabeça —
-- "errei esta questão por causa deste artigo" —, e sem ele a regra só existia
-- como texto digitado à mão dentro de uma nota, sem link e sem atualização.
--
-- Artigo e súmula entram como tipos próprios, e não como um `dispositivo`
-- genérico com um campo de texto: o cartão aponta para a linha real, então
-- leva ao texto oficial, sabe se já tem comentário e some junto se a linha
-- sair do acervo.
--
-- A ligação continua sem semântica. Vale para as novas arestas o mesmo que
-- valia para as antigas: o sentido é de quem escreve o rótulo.
-- ============================================================================

alter table public.quadro_nos
  add column if not exists artigo_id uuid
    references public.artigos(id) on delete cascade,
  add column if not exists sumula_id uuid
    references public.sumulas(id) on delete cascade;

alter table public.quadro_nos
  drop constraint if exists quadro_nos_tipo_check;

alter table public.quadro_nos
  add constraint quadro_nos_tipo_check
  check (tipo in ('nota', 'questao', 'artigo', 'sumula'));

-- Cartão de questão sem questão, cartão de artigo com súmula junto, nota
-- carregando qualquer coisa: são formas de estado inconsistente que a
-- aplicação teria de tratar para sempre. Barradas aqui, não existem.
alter table public.quadro_nos
  drop constraint if exists quadro_nos_questao_coerente;

alter table public.quadro_nos
  add constraint quadro_nos_referencia_coerente check (
    (tipo = 'nota'    and questao_id is null and artigo_id is null and sumula_id is null) or
    (tipo = 'questao' and questao_id is not null and artigo_id is null and sumula_id is null) or
    (tipo = 'artigo'  and artigo_id is not null and questao_id is null and sumula_id is null) or
    (tipo = 'sumula'  and sumula_id is not null and questao_id is null and artigo_id is null)
  );

-- O mesmo dispositivo duas vezes no quadro é sempre engano, nunca intenção —
-- a mesma regra que já valia para questão.
create unique index if not exists quadro_nos_artigo_unico
  on public.quadro_nos (user_id, artigo_id)
  where artigo_id is not null;

create unique index if not exists quadro_nos_sumula_unica
  on public.quadro_nos (user_id, sumula_id)
  where sumula_id is not null;
