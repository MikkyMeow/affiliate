#!/usr/bin/env bash
set -Eeuo pipefail

log() {
  echo "[SECURITY $(date '+%Y-%m-%d %H:%M:%S')] $1"
}

require_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    log "Required command $cmd is not installed"
    exit 1
  fi
}

dump_sshd_config() {
  if command -v sudo >/dev/null 2>&1; then
    sudo sshd -T 2>/dev/null
  else
    sshd -T 2>/dev/null
  fi
}

get_sshd_value() {
  local key="$1"
  awk -v "k=$key" '$1 == k { print $2; exit }'
}

main() {
  require_command sshd
  local config
  config="$(dump_sshd_config)"

  if [ -z "$config" ]; then
    log "Unable to read sshd configuration (need sudo?)"
    exit 1
  fi

  local password_auth
  password_auth="$(printf '%s\n' "$config" | get_sshd_value passwordauthentication)"
  if [ "$password_auth" != "no" ]; then
    log "PasswordAuthentication is ${password_auth:-unset} (expected no)"
    exit 1
  fi
  log "PasswordAuthentication is disabled"

  local permit_root
  permit_root="$(printf '%s\n' "$config" | get_sshd_value permitrootlogin)"
  if [ "$permit_root" != "no" ]; then
    log "PermitRootLogin is ${permit_root:-unset} (expected no)"
    exit 1
  fi
  log "Root login via SSH is disabled"

  if command -v ufw >/dev/null 2>&1; then
    log "UFW status:"
    if command -v sudo >/dev/null 2>&1; then
      sudo ufw status numbered
    else
      ufw status numbered
    fi
  else
    log "UFW not installed, skipping firewall summary"
  fi

  if command -v systemctl >/dev/null 2>&1; then
    if systemctl is-enabled --quiet fail2ban 2>/dev/null; then
      log "fail2ban service is enabled"
    else
      log "fail2ban is not enabled (recommended but optional)"
    fi
  fi

  log "SSH configuration verification finished"
}

main "$@"
