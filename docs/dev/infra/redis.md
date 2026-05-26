# Redis

Статус: draft

## Назначение

Этот раздел описывает подтверждённое использование Redis в проекте: cache, rate limit, BullMQ и readiness check.

## Где находится

| Файл / путь | Назначение |
|---|---|
| `backend/src/lib/redis.config.js` | Сборка Redis config из env |
| `backend/src/lib/redis.js` | Инициализация и ping Redis |
| `backend/src/middleware/rateLimit.js` | Redis-backed rate limiter с fallback в память |
| `backend/src/services/tracking/hot-lookup.service.js` | Redis cache для offer/affiliate lookup |
| `backend/src/services/tracking/cache-invalidation.service.js` | Инвалидация tracking cache |
| `backend/src/queue/config.js` | Использует Redis connection для BullMQ |
| `docker-compose.yml` | Локальный Redis сервис |

## Usage map

| Use case | Files | Notes |
|---|---|---|
| Tracking cache: offer lookup | `backend/src/services/tracking/hot-lookup.service.js` | Redis key prefix `offer:` |
| Tracking cache: affiliate lookup | `backend/src/services/tracking/hot-lookup.service.js` | Redis key prefix `affiliate:` |
| Cache invalidation | `backend/src/services/tracking/cache-invalidation.service.js` | Удаляет cache после изменений офферов/аффилиатов |
| HTTP rate limiting | `backend/src/middleware/rateLimit.js` | При недоступном Redis падает обратно в in-memory store |
| BullMQ queues | `backend/src/lib/queue.js`, `backend/src/workers/asyncJobsWorker.js` | Redis обязателен для очереди |
| Readiness check | `backend/src/app.js` | `/ready` требует Redis, если `REDIS_REQUIRED=true` |

## Как это работает

Redis-конфиг собирается из `REDIS_HOST`, `REDIS_PORT`, `REDIS_DB`, `REDIS_USERNAME`, `REDIS_PASSWORD`, либо из `REDIS_URL`.

При старте backend вызывает `initRedis()`. Если соединение не установилось, backend не обязательно завершается: он пишет warning и продолжает работу без cache layer. Но `/ready` всё равно будет падать, если `REDIS_REQUIRED=true`.

Rate limiter реализован через `rate-limit-redis`, но умеет откатываться на in-memory store, когда Redis временно недоступен.

BullMQ использует отдельную connection config из тех же env. Для worker и queue Redis фактически обязателен.

## Локальный запуск

```bash
docker compose up -d redis
```

Проверка:

```bash
docker compose exec redis redis-cli ping
```

Запуск backend рядом:

```bash
cd backend && npm run dev
```

## Staging / deploy

Compose поднимает Redis как сервис `redis`. Backend и worker на staging получают `REDIS_HOST=redis` и `REDIS_PORT=6379` из `docker-compose.yml`.

Отдельного внешнего managed Redis или sentinel/cluster конфига в репозитории не найдено.

TODO: уточнить, staging использует тот же compose Redis или внешний Redis вне репозитория.

## Проверка работоспособности

```bash
docker compose exec redis redis-cli ping
curl -fsS http://localhost:4000/ready
```

Если нужен runtime smoke-test cache:

```bash
docker compose logs -f api | grep Redis
```

Успешные признаки:

- `redis-cli ping` возвращает `PONG`;
- backend пишет `Connected to Redis`;
- `/ready` не отдаёт `dependency: redis`;
- worker обрабатывает BullMQ jobs.

## Частые проблемы

| Проблема | Что проверить | Где смотреть |
|---|---|---|
| Redis недоступен | Поднят ли контейнер и верны ли host/port | `docker-compose.yml`, `backend/src/lib/redis.js` |
| Неверный `REDIS_URL` | Не конфликтует ли он с `REDIS_HOST`/`REDIS_PORT` | `.env`, `backend/src/lib/redis.config.js` |
| Queue не обрабатывает jobs | Доступен ли Redis для worker | `backend/src/workers/asyncJobsWorker.js`, worker logs |
| Dedupe/rate limit не работает | Не ушёл ли rate limiter в in-memory fallback | `backend/src/middleware/rateLimit.js`, api logs |
| Stale cache | Срабатывает ли invalidation после изменений offer/affiliate | `backend/src/services/tracking/cache-invalidation.service.js` |

## Безопасность

- `REDIS_PASSWORD` нельзя коммитить.
- Если `REDIS_REQUIRED=true`, падение Redis будет видно в `/ready`, но сам backend всё равно может продолжать отвечать на часть запросов.
- Redis здесь используется не только как cache, но и как queue backend, поэтому потеря данных/доступности влияет на async rollup и postback flow.

## Known limitations

- Подтверждения использования Redis для sessions или distributed locks в текущем коде не найдено.
- Отдельный retention policy, persistence mode и backup strategy Redis не документированы. TODO: уточнить.
- В `backend/src/lib/redis.js` username/password пробрасываются через URL, а отдельные поля в `createClient` закомментированы.

## Связанные разделы

- [Docker Compose](./docker-compose.md)
- [Queues](./queues.md)
- [Click Flow](../data-flow/click-flow.md)
