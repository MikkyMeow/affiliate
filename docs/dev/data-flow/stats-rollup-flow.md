# Stats Rollup Flow

Статус: draft

## Назначение

Документ описывает, как raw clicks/conversions превращаются в агрегаты `daily_stats`, и как эти агрегаты потом читаются dashboard/report API.

## Краткая схема

```txt
Raw click/conversion data
  -> click_created or conversion_created event
  -> BullMQ worker or manual recalculation service
  -> aggregate by date/timezone/offer/affiliate/advertiser/goal
  -> upsert daily_stats
  -> stats summary/breakdowns API
  -> dashboard tables and charts
```

## Когда запускается flow

Подтверждены три варианта запуска:

1. async после non-duplicate click через `click_created`
2. async после conversion creation через `conversion_created`
3. sync/manual через `recalculateDailyStats` / `runDailyStatsRollup`

Route для ручного запуска пересчёта в публичных API routes не найден. Но есть:

- сервис `backend/src/services/stats/rollup.service.js`
- script `backend/src/scripts/run-daily-rollup.js`

TODO: уточнить, есть ли отдельный admin endpoint для запуска manual recalculation вне текущего кода.

## Входные данные

| Поле / источник | Назначение | Обязательность | Где используется |
| --- | --- | --- | --- |
| click payload (`clickId`, `offerId`, `affiliateId`, `createdAt`) | update click rollup | для `click_created` job | `updateClickRollup` |
| `conversionId` | update conversion rollup | для `conversion_created` job | `updateConversionRollup` |
| `dateFrom`, `dateTo`, `date` | диапазон полного пересчёта | для manual/script rollup | `resolveDateRange` |
| `timezone` | граница дня rollup | опционально, default `getDefaultTimeZone()` | `resolveTimeZone`, `daily_stats.timezone` |
| summary filters | offer/affiliate/advertiser/goal/date filters | API чтения | `validators/stats.js`, `daily-stats.model.js`, raw aggregator models |

## Участники процесса

| Участник | Роль в flow |
| --- | --- |
| `backend/src/services/stats/rollup.service.js` | recalculation и single-day upsert logic |
| `backend/src/services/stats/stats.service.js` | API-facing summary/breakdowns/dashboard logic |
| `backend/src/models/daily-stats.model.js` | clear/upsert/query `daily_stats` |
| `backend/src/models/stats-aggregator.model.js` | raw-query summary/breakdowns из clicks/conversions |
| `backend/src/models/admin-dashboard.model.js` | hourly dashboard series |
| `backend/src/workers/registerJobs.js` | worker handlers `click_created`, `conversion_created`, `ROLLUP` |
| `backend/src/models/processed-async-events.model.js` | async idempotency |
| `frontend/src/lib/stats.ts` | frontend client for stats APIs |
| `frontend/src/app/dashboard/page.tsx`, `.../stats...`, `frontend/src/app/partner/stats/page.tsx`, `frontend/src/app/advertiser/stats/page.tsx` | UI consumers |

## Frontend entry points

| Файл / экран | Назначение |
| --- | --- |
| `frontend/src/app/dashboard/page.tsx` | админ dashboard summary |
| `frontend/src/app/dashboard/offers/[id]/edit/OfferStatsSection.tsx` | offer-specific stats |
| `frontend/src/app/partner/stats/page.tsx` | partner stats |
| `frontend/src/app/advertiser/stats/page.tsx` | advertiser stats |
| `frontend/src/lib/stats.ts` | summary/breakdowns API client |

## Backend entry points

| Route / файл | Метод / path | Назначение |
| --- | --- | --- |
| `backend/src/routes/stats.routes.js` | `GET /api/v1/stats/summary` | summary для admin area |
| `backend/src/routes/stats.routes.js` | `GET /api/v1/stats/breakdowns` | breakdowns по offer/affiliate/goal/status |
| `backend/src/routes/stats.routes.js` | `GET /api/v1/stats/offers/:id` | offer-specific stats |
| `backend/src/routes/stats.routes.js` | `GET /api/v1/stats/daily-summary` | aggregated read из `daily_stats` |
| `backend/src/scripts/run-daily-rollup.js` | CLI/script | полный rollup диапазона |
| `backend/src/workers/registerJobs.js` | BullMQ worker handlers | async rollup update |

## Validation

| Файл / схема | Что проверяет |
| --- | --- |
| `backend/src/validators/stats.js` | `dateFrom/dateTo` в формате `YYYY-MM-DD` |
| `backend/src/validators/stats.js` | `timezone` должен быть валидным IANA timezone |
| `backend/src/validators/stats.js` | `bucket` сейчас поддерживается только `hour` |
| `backend/src/validators/stats.js` | filters и pagination/sort для click/conversion/admin summary |
| `resolveDateRange` в `rollup.service.js` | диапазон дат для manual recalculation |

## Business logic

| Файл / service | Ответственность |
| --- | --- |
| `recalculateDailyStats` | полный пересчёт диапазона: clear + click rollup + conversion rollup + audit |
| `updateClickRollup` | upsert clicks за день одного click |
| `updateConversionRollup` | upsert conversions за день одной conversion |
| `getDailyRollupSummary` / `getAggregatedSummary` | читает агрегаты из `daily_stats` |
| `getSummary` / `getStatsBreakdowns` | raw-query summary/breakdowns из агрегатор-моделей |
| `buildDashboardMetricSet` | CR, EPC, approveRate, revenue/payout/profit calculations |

Подтверждённая модель:

- есть materialized storage `daily_stats`
- часть API читает raw aggregations из `stats-aggregator.model.js`
- часть API читает rollup summary из `daily_stats`
- rollup считается в timezone-aware разрезе через поле `daily_stats.timezone`

