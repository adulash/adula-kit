#!/bin/sh
set -eu
attempt=0
while [ "$attempt" -lt 30 ]; do
  ready=true
  for service in web worker scheduler; do
    container=$(docker compose -f docker-compose.prod.yml ps -q "$service")
    if [ -z "$container" ] || [ "$(docker inspect --format '{{.State.Health.Status}}' "$container")" != healthy ]; then ready=false; fi
  done
  if [ "$ready" = true ]; then exit 0; fi
  attempt=$((attempt + 1))
  sleep 2
done
docker compose -f docker-compose.prod.yml logs --tail=50 web worker scheduler
exit 1
