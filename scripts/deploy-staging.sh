#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BRANCH="staging"
COMPOSE_FILE="docker-compose.yml"
SMOKE_SCRIPT="$APP_DIR/scripts/smoke-check.sh"
SMOKE_BASE_URL="${SMOKE_BASE_URL:-https://staging.mikilead.ru}"
SMOKE_HEALTH_URL="${SMOKE_HEALTH_URL:-${SMOKE_BASE_URL}/health}"
MIGRATION_SERVICE="${MIGRATION_SERVICE:-api}"
MIGRATION_COMMAND="${MIGRATION_COMMAND:-npm run migrate}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

cleanup() {
  local exit_code=$?
  if [ $exit_code -ne 0 ]; then
    log "Deploy failed with exit code $exit_code"
  fi
}
trap cleanup EXIT

log "Starting staging deploy"
cd "$APP_DIR"

log "Fetching latest code"
git fetch origin

log "Checkout ${BRANCH}"
git checkout "$BRANCH"
git reset --hard "origin/${BRANCH}"

test -f .env || { echo ".env file not found"; exit 1; }

log "Ensuring database dependencies are up"
docker compose -f "$COMPOSE_FILE" up -d postgres redis

log "Building ${MIGRATION_SERVICE} image for migrations"
docker compose -f "$COMPOSE_FILE" build "$MIGRATION_SERVICE"

log "Running database migrations via ${MIGRATION_SERVICE}"
docker compose -f "$COMPOSE_FILE" run --rm "$MIGRATION_SERVICE" $MIGRATION_COMMAND

log "Build and start containers"
docker compose -f "$COMPOSE_FILE" up -d --build

log "Restart nginx to pick up config changes"
docker compose -f "$COMPOSE_FILE" restart nginx

log "Wait for API inside docker network"
for i in {1..30}; do
  if docker compose -f "$COMPOSE_FILE" exec -T nginx wget -q -O /dev/null http://api:4000/health; then
    log "API is reachable from nginx"
    break
  fi
  log "API check attempt $i failed"
  sleep 2
done

log "Wait for WEB inside docker network"
for i in {1..30}; do
  if docker compose -f "$COMPOSE_FILE" exec -T nginx wget -q -O /dev/null http://web:4000/; then
    log "WEB is reachable from nginx"
    break
  fi
  log "WEB check attempt $i failed"
  sleep 2
done

log "External health check against ${SMOKE_HEALTH_URL}"
for i in {1..20}; do
  HTTP_CODE="$(curl -k -s -o /dev/null -w "%{http_code}" "${SMOKE_HEALTH_URL}" || true)"
  if [ "$HTTP_CODE" = "200" ]; then
    log "Health check passed"
    log "Running smoke suite"
    SMOKE_BASE_URL="$SMOKE_BASE_URL" "$SMOKE_SCRIPT"
    log "Smoke suite finished successfully"
    docker image prune -f
    exit 0
  fi
  log "External health attempt $i failed, code=${HTTP_CODE}"
  sleep 3
done

log "Health check failed after retries"
docker compose -f "$COMPOSE_FILE" ps
docker compose -f "$COMPOSE_FILE" logs --tail=200 api web nginx || true
exit 1
