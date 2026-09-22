#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
for service in web worker scheduler; do
  container=$(docker compose -f docker-compose.prod.yml ps -q "$service")
  [ -n "$container" ] || exit 1
  if [ "$(docker inspect --format '{{.State.Health.Status}}' "$container")" = unhealthy ]; then
    docker compose -f docker-compose.prod.yml restart "$service"
  fi
done
