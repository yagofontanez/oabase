#!/usr/bin/env bash
#
# Tenta ingerir o 47º Exame, de hora em hora, até conseguir.
#
# A prova é aplicada em 06/09/2026 e a FGV publica o caderno e o gabarito em
# momentos que ela não anuncia — às vezes na mesma noite, às vezes dois dias
# depois. Ficar atualizando a página do arquivo oficial à mão é o tipo de
# trabalho que se esquece justamente no fim de semana em que importa.
#
# O script é feito para rodar em vão: se a edição já entrou, ele sai em um
# segundo sem falar com ninguém. Quando entrar de verdade, ele se desliga
# sozinho — remove a própria linha do crontab e deixa o registro no log.
#
# Instalado em:  crontab -l
# Log em:        ingest/saida/ingestao-47.log
#
set -uo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$RAIZ" || exit 1

EDICAO=47
LOG="$RAIZ/saida/ingestao-47.log"
mkdir -p "$RAIZ/saida"

registrar() { echo "[$(date '+%F %T')] $*" >>"$LOG"; }

# O .env.local mora na raiz do projeto, um nível acima.
set -a
# shellcheck disable=SC1091
. "$RAIZ/../.env.local" >/dev/null 2>&1
set +a

if [ -z "${SUPABASE_CONNECTION_STRING:-}" ]; then
  registrar "sem SUPABASE_CONNECTION_STRING — nada a fazer"
  exit 1
fi

carregadas() {
  psql "$SUPABASE_CONNECTION_STRING" -tAc \
    "select coalesce(questoes_carregadas, 0) from public.exames where edicao = $EDICAO" \
    2>/dev/null | tr -d '[:space:]'
}

JA="$(carregadas)"
if [ -n "$JA" ] && [ "$JA" -gt 0 ] 2>/dev/null; then
  # Já entrou numa execução anterior: desarma e sai.
  registrar "$EDICAO já tem $JA questões — desarmando o cron"
  crontab -l 2>/dev/null | grep -v 'ingerir-47.sh' | crontab -
  exit 0
fi

registrar "tentando ingerir o ${EDICAO}º"

# O manifesto é redescoberto a cada tentativa: é ele que sabe se a FGV já
# publicou o caderno e o gabarito desta edição.
python3 -m oabase_ingest.lote --manifesto >>"$LOG" 2>&1

# `lote` faz o resto: baixa os dois PDFs, decide sozinho se o gabarito é
# preliminar ou definitivo (`gabarito_definitivo` do manifesto) e chama o
# pipeline. Enquanto só existir o caderno, a edição não é `completa` e ele sai
# sem fazer nada — que é o certo: questão sem resposta não entra no banco.
python3 -m oabase_ingest.lote --de "$EDICAO" --ate "$EDICAO" --carregar \
  >>"$LOG" 2>&1

DEPOIS="$(carregadas)"
if [ -n "$DEPOIS" ] && [ "$DEPOIS" -gt 0 ] 2>/dev/null; then
  registrar "✓ ${EDICAO}º ingerido: $DEPOIS questões"

  # Sem isto, a prova nova não liga em artigo nenhum e a incidência continua
  # a de ontem — que é metade do valor de ter a edição no ar.
  python3 -m oabase_ingest.dispositivos --carregar >>"$LOG" 2>&1
  registrar "vínculos questão↔artigo recalculados"

  command -v notify-send >/dev/null &&
    notify-send "OABase" "${EDICAO}º Exame ingerido: $DEPOIS questões."

  crontab -l 2>/dev/null | grep -v 'ingerir-47.sh' | crontab -
  registrar "cron desarmado"
else
  registrar "ainda não publicado — nova tentativa na próxima hora"
fi
