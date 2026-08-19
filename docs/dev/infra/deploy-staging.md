# Deploy Staging

Статус: draft

## Назначение

Этот раздел описывает подтверждённый staging deploy через GitHub Actions, SSH и Docker Compose.

## Где находится

| Файл / путь | Назначение |
|---|---|
| `.github/workflows/deploy-staging.yml` | GitHub Actions workflow deploy в staging |
| `scripts/deploy-staging.sh` | Основной deploy script на сервере |
| `docker-compose.yml` | Поднимаемый runtime stack |
| `services/nginx/default.conf` | Внутренний nginx для staging |

## Deploy entry points

| File / workflow / script | Purpose |
|---|---|
| `.github/workflows/deploy-staging.yml` | Запускает staging deploy по push в `staging` и вручную |
| `scripts/deploy-staging.sh` | Выполняет git sync, rebuild контейнеров, health checks |

## Как это работает

Workflow `Deploy staging` стартует:

- по `push` в branch `staging`;
- по `workflow_dispatch`.

Job делает:

1. checkout репозитория;
2. поднимает ssh-agent с `secrets.STAGING_SSH_KEY`;
3. добавляет staging host в `known_hosts`;
4. выполняет SSH-команду:

```bash
cd /home/deploy/affiliate && bash /home/deploy/affiliate/scripts/deploy-staging.sh
```

На сервере `scripts/deploy-staging.sh`:

1. делает `git fetch origin`;
2. переключает репозиторий на branch `staging`;
3. выполняет опасную команду `git reset --hard origin/staging`;
4. проверяет наличие `.env`;
5. запускает `docker compose up -d --build`;
6. рестартует `nginx`;
7. проверяет `http://api:4000/health` и `http://web:4000/`;
8. перезагружает внешний `infra-proxy-nginx`;
9. делает внешний health-check `https://staging.mikilead.ru/health`;
10. при успехе чистит dangling images через `docker image prune -f`.

## Локальный запуск

Для этого раздела локальный запуск не применяется напрямую.

Локально можно только читать workflow/script и воспроизводить безопасные проверки:

```bash
sed -n '1,220p' .github/workflows/deploy-staging.yml
sed -n '1,220p' scripts/deploy-staging.sh
```

## Staging / deploy

Подтверждённые staging сущности:

- branch: `staging`
- host: `staging.mikilead.ru`
- app dir: `/home/deploy/affiliate`
- compose file: `docker-compose.yml`
- deploy user/host/port: приходят из GitHub Secrets

Подтверждённые GitHub Secrets:

- `STAGING_SSH_KEY`
- `STAGING_HOST`
- `STAGING_PORT`
- `STAGING_USER`

Подтверждённые runtime зависимости на сервере:

- Docker + Docker Compose
- `.env` в `/home/deploy/affiliate`
- контейнер `infra-proxy-nginx`
- сертификаты Let's Encrypt в `/etc/letsencrypt`

## Staging deploy checklist

- [ ] Проверить branch `staging`
- [ ] Проверить `.env` на сервере
- [ ] Собрать frontend через `docker compose up -d --build`
- [ ] Собрать backend через `docker compose up -d --build`
- [ ] Учитывать, что migrations применятся при старте `api`
- [ ] Перезапустить services
- [ ] Проверить `https://staging.mikilead.ru/health`
- [ ] Проверить login
- [ ] Проверить tracking click
- [ ] Проверить postback

## Проверка работоспособности

Внутренние проверки из deploy script:

```bash
docker compose -f docker-compose.yml exec -T nginx wget -q -O /dev/null http://api:4000/health
docker compose -f docker-compose.yml exec -T nginx wget -q -O /dev/null http://web:4000/
```

Внешняя проверка:

```bash
curl -k -I https://staging.mikilead.ru/health
curl -k -I https://staging.mikilead.ru/ready
```

После deploy дополнительно проверить вручную:

- вход в admin/partner/advertiser кабинет;
- `/metrics`;
- один реальный `GET /track/click`;
- один test postback в `/track/postback`.

## Частые проблемы

| Проблема | Что проверить | Где смотреть |
|---|---|---|
| Workflow не стартует | Push был не в `staging` branch | `.github/workflows/deploy-staging.yml` |
| SSH deploy не проходит | Secrets `STAGING_*`, доступ по SSH, known_hosts | GitHub Actions logs |
| `.env file not found` | Есть ли `/home/deploy/affiliate/.env` | staging server |
| API не поднимается | Логи `api`, миграции, PostgreSQL | `docker compose logs api` |
| Frontend недоступен | Upstream `web:4000` vs runtime `3000` | `services/nginx/default.conf`, `docker compose logs web nginx` |
| Внешний health-check не проходит | `infra-proxy-nginx`, DNS, TLS cert, nginx routing | `scripts/deploy-staging.sh`, server logs |

## Безопасность

- `scripts/deploy-staging.sh` содержит destructive-команду `git reset --hard origin/staging`. Это опасно для любых ручных изменений на staging-сервере.
- Не выполнять deploy script против production без отдельной проверки.
- Не запускать staging deploy без backup/понимания влияния auto-migrations.
- SSH secrets и staging `.env` не должны попадать в репозиторий.

## Known limitations

- Rollback process не подтверждён. TODO: rollback process not documented / not confirmed.
- Явный отдельный шаг миграций в workflow не найден; сейчас схема обновляется неявно через старт backend.
- Проверка `http://web:4000/` конфликтует с подтверждённым frontend runtime портом `3000`. TODO: уточнить актуальную конфигурацию frontend на staging.
- Конфиг и устройство внешнего `infra-proxy-nginx` в репозитории отсутствуют. TODO: уточнить внешний ingress.

## Связанные разделы

- [Environment Variables](./env.md)
- [Docker Compose](./docker-compose.md)
- [Nginx](./nginx.md)
- [Database Migrations](./database-migrations.md)
- [Metrics](./metrics.md)
