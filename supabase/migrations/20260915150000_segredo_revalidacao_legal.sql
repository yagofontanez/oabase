-- A ingestao e a rota do site compartilham um segredo de capacidade proprio,
-- sem reutilizar o cron de e-mail ou o webhook de pagamento. A origem do
-- segredo continua sendo o banco; nenhum valor e gravado no repositorio.
insert into interno.segredos (chave, valor)
values ('revalidacao_legal', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (chave) do nothing;

create or replace function public.confere_segredo_revalidacao_legal(p_segredo text)
returns boolean
language sql
stable
security definer
set search_path = interno
as $$
  select coalesce(
    p_segredo = (
      select valor from interno.segredos where chave = 'revalidacao_legal'
    ),
    false
  );
$$;

revoke execute on function public.confere_segredo_revalidacao_legal(text)
  from public, authenticated;
grant execute on function public.confere_segredo_revalidacao_legal(text)
  to anon;

comment on function public.confere_segredo_revalidacao_legal(text) is
  'Verifica apenas o segredo de revalidacao; nao devolve o valor armazenado.';
