#!/bin/sh
# O crond do Alpine não repassa o ambiente do container aos jobs: sem isto,
# CRON_SECRET e a conexão do banco chegariam vazios. O ambiente vai para um
# arquivo que só o root lê, e cada job o carrega.
set -eu
umask 077
export -p > /run/ambiente.sh
echo "tarefas: cron no ar (UTC $(date -u +%H:%M)); tarefas do app $( [ "${TAREFAS_DO_APP:-0}" = 1 ] && echo LIGADAS || echo desligadas )"
exec crond -f -l 8
