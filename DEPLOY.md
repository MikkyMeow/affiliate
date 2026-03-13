# Deployment & Operational Baseline

This repo now ships a minimal yet reliable production-readiness stack that keeps staging healthy and ready for real traffic. The sections below document the workflow, supporting scripts, and operational expectations.

## Release Discipline

- Staging is deployed from the `staging` branch via `scripts/deploy-staging.sh`. Hook this script up to CI so every merge to `staging` deploys automatically.
- `main` does not auto-deploy. Promote only after staging is verified.
- Every schema change must ship with a migration checked into `backend/migrations` and covered by the deploy script.
- Do not merge to `staging` until changes are verified locally (including migrations).
- Changes to `.env` are intentional and reviewed separately. Never sneak env changes into unrelated PRs.
- Rollback is `git revert` (preferred) or `git reset --hard <prev-commit>` followed by a redeploy. Document what was rolled back in the PR/issue tracker.

## Deploy Flow

`scripts/deploy-staging.sh` performs the following steps:

1. Fetch/reset `staging` to `origin/staging`.
2. Ensure `.env` exists (env updates happen out-of-band).
3. Start Postgres/Redis (so migrations always have something to talk to).
4. Run `docker compose run --rm api npm run migrate` (configurable via `MIGRATION_SERVICE` / `MIGRATION_COMMAND` env vars).
5. Rebuild and restart the stack (`docker compose up -d --build`, nginx restart).
6. Wait for containers to become reachable from nginx.
7. Poll `https://staging.mikilead.ru/health`.
8. Run the smoke suite (see below).

The script exits non‑zero on any failure (git pull, migrations, docker build, health checks, smoke tests). CI/CD should treat a non‑zero exit as a failed deployment.

### Smoke Suite

`scripts/smoke-check.sh` validates:

- `/health` and `/ready`.
- The frontend landing page responds with HTML.
- Admin endpoint `/api/v1/admin/stats/totals` behind auth.
- Partner endpoints `/api/v1/partner/profile` and `/api/v1/partner/offers`.

Required env vars (export before deploy):

```
SMOKE_BASE_URL=https://staging.mikilead.ru
SMOKE_ADMIN_EMAIL=admin@example.com
SMOKE_ADMIN_PASSWORD=...
SMOKE_PARTNER_EMAIL=partner@example.com
SMOKE_PARTNER_PASSWORD=...
```

Optional knobs: `SMOKE_API_BASE`, `SMOKE_MAX_ATTEMPTS`.

The script requires `curl` and `python3` on the host. Add more synthetic flows (e.g., staged click/postback) inside this script when ready.

## Database Migrations

- Create migrations via `docker compose run --rm api npm run migrate:create some_name`.
- Test locally via `npm run migrate` from `backend` (uses `node-pg-migrate`).
- Migrations must be idempotent and safe to re-run (deploy script runs them every time).
- Never edit past migrations—add new ones.

## Postgres Backups

- Script: `scripts/backup-postgres.sh`.
- Default directory: `/home/deploy/backups/postgres`.
- Filenames: `postgres-YYYYMMDD_HHMMSS.sql.gz`.
- Retention: 14 days (configurable via `POSTGRES_BACKUP_RETENTION_DAYS`).
- Reads database credentials from the running Postgres container; no secrets stored on disk.

Run manually or schedule with cron (example as deploy user):

```
0 3 * * * /home/deploy/affilate/scripts/backup-postgres.sh >> /var/log/postgres_backup.log 2>&1
```

Restore example:

```
gunzip -c /home/deploy/backups/postgres/postgres-20240220_030000.sql.gz \
  | docker compose -f /home/deploy/affilate/docker-compose.yml exec -T postgres \
    bash -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"'
```

Always restore into a fresh DB or have a rollback plan ready.

## Logging & Health

- All services now use the `json-file` logging driver capped at `10m` per file with 3 rotations. Use `docker logs --tail <n> <container>` safely without disk exploding.
- `restart: unless-stopped` ensures everything comes back automatically after crashes or host reboots.
- Health checks:
  - Postgres (`pg_isready`), Redis (`redis-cli ping`), API (`/ready`), Worker (custom script verifying DB + Redis + BullMQ), Web (`wget http://localhost:4000/`), Nginx (`http://localhost/health`).
  - `depends_on` waits for healthy dependencies before starting upstream services.
- Use `docker compose ps`, `docker compose logs`, and `docker compose exec` for routine ops.

## Operational Hygiene

- **Smoke tests run after every deploy** (enforced by deploy script).
- **Backups**: verify the backup directory contains fresh files and periodically test restores.
- **Logs**: `json-file` rotation already configured; monitor disk usage under `/var/lib/docker/containers`.
- **Monitoring hooks**: keep the existing `curl` polling and add external uptime checks hitting `/ready`.

## Server Security Baseline

- SSH password authentication disabled, only SSH keys allowed.
- Root SSH login disabled.
- Firewall allows only `22/tcp`, `80/tcp`, `443/tcp` (manage via `ufw` or equivalent).
- Optional but recommended: enable `fail2ban`.
- Dedicated deploy user already in place; keep sudo limited.

Use `scripts/verify-ssh-hardening.sh` on the server to assert SSH settings (needs sudo for `sshd -T`). It also surfaces `ufw` status and whether `fail2ban` is enabled.

Sample firewall hardening (Ubuntu):

```
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## Rollback Procedure

1. Identify the last known-good commit (`git log --oneline -n 5`).
2. `git revert <bad-commit>` or `git reset --hard <good-commit>` on the deploy box.
3. Re-run `scripts/deploy-staging.sh`.
4. Verify smoke suite + manual checks.
5. Document the rollback in the issue tracker/Slack.

## Checklists Before Going Live

- [ ] `scripts/deploy-staging.sh` succeeds end-to-end.
- [ ] Latest backup file exists and is < 24h old.
- [ ] `scripts/verify-ssh-hardening.sh` passes.
- [ ] `docker compose ps` shows all containers `Up (healthy)`.
- [ ] Smoke suite green.
- [ ] Firewall/monitoring alerts quiet.

This baseline keeps staging resilient without over-engineering. Iterate from here (metrics, alerting, better synthetic flows, off-site backups) as production use grows.
