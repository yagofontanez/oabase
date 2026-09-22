# Como contribuir

Obrigado por contribuir com o OABase. Este repositório lida com estudo jurídico e dados de pessoas; uma alteração aparentemente pequena pode afetar acesso, segurança ou confiança editorial.

## Antes de abrir uma alteração

1. Leia `AGENTS.md`. Ele registra invariantes de produto, dados, busca, ingestão, indexação e RLS.
2. Mantenha cada mudança pequena e verificável.
3. Não inclua segredos, arquivos `.env`, PDFs baixados, dumps de banco ou dados de alunos.

## Regras inegociáveis

- Não misture conteúdo público com `/app`; páginas pagas não entram em sitemap nem recebem indexação.
- Não consulte a origem de conteúdo em componentes de página. Use o contrato em `src/lib/content/queries.ts`.
- Não use `SUPABASE_SERVICE_ROLE_KEY` no app. A chave anônima e RLS são a fronteira de acesso.
- Só adicione ao acervo atos oficiais. Não copie, raspe ou reescreva conteúdo de cursinhos, blogs ou portais jurídicos.
- Não apresente classificação aproximada, dado inferido ou conteúdo de IA como revisão humana ou fato jurídico confirmado.

## Banco e migrations

1. Crie uma migration em `supabase/migrations/`.
2. Execute `supabase db reset` localmente.
3. Teste RLS com os papéis e identidades relevantes.
4. Só então aplique no remoto com `supabase db push`.

Uma migration que mexa em tabelas de conteúdo ou produto deve preservar as políticas existentes e documentar o motivo de qualquer `security definer`.

## Verificação

Rode o que for pertinente antes de enviar:

```bash
pnpm lint
pnpm build
pnpm test:mcp
pnpm fronteira
```

Para mudanças de ingestão, execute o pipeline em modo seco e registre a fonte oficial usada. Para mudanças de busca, teste consultas acentuadas e sem acento, números de artigo e resultados vazios.

## Pull requests

Explique o problema, a solução, as rotas/tabelas afetadas e como validou. Inclua capturas para mudanças visuais. Nunca envie um PR que dependa de um segredo não documentado em `.env.example`.
