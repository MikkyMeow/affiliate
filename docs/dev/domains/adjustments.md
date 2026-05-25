# Корректировки

Статус: draft

## Назначение

Домен описывает manual adjustments через CSV preview/apply для `clicks` и `conversions`, adjustment batches, row validation и влияние на stats/finance.

## Основные пользовательские сценарии

- admin/manager загружает CSV и получает preview batch;
- система резолвит partner/offer/advertiser/goal по UUID/public ID;
- admin/manager применяет batch;
- система создаёт manual clicks или manual conversions;
- списки clicks/conversions/stats/finance начинают учитывать manual records.

## Frontend files

| Файл / папка | Назначение |
|---|---|
| `frontend/src/app/dashboard/adjustments/page.tsx` | UI preview/apply/list/detail adjustments |
| `frontend/src/lib/adjustments.ts` | client `/admin/adjustments/*` |

## Backend routes

| Route / файл | Назначение | Роли |
|---|---|---|
| `POST /api/v1/admin/adjustments/preview` (`backend/src/routes/admin-adjustments.routes.js`) | preview CSV batch | `admin`, `manager` |
| `POST /api/v1/admin/adjustments/:batchId/apply` (`backend/src/routes/admin-adjustments.routes.js`) | apply previewed batch | `admin`, `manager` |
| `GET /api/v1/admin/adjustments/batches` (`backend/src/routes/admin-adjustments.routes.js`) | list batches | `admin`, `manager` |
| `GET /api/v1/admin/adjustments/batches/:id` (`backend/src/routes/admin-adjustments.routes.js`) | batch detail | `admin`, `manager` |

## Validators

| Файл / схема | Что валидирует |
|---|---|
| `backend/src/validators/adjustments.js#validateAdjustmentPreviewPayload` | type, partnerMode, defaults, csvText |
| `backend/src/validators/adjustments.js#validateAdjustmentBatchesQuery` | filters/pagination batches |
| `backend/src/validators/offers.js#validateUuid` | `batchId` |

## Services

| Service / файл | Ответственность |
|---|---|
| `backend/src/services/adjustments.service.js` | preview/apply/list/detail manual adjustment batches |
| `backend/src/services/offer-goals.service.js` | resolving effective goal rates for conversion imports |
| `backend/src/services/stats/rollup.service.js` | recalculation impact after manual records. TODO: уточнить прямой вызов из adjustments apply |

## Models / repositories

| Model / repository / файл | Ответственность |
|---|---|
| `backend/src/models/manualAdjustmentBatches.model.js` | batch persistence/detail/list |
| `backend/src/models/clicks.model.js` | insert manual clicks |
| `backend/src/models/conversions.model.js` | insert manual conversions |
| `backend/src/models/affiliateModel.js` | resolve affiliate/public ID |
| `backend/src/models/advertiserModel.js` | resolve advertiser/public ID |
| `backend/src/models/offers.model.js` | resolve offer/public ID |
| `backend/src/models/offerGoals.model.js` | resolve goal by name/id |

## Database tables

| Таблица | Назначение | Важные связи |
|---|---|---|
| `manual_adjustment_batches` | batch metadata and counters | `type`, `partner_mode`, defaults, `status`, `created_by` |
| `clicks` | manual click records | `source='manual'`, `manual_adjustment_batch_id`, `created_by`, optional `goal_id` |
| `conversions` | manual conversion records | `source='manual'`, `manual_adjustment_batch_id`, `created_by`, nullable `click_id` |
| `offer_goals` | goal resolution for conversion imports | `default_goal_id` / named goal resolution |
| `daily_stats` | stats rollup includes manual counters | `manual_clicks_count`, `manual_conversions_count` |

## Main data flow

```txt
CSV upload in admin UI
  -> POST /admin/adjustments/preview
  -> validateAdjustmentPreviewPayload
  -> adjustments.service.previewManualAdjustmentBatch
  -> parse CSV
  -> resolve affiliate/offer/advertiser/goal per row
  -> store preview batch metadata
  -> return valid/invalid rows

Apply batch
  -> POST /admin/adjustments/:batchId/apply
  -> adjustments.service.applyManualAdjustmentBatch
  -> insert manual clicks/conversions
  -> mark batch applied/failed
  -> downstream stats become stale until recalculation if needed
```

## Permissions / roles

- preview/apply/list/detail доступны только `admin` и `manager`.
- `affiliate` и `advertiser` явно получают 403, что подтверждено тестами.
- Batch actor сохраняется через `created_by` и audit context.

## Edge cases

- invalid CSV -> preview validation errors;
- partial import -> batch считает `validRows/invalidRows/createdRows/skippedRows`;
- duplicate rows -> одна из строк может быть skipped/invalid на apply;
- unknown click/conversion/partner/offer/goal -> row-level errors в preview;
- invalid status -> validation error;
- batch failed -> `status='failed'`;
- rollback endpoint не найден. TODO: rollback unavailable;
- stats need recalculation after manual adjustments, особенно для historical dates.

## Known limitations

- Корректировки работают через preview/apply, но отдельного rollback API нет.
- Полная стратегия пересчёта stats после apply не документирована в route layer. TODO: уточнить, когда вызывается `recalculateDailyStats` автоматически, а когда вручную.
- CSV schema поддерживает both UUID/public IDs and named goals, но формат нужно смотреть по сервису/UI.

## Tests

| Тест | Что проверяет |
|---|---|
| `backend/tests/integration/admin-adjustments-stage14.test.js` | schema, permissions, preview, public ID resolution, apply manual records |
| `backend/tests/integration/daily-stats-stage16.test.js` | влияние manual records на daily stats |

## Связанные разделы

- [Tracking Clicks](./tracking-clicks.md)
- [Postbacks and Conversions](./postbacks-conversions.md)
- [Stats](./stats.md)
- [Finance](./finance.md)
