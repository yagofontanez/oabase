-- ============================================================================
-- Súmula comum e súmula vinculante convivem no mesmo tribunal.
--
-- A chave era `(tribunal, numero)`, e ela funcionava enquanto só existiam as
-- Vinculantes. O STF tem as duas séries, cada uma com sua numeração própria:
-- a Súmula Vinculante 1 e a Súmula 1 são enunciados diferentes, sobre
-- assuntos diferentes, e as duas são `(stf, 1)`.
--
-- Sem esta migration, carregar as comuns sobrescreveria as vinculantes uma a
-- uma pelo `on conflict` — silenciosamente, com o total continuando certo. É
-- o tipo de perda que só aparece quando alguém procura a SV 11 e encontra
-- outra coisa no lugar.
-- ============================================================================

alter table public.sumulas
  drop constraint if exists sumulas_tribunal_numero_key;

alter table public.sumulas
  add constraint sumulas_tribunal_numero_key unique (tribunal, numero, vinculante);

-- O slug já distingue as duas séries (`sumula-vinculante-4` e
-- `sumula-stf-473`), mas nada garantia isso no banco. Agora garante.
create unique index if not exists sumulas_slug_key on public.sumulas (slug);