## Database reads

| Таблица | Что читается | Зачем |
| --- | --- | --- |
| `clicks` | raw clicks | click rollup и raw summary |
| `conversions` | raw conversions и их статусы/финансы | conversion rollup и raw summary |
| `offers` | advertiser linkage, names | breakdowns и rollup dimensions |
| `affiliates` | names/public ids | breakdowns и filters |
| `advertisers` | names/public ids | breakdowns и filters |
| `offer_goals` | goal dimension | goal breakdown |
| `daily_stats` | stored summary rows | dashboard daily summary / grouped rollup reads |

## Database writes

| Таблица | Что записывается / обновляется | Когда |
| --- | --- | --- |
| `daily_stats` | upsert агрегатов по `date/timezone/offer/affiliate/advertiser/goal` | async и manual rollup |
| `audit_events` | `stats.recalculated` и error events | при manual `recalculateDailyStats` с actor |
| `processed_async_events` | event dedupe | при worker jobs |

## Redis / cache / locks

Redis напрямую для данных статистики не используется. Но async queue работает поверх Redis/BullMQ.

Для idempotent worker processing используется таблица `processed_async_events`, а не Redis set.

## Queue / async events

| Событие / очередь | Где создаётся | Кто обрабатывает | Что делает |
| --- | --- | --- | --- |
| `POSTBACK_EVENT` + `click_created` | click service | `registerJobs.js` | `updateClickRollup` |
| `POSTBACK_EVENT` + `conversion_created` | postback service | `registerJobs.js` | `updateConversionRollup` |
| `ROLLUP` | TODO: явный enqueue site не найден | `registerJobs.js` | запускает `runDailyStatsRollup` |

## Statuses

Отдельных статусов у rollup нет.

Но `daily_stats` хранит разрезы:

| Поле | Что означает |
| --- | --- |
| `clicks_count` | все клики |
| `manual_clicks_count` | manual clicks |
| `conversions_count` | все counted conversions |
| `pending_conversions_count` | pending conversions |
| `approved_conversions_count` | approved conversions |
| `rejected_conversions_count` | rejected conversions |
| `cancelled_conversions_count` | cancelled conversions |
| `manual_conversions_count` | conversions из manual source |
| `test_conversions_count` | test conversions |
| revenue/payout totals по status | финансовые суммы по status buckets |

## Error cases

| Ошибка / ситуация | Где возникает | Что происходит | Что проверить |
| --- | --- | --- | --- |
| rollup job не запустился | queue disabled / enqueue failed | `daily_stats` может устареть | worker, queue config |
| click/conversion event обработан повторно | worker | дубликат пропускается через `processed_async_events` | event key |
| timezone boundary mismatch | `formatDateInTimeZone` / filters | цифры на границе дня отличаются от ожиданий | `users.timezone`, filter timezone |
| stats устарели | async job не дошёл | raw data != `daily_stats` | worker logs, queue, `processed_async_events` |
| manual adjustment не попал в stats | TODO: зависит от apply path | смотреть manual batch result и `daily_stats` | adjustment service |
| duplicate clicks считаются “не так” | rollup считает click rows, duplicate excluded/included нужно уточнять по SQL | проверить `daily-stats.model.js` SQL | duplicate semantics |
| разные роли видят разные цифры | разные routes/services/filters | проверить auth context and route set | role filters |

## Idempotency / deduplication

- async worker dedupe: `processed_async_events`
- click/conversion jobs резервируют `eventKey = type:id`
- duplicate async events не пересчитывают rollup повторно

Для full recalculation idempotency достигается через:

- `clearDailyStatsRange`
- затем fresh upsert из raw data

## Security / permissions

- `/api/v1/stats/*` routes требуют `authenticate` + `authorizeAdminArea`
- partner/advertiser stats routes существуют отдельно; TODO: уточнить их полный data-flow в рамках этого документа
- manual recalculation через service пишет audit с `actor`

## Observability / debugging

- worker logs: `click_rollup_job_started/completed`, `conversion_rollup_job_started/completed`, `stats_rollup_job_started/completed`
- метрики: `rollupUpdatesCounter`, `rollupUpdateFailuresCounter`, `rollupSkippedDuplicatesCounter`
- таблицы: `daily_stats`, `processed_async_events`, `audit_events`
- для сравнения raw vs rollup: `clicks`, `conversions`, `daily_stats`

## Tests

| Тест | Что проверяет |
| --- | --- |
| `backend/tests/integration/daily-stats-stage16.test.js` | `daily_stats` rollup |
| `backend/tests/integration/admin-dashboard-stage11.test.js` | dashboard summary series |
| `backend/tests/integration/admin-summary-stage13.test.js` | summary/breakdown aggregation |
| `backend/tests/integration/advertiser-stats.test.js` | advertiser stats visibility |
| `backend/tests/integration/critical-path.test.js` | raw data to stats critical path |

## Known limitations

- В проекте одновременно существуют raw-query stats и `daily_stats` rollup; новый разработчик должен учитывать оба пути.
- TODO: ручной HTTP endpoint пересчёта статистики не найден.
- TODO: unique/duplicate click accounting inside `upsertClickRollup` нужно уточнять по SQL, если нужна абсолютная продуктовая формулировка.

## Связанные разделы

- [click-flow.md](./click-flow.md)
- [postback-flow.md](./postback-flow.md)
- [conversion-flow.md](./conversion-flow.md)
- [manual-adjustment-flow.md](./manual-adjustment-flow.md)
- [../domains/stats.md](../domains/stats.md)
- [../domains/finance.md](../domains/finance.md)
