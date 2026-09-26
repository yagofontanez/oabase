#!/bin/sh
# Backup do banco do Supabase (São Paulo) para esta VPS e, se configurado,
# para o Backblaze B2 — criptografado antes de sair.
#
# O que entra: `public` (o produto), `interno` (papéis e segredos) e `auth`
# (contas e hashes de senha). Sem `auth`, restaurar recuperaria os dados sem
# as contas que são donas deles.
#
# Retenção local: 7 diários + 4 semanais (o de domingo). O dump tem dado
# pessoal (e-mail, CPF): a pasta é só do root, e a cópia externa sai
# criptografada com `age` para uma chave pública — a privada fica com o
# dono do projeto, fora deste servidor. Vazar o bucket não vaza a base.
set -eu
. /run/ambiente.sh
umask 077

DIA=$(date -u +%F)
DIR=/backups
mkdir -p "$DIR/diario" "$DIR/semanal"
ARQ="$DIR/diario/oabase-$DIA.dump"

echo "$(date -u +%FT%TZ) backup: começando"
pg_dump "$SUPABASE_CONNECTION_STRING" \
  --format=custom --compress=6 --no-owner --no-privileges \
  --schema=public --schema=interno --schema=auth \
  --file="$ARQ.parcial"

# Dump que não se lê não é backup: lista o conteúdo antes de aceitar.
TABELAS=$(pg_restore --list "$ARQ.parcial" | grep -c "TABLE DATA" || true)
if [ "$TABELAS" -lt 10 ]; then
  echo "$(date -u +%FT%TZ) backup: FALHOU — só $TABELAS tabelas no dump"
  rm -f "$ARQ.parcial"
  exit 1
fi
mv "$ARQ.parcial" "$ARQ"
echo "$(date -u +%FT%TZ) backup: ok — $(du -h "$ARQ" | cut -f1), $TABELAS tabelas"

# Domingo vira semanal.
[ "$(date -u +%u)" = "7" ] && cp "$ARQ" "$DIR/semanal/"
find "$DIR/diario" -name '*.dump' -mtime +7 -delete
find "$DIR/semanal" -name '*.dump' -mtime +28 -delete

# Cópia externa: só com bucket e chave pública configurados.
#
# `--no-check-dest`: a chave do B2 é só de escrita (quem invadir a VPS não lê
# nem apaga backup antigo), e sem a flag o rclone faz um HEAD para ver se o
# arquivo já existe — leitura, que a chave não tem, e o envio falha com 401.
if [ -n "${B2_BUCKET:-}" ] && [ -n "${BACKUP_AGE_RECIPIENT:-}" ]; then
  age -r "$BACKUP_AGE_RECIPIENT" -o "$ARQ.age" "$ARQ"
  RCLONE_CONFIG_B2_TYPE=b2 \
  RCLONE_CONFIG_B2_ACCOUNT="$B2_KEY_ID" \
  RCLONE_CONFIG_B2_KEY="$B2_APPLICATION_KEY" \
    rclone copyto "$ARQ.age" "b2:$B2_BUCKET/diario/$(basename "$ARQ").age" --no-check-dest
  rm -f "$ARQ.age"
  echo "$(date -u +%FT%TZ) backup: cópia criptografada enviada ao B2"
else
  echo "$(date -u +%FT%TZ) backup: AVISO — sem cópia externa (B2_BUCKET/BACKUP_AGE_RECIPIENT ausentes)"
fi
