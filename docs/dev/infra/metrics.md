# Metrics

Статус: draft

## Назначение

Этот раздел описывает health/readiness endpoints, Prometheus metrics и места, где смотреть runtime ошибки backend, tracking и postback.

## Где находится

| Файл / путь | Назначение |
|---|---|
| `backend/src/app.js` | Роуты `/health`, `/ready`, `/metrics` |
| `backend/src/lib/metrics.js` | Регистрация Prometheus metrics |
| `backend/src/middleware/requestMetrics.js` | HTTP request metrics middleware |
| `services/nginx/default.conf` | Проксирование `/health`, `/ready`, `/metrics` |
| `scripts/deploy-staging.sh` | Внешний health-check staging |

## Health checks

| Endpoint / command | What it checks | Expected result |
|---|---|---|
| `GET /health` | Базовый liveness backend | `200` и `{"status":"ok"}` |
| `GET /ready` | PostgreSQL и, при `REDIS_REQUIRED=true`, Redis | `200` и `{"status":"ready"}` |
| `docker compose exec postgres pg_isready -U affiliate -d affiliate` | Доступность PostgreSQL | exit code `0` |
| `docker compose exec redis redis-cli ping` | Доступность Redis | `PONG` |
| `docker compose exec nginx wget -q -O /dev/null http://api:4000/health` | Доступность backend из nginx | exit code `0` |

## Metrics

| Metric / source | Meaning | Where to check |
|---|---|---|
| `/metrics` | Полный Prometheus text format | `backend/src/app.js`, staging nginx |
| `http_requests_total` | Количество HTTP запросов | `/metrics` |
| `http_request_duration_ms` | Длительность HTTP запросов | `/metrics` |
| `affiliate_http_request_errors_total` | Серверные HTTP ошибки | `/metrics` |
| `tracking_click_requests_total` | Количество tracking click запросов | `/metrics` |
| `tracking_click_errors_total` | Ошибки click tracking | `/metrics` |
| `tracking_click_duplicates_total` | Повторные clicks с dedupe reuse | `/metrics` |
| `geo_redirect_fallback_total` | GEO fallback redirects | `/metrics` |
| `tracking_postback_requests_total` | Количество postback запросов | `/metrics` |
| `tracking_postback_errors_total` | Ошибки postback обработки | `/metrics` |
| `tracking_postback_duplicates_total` | Duplicate postbacks | `/metrics` |
| `tracking_cache_hits_total` / `tracking_cache_misses_total` | Попадания и промахи Redis cache | `/metrics` |
| `queue_jobs_processed_total` / `queue_jobs_failed_total` | Успехи и ошибки queue jobs | `/metrics`, worker logs |
| `rollup_updates_total` / `rollup_update_failures_total` | Результаты rollup updates | `/metrics`, worker logs |
| `offer_request_decisions_total` | Решения по offer request | `/metrics` |

## Как это работает

`/health` ничего не проверяет кроме самого процесса backend.

`/ready` делает:

1. `SELECT NOW()` через `verifyDatabaseConnection()`
2. `redis.ping()`, если `REDIS_REQUIRED=true`

`/metrics` отдаёт `prom-client` registry, включая:

- default node/process metrics;
- HTTP metrics;
- tracking/postback counters;
- queue/rollup counters.

Tracking и postback также пишут structured logs через `logInfo`/`logError`, а worker пишет свои job events отдельно.

## Локальный запуск

```bash
cd backend && npm run dev
curl -fsS http://localhost:4000/health
curl -fsS http://localhost:4000/ready
curl -fsS http://localhost:4000/metrics | head -50
```

## Staging / deploy

`scripts/deploy-staging.sh` делает внешний health-check:

```bash
curl -k -s -o /dev/null -w "%{http_code}" https://staging.mikilead.ru/health
```

Через nginx также доступны:

- `https://staging.mikilead.ru/health`
- `https://staging.mikilead.ru/ready`
- `https://staging.mikilead.ru/metrics`

TODO: уточнить, собирает ли кто-то `/metrics` во внешний Prometheus/Grafana.

## Проверка работоспособности

```bash
curl -fsS http://localhost:4000/health
curl -fsS http://localhost:4000/ready
curl -fsS http://localhost:4000/metrics | grep -E 'tracking_|queue_|rollup_'
```

Логи:

```bash
docker compose logs -f api
docker compose logs -f worker
```

После deploy проверить:

- `/health`;
- `/ready`;
- login;
- один tracking click;
- один test postback;
- отсутствие массовых `worker_job_failed` и `queue_enqueue_failed`.

## Частые проблемы

| Проблема | Что проверить | Где смотреть |
|---|---|---|
| Health ok, но API падает | `/health` не проверяет БД и Redis | `backend/src/app.js` |
| Backend работает, но database недоступна | `/ready`, логи `Failed to connect to database` | api logs, `backend/src/db.js` |
| Redis недоступен | `REDIS_REQUIRED`, ping Redis | `backend/src/lib/redis.js`, `/ready` |
| Postback endpoint отвечает `200`, но conversion не создаётся | Логи postback, таблицы `conversions`, `postback_logs`, очередь | `backend/src/services/postback/conversions.service.js`, DB, worker logs |
| Metrics отсутствуют | Доступность `/metrics`, nginx proxy | `backend/src/app.js`, `services/nginx/default.conf` |

## Безопасность

- `/metrics` может раскрывать внутреннюю operational информацию. В текущем nginx-конфиге специальных ограничений нет.
- `/health` и `/ready` не должны возвращать секреты, но `/ready` показывает имя зависимого сервиса и причину ошибки.
- Для внешней публикации staging metrics стоит ограничить доступ по сети или auth. TODO: уточнить внешний доступ.

## Known limitations

- Readiness не проверяет worker, queue lag и состояние nginx.
- Отдельных `/liveness` и `/readiness` aliases кроме `/health` и `/ready` не найдено.
- Интеграция с Prometheus/Grafana в репозитории не подтверждена. TODO: уточнить внешний monitoring stack.

## Связанные разделы

- [Deploy Staging](./deploy-staging.md)
- [Tracking API](../api/tracking.md)
- [How to Debug Tracking](../maintenance/how-to-debug-tracking.md)
- [How to Debug Postbacks](../maintenance/how-to-debug-postbacks.md)
