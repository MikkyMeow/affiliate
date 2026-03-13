#!/usr/bin/env bash
set -Eeuo pipefail

BASE_URL="${SMOKE_BASE_URL:-https://staging.mikilead.ru}"
API_BASE="${SMOKE_API_BASE:-$BASE_URL/api/v1}"
ADMIN_EMAIL="${SMOKE_ADMIN_EMAIL:-}"
ADMIN_PASSWORD="${SMOKE_ADMIN_PASSWORD:-}"
PARTNER_EMAIL="${SMOKE_PARTNER_EMAIL:-}"
PARTNER_PASSWORD="${SMOKE_PARTNER_PASSWORD:-}"
MAX_ATTEMPTS="${SMOKE_MAX_ATTEMPTS:-5}"

log() {
  echo "[SMOKE $(date '+%Y-%m-%d %H:%M:%S')] $1"
}

require_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    log "Required command ${cmd} is not installed"
    exit 1
  fi
}

require_env() {
  local name="$1"
  local value="$2"
  if [ -z "$value" ]; then
    log "Environment variable ${name} is required for smoke tests"
    exit 1
  fi
}

extract_json_field() {
  local path="$1"
  local payload="$2"
  JSON_INPUT="$payload" python3 - "$path" <<'PY'
import json
import os
import sys

path = sys.argv[1].split('.')
value = json.loads(os.environ['JSON_INPUT'])

for segment in path:
    if isinstance(value, dict):
        value = value.get(segment)
    else:
        value = None
        break

if value is None:
    raise SystemExit(f"Missing JSON path: {'.'.join(path)}")

if isinstance(value, (dict, list)):
    print(json.dumps(value))
else:
    print(value)
PY
}

assert_json_success() {
  local payload="$1"
  JSON_INPUT="$payload" python3 - <<'PY'
import json
import os
payload = json.loads(os.environ['JSON_INPUT'])
if not payload.get('success'):
    raise SystemExit('API response did not signal success')
PY
}

http_poll() {
  local description="$1"
  local url="$2"
  local attempts="${3:-$MAX_ATTEMPTS}"
  log "Checking ${description} (${url})"
  for attempt in $(seq 1 "$attempts"); do
    local code
    code="$(curl -k -s -o /dev/null -w "%{http_code}" "$url" || true)"
    if [ "$code" = "200" ]; then
      log "${description} responded with 200"
      return 0
    fi
    log "${description} attempt ${attempt}/${attempts} failed (code=${code})"
    sleep 2
  done
  log "${description} did not become healthy after ${attempts} attempts"
  return 1
}

login_and_get_token() {
  local email="$1"
  local password="$2"
  local response
  response="$(curl --fail -k -sS \
    -X POST "$API_BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "$(python3 -c 'import json,sys; print(json.dumps({"email": sys.argv[1], "password": sys.argv[2]}))' "$email" "$password")")"
  assert_json_success "$response"
  extract_json_field "data.token" "$response"
}

check_authenticated_endpoint() {
  local description="$1"
  local url="$2"
  local token="$3"
  log "Validating ${description} (${url})"
  local response
  response="$(curl --fail -k -sS \
    -H "Authorization: Bearer ${token}" \
    "$url")"
  assert_json_success "$response"
  log "${description} returned success"
}

check_frontend() {
  log "Fetching frontend landing page ${BASE_URL}/"
  local body
  body="$(curl --fail -k -sS "$BASE_URL/")"
  if [[ "$body" != *"<html"* ]]; then
    log "Frontend payload does not look like HTML"
    return 1
  fi
  log "Frontend responded with HTML payload"
}

main() {
  require_command curl
  require_command python3
  require_env "SMOKE_ADMIN_EMAIL" "$ADMIN_EMAIL"
  require_env "SMOKE_ADMIN_PASSWORD" "$ADMIN_PASSWORD"
  require_env "SMOKE_PARTNER_EMAIL" "$PARTNER_EMAIL"
  require_env "SMOKE_PARTNER_PASSWORD" "$PARTNER_PASSWORD"

  http_poll "/health" "$BASE_URL/health"
  http_poll "/ready" "$BASE_URL/ready"
  check_frontend

  local admin_token
  admin_token="$(login_and_get_token "$ADMIN_EMAIL" "$ADMIN_PASSWORD")"
  check_authenticated_endpoint "admin stats" "$API_BASE/admin/stats/totals" "$admin_token"

  local partner_token
  partner_token="$(login_and_get_token "$PARTNER_EMAIL" "$PARTNER_PASSWORD")"
  check_authenticated_endpoint "partner profile" "$API_BASE/partner/profile" "$partner_token"
  check_authenticated_endpoint "partner offers" "$API_BASE/partner/offers" "$partner_token"

  log "Smoke suite completed successfully"
}

main "$@"
