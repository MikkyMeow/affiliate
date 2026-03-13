#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
POSTGRES_SERVICE="${POSTGRES_SERVICE:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-affiliate}"
POSTGRES_USER="${POSTGRES_USER:-affiliate}"
BACKUP_DIR="${POSTGRES_BACKUP_DIR:-/home/deploy/backups/postgres}"
RETENTION_DAYS="${POSTGRES_BACKUP_RETENTION_DAYS:-14}"
TIMESTAMP="$(date '+%Y%m%d_%H%M%S')"
BACKUP_FILE="${BACKUP_DIR}/postgres-${TIMESTAMP}.sql.gz"

log() {
  echo "[PG_BACKUP $(date '+%Y-%m-%d %H:%M:%S')] $1"
}

mkdir -p "$BACKUP_DIR"

log "Starting backup for database=${POSTGRES_DB} service=${POSTGRES_SERVICE}"
cd "$APP_DIR"

if ! docker compose -f "$COMPOSE_FILE" ps "$POSTGRES_SERVICE" >/dev/null 2>&1; then
  log "Postgres service ${POSTGRES_SERVICE} is not running"
  exit 1
fi

if docker compose -f "$COMPOSE_FILE" exec -T "$POSTGRES_SERVICE" true >/dev/null 2>&1; then
  :
else
  log "Failed to exec into ${POSTGRES_SERVICE}, is the container healthy?"
  exit 1
fi

docker compose -f "$COMPOSE_FILE" exec -T "$POSTGRES_SERVICE" bash -c \
  "set -Eeuo pipefail; export PGPASSWORD=\"\${POSTGRES_PASSWORD}\"; pg_dump -U \"$POSTGRES_USER\" \"$POSTGRES_DB\"" \
  | gzip >"$BACKUP_FILE"

log "Backup stored at $BACKUP_FILE"

if [ "$RETENTION_DAYS" -gt 0 ]; then
  log "Removing backups older than ${RETENTION_DAYS} days"
  find "$BACKUP_DIR" -type f -name 'postgres-*.sql.gz' -mtime +"$RETENTION_DAYS" -print -delete || true
fi

log "Backup finished successfully"
