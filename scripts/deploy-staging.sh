#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="$(dirname "$0")/.."
BRANCH="staging"
COMPOSE_FILE="docker-compose.yml"
HEALTH_URL="https://staging.mikilead.ru/health"

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

CURRENT_COMMIT="$(git rev-parse HEAD)"
TARGET_COMMIT="$(git rev-parse origin/${BRANCH})"

if [ "$CURRENT_COMMIT" = "$TARGET_COMMIT" ]; then
  log "No changes detected for ${BRANCH}, continue anyway"
fi

log "Checkout ${BRANCH}"
git checkout "$BRANCH"

log "Reset to origin/${BRANCH}"
git reset --hard "origin/${BRANCH}"

log "Pulling env sanity check"
test -f .env || { echo ".env file not found"; exit 1; }

log "Building and starting containers"
docker compose -f "$COMPOSE_FILE" up -d --build

log "Pruning dangling images"
docker image prune -f

log "Waiting for health endpoint"
for i in {1..20}; do
  HTTP_CODE="$(curl -k -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" || true)"
  if [ "$HTTP_CODE" = "200" ]; then
    log "Health check passed"
    exit 0
  fi
  log "Health check attempt $i failed, code=${HTTP_CODE}"
  sleep 3
done

log "Health check failed after retries"
docker compose -f "$COMPOSE_FILE" ps
docker compose -f "$COMPOSE_FILE" logs --tail=100 api web nginx || true
exit 1
