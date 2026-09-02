#!/usr/bin/env bash
#
# Classificação e vínculo automáticos sobre a base inteira.
#
# A conta gratuita da Groq dá 8.000 tokens por minuto: a base leva horas, e
# uma execução de horas vai ser interrompida. Por isso os dois módulos gravam
# a cada lote e as consultas deles só trazem o que ainda falta — repetir este
# comando continua de onde parou, quantas vezes for preciso.
#
# Rodam em sequência, e não juntos: dividir o mesmo teto de tokens entre dois
# processos só faz os dois baterem em 429 e esperarem em dobro.
#
#   cd ingest && ./enriquecer.sh
#
set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$RAIZ" || exit 1

set -a
# shellcheck disable=SC1091
. "$RAIZ/../.env.local" >/dev/null 2>&1
set +a

registrar() { echo "[$(date '+%F %T')] $*"; }

registrar "classificação por disciplina"
python3 -m oabase_ingest.classificar_ia --carregar

registrar "vínculo questão ↔ dispositivo"
python3 -m oabase_ingest.vincular_ia --carregar

registrar "recalculando incidência"
psql "$SUPABASE_CONNECTION_STRING" -q -c \
  "select public.recalcular_incidencia(array(select id from public.artigos));"

registrar "fim"
