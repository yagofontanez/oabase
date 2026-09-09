-- A anotação pertence ao bloco executável, não ao plano gerado pela IA.
-- Assim ela acompanha o progresso daquela versão e nunca vira contexto
-- jurídico inventado pelo modelo.
alter table public.roadmap_itens
  add column anotacao text not null default ''
    check (char_length(anotacao) <= 2000),
  add column atualizado_em timestamptz not null default now();

comment on column public.roadmap_itens.anotacao is
  'Registro livre do aluno sobre o bloco; máximo de 2.000 caracteres.';
