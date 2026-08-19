# Queues

Статус: draft

## Назначение

Этот раздел описывает подтверждённую очередь BullMQ, отдельный worker и типы async jobs, которые используются в tracking/postback/statistics flow.

## Где находится

| Файл / путь | Назначение |
|---|---|
| `backend/src/lib/queue.js` | Создание BullMQ `Queue` и enqueue |
| `backend/src/queue/config.js` | Имя queue, prefix, retry/backoff, concurrency |
| `backend/src/queue/jobs/jobTypes.js` | Список job names |
| `backend/src/workers/asyncJobsWorker.js` | Worker runtime |
| `backend/src/workers/registerJobs.js` | Регистрация обработчиков jobs |
| `backend/src/worker.js` | Входная точка отдельного worker процесса |
| `backend/src/services/async-jobs.service.js` | Общий enqueue wrapper |

## Queues

| Queue | Producer | Worker | Job type | Purpose |
|---|---|---|---|---|
| `postback-events` или `ASYNC_JOBS_QUEUE` | `tracking/clicks.service.js`, `postback/conversions.service.js` | `backend/src/workers/asyncJobsWorker.js` | `postback.event` | Асинхронная обработка событий click/conversion |
| `postback-events` или `ASYNC_JOBS_QUEUE` | TODO: явный producer не подтверждён | `backend/src/workers/asyncJobsWorker.js` | `stats.rollup` | Запуск daily stats rollup |

## Jobs

| Job | Payload | Side effects |
|---|---|---|
| `postback.event` + `type=click_created` | `clickId`, `offerId`, `affiliateId`, `createdAt` | Обновляет rollup по клику, пишет structured logs, использует dedupe через `processed_async_events` |
| `postback.event` + `type=conversion_created` | `conversionId`, `clickId`, `offerId`, `affiliateId`, `goalId` | Обновляет rollup по конверсии, пишет structured logs, использует dedupe |
| `stats.rollup` | `date` или `startDate/endDate` | Запускает `runDailyStatsRollup()` |

## Как это работает

Queue создаётся через BullMQ в `backend/src/lib/queue.js`. По умолчанию она отключается, если:

- `QUEUE_DISABLED=true`
- `NODE_ENV=test`

Параметры retry и retention:

- attempts: `ASYNC_JOB_ATTEMPTS` или `3`
- backoff: exponential, delay `ASYNC_JOB_BACKOFF_DELAY_MS` или `1000`
- removeOnComplete: `ASYNC_JOB_HISTORY` или `1000`
- removeOnFail: `ASYNC_JOB_REMOVE_ON_FAIL` или `200`
- worker concurrency: `ASYNC_WORKER_CONCURRENCY` или `5`

Отдельный процесс worker стартует через `node src/worker.js`. Он регистрирует job handlers и слушает одну queue.

Для защиты от повторной обработки click/conversion events используется таблица `processed_async_events`.

## Локальный запуск

Запуск worker:

```bash
npm run worker --workspace backend
```

Если нужен backend рядом:

```bash
cd backend && npm run dev
```

Если нужен ручной daily rollup без очереди:

```bash
cd backend && npm run rollup:daily -- --date=2026-05-26
```

## Staging / deploy

В compose есть отдельный сервис `worker`, который использует тот же `backend/Dockerfile`, что и `api`, но запускается командой:

```bash
node src/worker.js
```

Отдельного supervisord/pm2 контура для worker не найдено.

## Проверка работоспособности

```bash
docker compose logs -f worker
```

```bash
docker compose logs -f api | grep queue
```

Успешные признаки:

- worker пишет `Async worker ready and listening for jobs`;
- при клике/конверсии в логах появляются `worker_job_active` и `worker_job_completed`;
- метрики `queue_jobs_processed_total` и `rollup_updates_total` растут;
- таблица `processed_async_events` заполняется при обработке dedupe-enabled events.

## Частые проблемы

| Проблема | Что проверить | Где смотреть |
|---|---|---|
| Jobs создаются, но не обрабатываются | Запущен ли `worker`, доступен ли Redis | `docker-compose.yml`, worker logs |
| Worker не запущен | Есть ли отдельный процесс `npm run worker` или compose сервис `worker` | `backend/package.json`, `docker compose ps` |
| Redis недоступен | Соединение BullMQ и `redisConfig.connection` | `backend/src/queue/config.js`, `backend/src/lib/redis.config.js` |
| Repeated job дублируется | Работает ли `processed_async_events` dedupe | `backend/src/models/processed-async-events.model.js`, DB |
| Stats не обновляются | Исполняется ли handler `click_created`/`conversion_created` | `backend/src/workers/registerJobs.js` |
| Retry зациклился | Значения attempts/backoff/removeOnFail | `.env`, `backend/src/queue/config.js` |

## Безопасность

- Не отключайте `QUEUE_DISABLED` на staging без рабочего Redis.
- Async rollup меняет агрегированные таблицы статистики, поэтому не запускайте экспериментальные jobs на shared базе.
- `npm run rollup:daily` на staging/production считать потенциально опасной операцией, если не подтверждён диапазон дат и влияние на `daily_stats`.

## Known limitations

- В `backend/src/queue/jobs/jobTypes.js` объявлены `fraud.check`, `notifications.dispatch`, `stats.recalculate`, `exports.dispatch`, `callbacks.advertiser`, но подтверждённых producers/workers для них в текущем коде не найдено.
- Явного cron/scheduler для регулярного enqueue `stats.rollup` в репозитории не найдено. TODO: уточнить, кто создаёт эти jobs на staging.
- Bull Board или другой UI для очередей не найден.

## Связанные разделы

- [Redis](./redis.md)
- [Stats Rollup Flow](../data-flow/stats-rollup-flow.md)
- [Click Flow](../data-flow/click-flow.md)
- [Postback Flow](../data-flow/postback-flow.md)
