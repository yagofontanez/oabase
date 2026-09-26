#!/usr/bin/env bash
# Publica a versão atual da `main` na VPS. Rodar como `deploy`:
#
#   ssh deploy@<vps> /opt/oabase/app/deploy/deploy.sh
#
# Constrói a imagem nova com o site antigo ainda no ar, e só então troca o
# container — a janela fora do ar é a do reinício (poucos segundos), não a
# do build. Se o app novo não responder, avisa e deixa os logs à mão.
set -euo pipefail

cd /opt/oabase/app
echo "» atualizando o código"
git pull --ff-only --quiet origin main
echo "  $(git log -1 --format='%h %s')"

cd deploy
echo "» construindo as imagens (o site continua no ar)"
docker compose build --pull

echo "» trocando os containers"
docker compose up -d --remove-orphans

echo "» esperando o app responder"
for _ in $(seq 1 45); do
  estado=$(docker inspect -f '{{.State.Health.Status}}' "$(docker compose ps -q app)" 2>/dev/null || echo "?")
  if [ "$estado" = "healthy" ]; then
    echo "  app saudável"
    docker image prune -f >/dev/null
    exit 0
  fi
  sleep 2
done

echo "  !! o app não ficou saudável em 90 s — últimas linhas do log:"
docker compose logs --tail 40 app
exit 1
