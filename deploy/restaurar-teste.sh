#!/usr/bin/env bash
# Prova de que o backup restaura: sobe um Postgres descartável, restaura o
# dump mais recente e confere as contagens. Rodar como root na VPS:
#
#   /opt/oabase/app/deploy/restaurar-teste.sh
#
# Backup que nunca foi restaurado é esperança, não backup. O primeiro teste
# falhou justamente aqui: as tabelas principais dependem do schema
# `extensions` do Supabase (vector, unaccent, pgcrypto, uuid-ossp), que não
# vai no dump — num Postgres puro, `questoes` simplesmente não era criada.
# Este script é também o procedimento de recuperação: os mesmos passos
# servem para restaurar num servidor novo.
#
# Não toca a produção: o container é apagado ao fim.
set -euo pipefail

DUMP=$(ls -1 /opt/oabase/backups/diario/*.dump | tail -1)
NOME=restauro-teste
echo "» restaurando $(basename "$DUMP") num Postgres descartável"

docker rm -f "$NOME" >/dev/null 2>&1 || true
docker run -d --name "$NOME" -e POSTGRES_PASSWORD=descartavel \
  -v "$(dirname "$DUMP")":/dump:ro pgvector/pgvector:pg17 >/dev/null
trap 'docker rm -f "$NOME" >/dev/null 2>&1' EXIT
for _ in $(seq 1 30); do docker exec "$NOME" pg_isready -q -U postgres && break; sleep 1; done

# O que o Supabase já traz pronto e o dump pressupõe: papéis das políticas
# de RLS e as extensões no schema `extensions`.
docker exec "$NOME" psql -q -U postgres -v ON_ERROR_STOP=1 -c "
  create role anon; create role authenticated; create role service_role;
  create schema extensions;
  create extension pgcrypto with schema extensions;
  create extension unaccent with schema extensions;
  create extension \"uuid-ossp\" with schema extensions;
  create extension vector with schema extensions;"

docker exec "$NOME" pg_restore -U postgres -d postgres --no-owner --no-privileges \
  "/dump/$(basename "$DUMP")" > /tmp/restauro.log 2>&1 || true
echo "  avisos do pg_restore: $(grep -c 'error:' /tmp/restauro.log || true) (ver /tmp/restauro.log)"

docker exec "$NOME" psql -U postgres -A -t -c "
  select '  questoes '||(select count(*) from public.questoes)||
         ' | artigos '||(select count(*) from public.artigos)||
         ' | leis '||(select count(*) from public.leis)||
         ' | contas '||(select count(*) from auth.users)||
         ' | assinaturas '||(select count(*) from public.assinaturas)||
         ' | comentarios '||(select count(*) from public.comentarios);"
