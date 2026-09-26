#!/usr/bin/env bash
# Grava a chave do Backblaze B2 no ambiente da VPS e testa o envio. Rodar do
# seu computador, que abre o terminal da VPS e pergunta os valores:
#
#   ssh -t root@<vps> /opt/oabase/app/deploy/configurar-b2.sh
#
# A applicationKey é digitada sem eco e vai direto para /opt/oabase/.env
# (chmod 600) — não passa por histórico de shell, log, nem conversa.
#
# A chave deve ser "Write Only" e restrita ao bucket: quem invadir a VPS
# consegue enviar backup novo, mas não ler nem apagar os que já estão lá.
set -euo pipefail

ENV=/opt/oabase/.env
BUCKET=${1:-oabase-backup}

read -rp "keyID: " KEY_ID
read -rsp "applicationKey (não aparece enquanto digita): " APP_KEY; echo
[ -n "$KEY_ID" ] && [ -n "$APP_KEY" ] || { echo "valores vazios; nada gravado"; exit 1; }
case "$KEY_ID$APP_KEY" in *"'"*) echo "valor com aspas simples; nada gravado"; exit 1;; esac

# Troca, não acumula: rodar de novo substitui a chave anterior.
tmp=$(mktemp); umask 077
grep -vE '^(B2_BUCKET|B2_KEY_ID|B2_APPLICATION_KEY)=' "$ENV" > "$tmp" || true
{
  echo "B2_BUCKET='$BUCKET'"
  echo "B2_KEY_ID='$KEY_ID'"
  echo "B2_APPLICATION_KEY='$APP_KEY'"
} >> "$tmp"
cat "$tmp" > "$ENV"; rm -f "$tmp"
chown deploy:deploy "$ENV"; chmod 600 "$ENV"
echo "» chave gravada em $ENV"

cd /opt/oabase/app/deploy
docker compose up -d --force-recreate tarefas >/dev/null 2>&1
echo "» testando o envio para b2:$BUCKET (arquivo de teste, some pela regra de 30 dias)"
docker compose exec -T tarefas sh -c '
  . /run/ambiente.sh
  echo "teste de conexão da VPS do OABase — $(date -u +%FT%TZ)" > /tmp/teste-conexao.txt
  RCLONE_CONFIG_B2_TYPE=b2 RCLONE_CONFIG_B2_ACCOUNT="$B2_KEY_ID" RCLONE_CONFIG_B2_KEY="$B2_APPLICATION_KEY" \
    rclone copyto /tmp/teste-conexao.txt "b2:$B2_BUCKET/diario/teste-conexao.txt" --no-check-dest' \
  && echo "» ok: a VPS consegue enviar para o bucket" \
  || { echo "!! o envio falhou — confira keyID, applicationKey e se a chave é do bucket $BUCKET"; exit 1; }
