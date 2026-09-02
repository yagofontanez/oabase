-- ============================================================================
-- Classificação e vínculo automáticos, sem mentir sobre a procedência.
--
-- O acervo tem 3.460 questões sem disciplina confirmada e 3.317 sem nenhum
-- artigo vinculado. Confirmar e vincular à mão é trabalho de meses, e o
-- produto precisa dos dois números agora.
--
-- A saída **não** é marcar palpite como revisão humana. `disciplina_confirmada`
-- significa "alguém leu"; virar essa coluna por script faria o site publicar
-- como medição o que é estimativa, que é exatamente o defeito que o projeto
-- inteiro evita. A saída é registrar **de onde veio** cada classificação e
-- cada vínculo, e deixar cada consumidor escolher o que aceita.
--
--   classificacao_origem: 'lexico' | 'sequencia' | 'modelo' | 'humano'
--   questao_artigos.origem: 'citacao' | 'modelo' | 'humano'
--
-- E, no artigo, dois contadores em vez de um:
--
--   incidencia           — só o verificável (citação no enunciado + humano).
--                          É o número que a página pública mostra e que
--                          ordena "onde já caiu": relendo a questão, dá para
--                          conferir. Não muda de significado.
--   incidencia_estimada  — tudo, inclusive o que o modelo inferiu. É o que
--                          ordena a fila de quem escreve comentário, onde
--                          errar custa uma leitura a mais e não um dado
--                          falso publicado.
--
-- Um contador só, somando as duas origens, seria mais simples e destruiria a
-- distinção no lugar onde ela mais importa: a página aberta de legislação.
-- ============================================================================

alter table public.questoes
  add column if not exists classificacao_origem text not null default 'lexico'
    check (classificacao_origem in ('lexico', 'sequencia', 'modelo', 'humano'));

comment on column public.questoes.classificacao_origem is
  'De onde veio a disciplina. `disciplina_confirmada` continua significando '
  'revisão humana e nunca é escrita por script.';

alter table public.questao_artigos
  drop constraint if exists questao_artigos_origem_check;

alter table public.questao_artigos
  add constraint questao_artigos_origem_check
  check (origem in ('citacao', 'modelo', 'humano'));

alter table public.artigos
  add column if not exists incidencia_estimada int not null default 0;

comment on column public.artigos.incidencia_estimada is
  'Vínculos de todas as origens, inclusive inferidos por modelo. Ordena a '
  'fila editorial; não é publicada como medição.';

create index if not exists artigos_incidencia_estimada_idx
  on public.artigos (lei_id, incidencia_estimada desc);

-- O recálculo passa a manter os dois. `incidencia` continua contando só o que
-- se confere relendo a questão — é a garantia de que ampliar a cobertura
-- automática nunca inflaciona o número que o site publica.
create or replace function public.recalcular_incidencia(p_artigos uuid[])
returns void
language sql
security definer
set search_path = public
as $$
  update public.artigos a
     set incidencia = coalesce(
           (select count(*) from public.questao_artigos qa
             where qa.artigo_id = a.id
               and qa.origem in ('citacao', 'humano')),
           0
         ),
         incidencia_estimada = coalesce(
           (select count(*) from public.questao_artigos qa
             where qa.artigo_id = a.id),
           0
         )
   where a.id = any(p_artigos);
$$;

-- Semeia a coluna nova com o que já existe.
update public.artigos a
   set incidencia_estimada = coalesce(
         (select count(*) from public.questao_artigos qa where qa.artigo_id = a.id),
         0
       )
 where a.incidencia_estimada = 0;

-- ---------------------------------------------------------------------------
-- Distribuição por exame, calculada da classificação disponível
--
-- A ficha de cada exame dizia "a distribuição desta edição ainda não foi
-- publicada: depende de revisão manual". Com classificação de modelo em toda
-- a base, ela passa a existir — e a tela diz de onde veio, em vez de calar.
-- ---------------------------------------------------------------------------
create or replace function public.distribuicao_do_exame(p_exame_slug text)
returns table (disciplina_slug text, disciplina_nome text, questoes bigint)
language sql
stable
security definer
set search_path = public
as $$
  select d.slug, d.nome, count(*)
    from public.questoes q
    join public.exames e on e.id = q.exame_id
    join public.disciplinas d on d.id = q.disciplina_id
   where e.slug = p_exame_slug
   group by d.slug, d.nome
   order by count(*) desc, d.nome;
$$;

grant execute on function public.distribuicao_do_exame(text) to anon, authenticated;
