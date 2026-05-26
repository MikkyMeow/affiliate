# Docker Compose

Статус: draft

## Назначение

Этот раздел описывает реальный `docker-compose.yml`, который используется для локальной инфраструктуры и staging deploy.

## Где находится

| Файл / путь | Назначение |
|---|---|
| `docker-compose.yml` | Основной compose-файл проекта |
| `backend/Dockerfile` | Build backend image для `api` и `worker` |
| `frontend/Dockerfile` | Build frontend image для `web` |
| `services/nginx/default.conf` | Конфиг внутреннего nginx сервиса |
| `scripts/deploy-staging.sh` | Запуск `docker compose up -d --build` на staging |

## Services

| Service | Image/build | Ports | Depends on | Purpose |
|---|---|---|---|---|
| `postgres` | `postgres:16` | `55432:5432` | - | PostgreSQL база данных |
| `redis` | `redis:7-alpine` | `56379:6379` | - | Redis для cache, rate limit и BullMQ |
| `api` | `build: ./backend` | `expose 4000` | `postgres`, `redis` | Express backend |
| `worker` | `build: ./backend` | none | `postgres`, `redis` | Отдельный BullMQ worker |
| `web` | `build: ./frontend` | `expose 3000` | `api` | Next.js frontend |
| `nginx` | `nginx:alpine` | none | `api` | Внутренний reverse proxy для staging |

## Как это работает

Compose поднимает PostgreSQL и Redis как stateful infra-сервисы. Backend и worker собираются из одного `backend/Dockerfile`, но `worker` запускается с командой `node src/worker.js`.

`api`, `worker` и `web` получают env из корневого `.env`. Для контейнерной сети compose дополнительно переопределяет:

- `DB_HOST=postgres`
- `DB_PORT=5432`
- `DATABASE_URL=postgres://affiliate:affiliate@postgres:5432/affiliate`
- `REDIS_HOST=redis`
- `REDIS_PORT=6379`

`nginx` не публикует host-порты. В `docker-compose.yml` прямо указано, что публичные `80/443` принадлежат внешнему `~/infra-proxy`, а текущий nginx предназначен только для внутренней сети staging.

Volume подтверждён только один: `postgres-data`.

Явные `networks` в compose не объявлены, значит используется default network Docker Compose.

## Локальный запуск

```bash
cp .env.example .env
docker compose up -d postgres redis
```

Полный compose-стек:

```bash
docker compose up -d --build
```

Остановка:

```bash
docker compose down
```

Просмотр состояния и логов:

```bash
docker compose ps
docker compose logs -f api worker web nginx postgres redis
```

## Useful commands

```bash
docker compose up -d
docker compose logs -f
docker compose ps
docker compose down
```

Полезные точечные варианты:

```bash
docker compose up -d postgres redis
docker compose logs -f api worker
docker compose exec postgres pg_isready -U affiliate -d affiliate
docker compose exec redis redis-cli ping
```

## Staging / deploy

Staging deploy использует тот же `docker-compose.yml` через `scripts/deploy-staging.sh`:

```bash
docker compose -f docker-compose.yml up -d --build
docker compose -f docker-compose.yml restart nginx
```

После этого скрипт проверяет доступность:

- `http://api:4000/health` из контейнера `nginx`
- `http://web:4000/` из контейнера `nginx`

Последняя проверка конфликтует с `web`, который в compose expose'ит `3000`, а `frontend/Dockerfile` запускает `next start` по умолчанию на `3000`.

TODO: уточнить, не устарел ли `scripts/deploy-staging.sh` и `services/nginx/default.conf` в части upstream `web:4000`.

## Проверка работоспособности

```bash
docker compose ps
```

```bash
curl -fsS http://localhost:4000/health
curl -fsS http://localhost:4000/ready
```

```bash
docker compose exec postgres pg_isready -U affiliate -d affiliate
docker compose exec redis redis-cli ping
```

Успешные признаки:

- `postgres` и `redis` имеют статус `healthy`;
- `api` проходит `/ready`;
- backend отвечает на `http://localhost:4000`;
- frontend внутри compose стартует без ошибки `Missing NEXT_PUBLIC_*`.

## Частые проблемы

| Проблема | Что проверить | Где смотреть |
|---|---|---|
| Порт занят | Не заняты ли `55432` и `56379` на host | `docker-compose.yml`, `docker compose ps` |
| Database не поднялась | Статус healthcheck PostgreSQL и volume | `docker-compose.yml`, `docker compose logs postgres` |
| Backend не видит PostgreSQL | `DB_HOST`, `DATABASE_URL`, миграции | `docker-compose.yml`, `backend/src/db.js`, `docker compose logs api` |
| Backend не видит Redis | `REDIS_HOST`, `REDIS_PORT`, `REDIS_REQUIRED` | `backend/src/lib/redis.js`, `docker compose logs api worker redis` |
| Frontend не видит backend | `NEXT_PUBLIC_API_BASE` в `.env` | `.env`, `frontend/src/lib/env.ts`, `docker compose logs web` |
| Env не подхватились | Существует ли корневой `.env` | `docker-compose.yml`, `.env` |
| Migrations не применены | Успешно ли стартовал backend и прошёл `ensureDatabaseSetup()` | `backend/src/index.js`, `backend/src/db.js`, `docker compose logs api` |

## Безопасность

- Не запускайте `docker compose down -v` без явной необходимости: это удалит volume `postgres-data`.
- На staging/prod опасно выполнять `docker compose exec postgres psql ... DROP ...`.
- Compose использует локальный `.env`, поэтому секреты из него автоматически попадают в контейнеры.
- `nginx` монтирует `/etc/letsencrypt` с host-машины в read-only режиме.

## Known limitations

- В compose нет отдельного сервиса для запуска миграций: миграции применяются автоматически при старте backend через `ensureDatabaseSetup()`.
- В compose нет явного внешнего reverse proxy; комментарий указывает на внешний `~/infra-proxy`, которого нет в этом репозитории.
- Обнаружен конфликт `web:3000` против `proxy_pass http://web:4000` и staging health-check `http://web:4000/`. TODO: уточнить актуальный frontend upstream.

## Связанные разделы

- [Environment Variables](./env.md)
- [Database Migrations](./database-migrations.md)
- [Redis](./redis.md)
- [Queues](./queues.md)
