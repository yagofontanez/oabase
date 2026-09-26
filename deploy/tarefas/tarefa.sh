#!/bin/sh
# Chama uma rota de tarefa do app, como a função agendada da Netlify fazia.
#
# `TAREFAS_DO_APP=1` liga. Fica desligado enquanto a Netlify ainda responde
# pelo domínio: com as duas rodando, o e-mail do dia sairia em dobro.
set -eu
. /run/ambiente.sh

if [ "${TAREFAS_DO_APP:-0}" != "1" ]; then
  echo "$(date -u +%FT%TZ) tarefa $1: desligada (TAREFAS_DO_APP != 1)"
  exit 0
fi

inicio=$(date +%s)
if resposta=$(curl -fsS --max-time 120 \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "http://app:3000/api/tarefas/$1"); then
  echo "$(date -u +%FT%TZ) tarefa $1: ok em $(( $(date +%s) - inicio ))s — $resposta"
else
  echo "$(date -u +%FT%TZ) tarefa $1: FALHOU"
  exit 1
fi
