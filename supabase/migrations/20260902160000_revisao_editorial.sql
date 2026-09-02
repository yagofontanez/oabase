-- ============================================================================
-- Revisão editorial: quem pode confirmar disciplina e publicar comentário.
--
-- Os dois gargalos do projeto são trabalho humano, não código: 3.460 questões
-- classificadas por heurística e nenhuma confirmada; 5.756 artigos e quatro
-- comentados. O que o código pode fazer é tirar o atrito do caminho — e para
-- isso precisa de um conceito que ainda não existia: editor.
--
-- **O sinalizador NÃO mora em `perfis`.** A política de `perfis` é de dono
-- com `with check (auth.uid() = id)`: uma coluna `editor` ali seria uma coluna
-- que a própria pessoa pode marcar como verdadeira, do navegador, com a chave
-- anônima. Escalação de privilégio em uma linha de UPDATE. Fica em
-- `interno.editores`, no mesmo esquema sem permissão para papel nenhum onde
-- vivem os segredos: só função `security definer` enxerga.
--
-- Conceder é ato de operador, por SQL, como a cortesia:
--
--     insert into interno.editores (user_id)
--     select id from auth.users where email = '...';
--
-- As funções de escrita são `security definer` pelo motivo de sempre: dar
-- `update` em `artigos` ou `questoes` ao papel `authenticated` abriria a
-- tabela inteira para qualquer coluna. Aqui cada função escreve exatamente
-- os campos que o seu nome promete.
-- ============================================================================

create table if not exists interno.editores (
  user_id uuid primary key references auth.users(id) on delete cascade,
  criado_em timestamptz not null default now()
);
revoke all on interno.editores from public;

create or replace function public.sou_editor()
returns boolean
language sql
stable
security definer
set search_path = public, interno
as $$
  select exists (select 1 from interno.editores e where e.user_id = auth.uid());
$$;

grant execute on function public.sou_editor() to authenticated;

-- ---------------------------------------------------------------------------
-- Fila de classificação
--
-- `security definer` porque a RLS de `questoes` exige assinatura ativa e
-- editor não é necessariamente assinante. **Não devolve `gabarito`**: quem
-- classifica por disciplina não precisa da resposta, e o que não sai do banco
-- não vaza.
--
-- A ordem é da edição mais nova para a mais velha: prova recente é a que
-- pesa nas estatísticas que o site publica.
-- ---------------------------------------------------------------------------
create or replace function public.fila_de_revisao(
  p_exame text default null,
  p_limite int default 20
)
returns table (
  id uuid,
  numero int,
  exame text,
  edicao int,
  enunciado text,
  alternativas jsonb,
  palpite text,
  anulada boolean
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
    select q.id, q.numero, e.slug, e.edicao, q.enunciado, q.alternativas,
           d.slug, q.anulada
      from public.questoes q
      join public.exames e on e.id = q.exame_id
      left join public.disciplinas d on d.id = q.disciplina_id
     where not q.disciplina_confirmada
       and (p_exame is null or e.slug = p_exame)
     order by e.edicao desc, q.numero
     limit least(greatest(p_limite, 1), 100);
end;
$$;

grant execute on function public.fila_de_revisao(text, int) to authenticated;

-- Quanto falta. Uma consulta separada porque a tela mostra o progresso e a
-- fila devolve só a próxima página.
create or replace function public.revisao_pendente()
returns table (pendentes bigint, confirmadas bigint)
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
    select count(*) filter (where not disciplina_confirmada),
           count(*) filter (where disciplina_confirmada)
      from public.questoes;
end;
$$;

grant execute on function public.revisao_pendente() to authenticated;

-- ---------------------------------------------------------------------------
-- Confirmar a disciplina de uma questão
--
-- Confirmar é afirmar que um humano leu. Por isso não existe "confirmar sem
-- disciplina": o palpite errado do léxico e a ausência de palpite são a mesma
-- coisa para quem consome o dado, e marcar `confirmada` sem escolher
-- transformaria "ninguém sabe" em "alguém verificou".
-- ---------------------------------------------------------------------------
create or replace function public.confirmar_disciplina(
  p_questao uuid,
  p_disciplina_slug text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_disciplina uuid;
begin
  if not public.sou_editor() then
    raise exception 'não autorizado' using errcode = '42501';
  end if;

  select id into v_disciplina
    from public.disciplinas where slug = p_disciplina_slug;

  if v_disciplina is null then
    raise exception 'disciplina % não existe', p_disciplina_slug
      using errcode = '22023';
  end if;

  update public.questoes
     set disciplina_id = v_disciplina,
         disciplina_confirmada = true,
         atualizado_em = now()
   where id = p_questao;
end;
$$;

grant execute on function public.confirmar_disciplina(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Publicar comentário de artigo
--
-- O portão de qualidade vira invariante do banco: **não existe artigo
-- indexável sem comentário**. Estava certo no código do sitemap e na cabeça
-- de quem escreveu; aqui passa a ser impossível de violar por engano — que é
-- a diferença entre uma regra e um combinado.
--
-- `atualizado_em` muda junto porque é o `lastModified` do sitemap: comentário
-- novo com data velha é pedir para o rastreador não voltar.
-- ---------------------------------------------------------------------------
create or replace function public.publicar_comentario(
  p_artigo uuid,
  p_comentario text[],
  p_indexavel boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.sou_editor() then
    raise exception 'não autorizado' using errcode = '42501';
  end if;

  if p_indexavel and coalesce(array_length(p_comentario, 1), 0) = 0 then
    raise exception 'artigo sem comentário não pode ser indexável'
      using errcode = '22023';
  end if;

  update public.artigos
     set comentario = coalesce(p_comentario, '{}'),
         indexavel = p_indexavel,
         atualizado_em = now()
   where id = p_artigo;
end;
$$;

grant execute on function public.publicar_comentario(uuid, text[], boolean)
  to authenticated;
