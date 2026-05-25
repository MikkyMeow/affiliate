# Manual Adjustment Flow

Статус: draft

## Назначение

Документ описывает ручные корректировки click/conversion через CSV batch в admin area: preview, row validation, apply, audit и связь со stats.

## Краткая схема

```txt
Admin opens adjustments page
  -> uploads CSV and selects defaults
  -> POST /api/v1/admin/adjustments/preview
  -> parse CSV
  -> validate rows and resolve entities
  -> create manual_adjustment_batches row with preview metadata
  -> admin reviews preview
  -> POST /api/v1/admin/adjustments/:batchId/apply
  -> create clicks/conversions for valid rows
  -> update batch counters/status
  -> write audit events
```

## Когда запускается flow

Flow запускается только из admin area.

Frontend entry point: `frontend/src/app/dashboard/adjustments/page.tsx`.

Backend entry points:

- `POST /api/v1/admin/adjustments/preview`
- `POST /api/v1/admin/adjustments/:batchId/apply`
- `GET /api/v1/admin/adjustments/batches`
- `GET /api/v1/admin/adjustments/batches/:id`

## Входные данные

| Поле / источник | Назначение | Обязательность | Где используется |
| --- | --- | --- | --- |
| `type` | `conversions` или `clicks` | обязательно | `validators/adjustments.js` |
| `partnerMode` | `single_partner` или `per_row` | обязательно | preview/apply logic |
| `affiliateId` | default affiliate | опционально | preview defaults |
| `offerId` | default offer | опционально | preview defaults |
| `goalId` | default goal | опционально | conversion previews |
| `defaultStatus` | default click result / conversion status | опционально | row defaults |
| `originalFilename` | имя файла | опционально | batch metadata |
| `csvText` | CSV body | обязательно | `parseCsv` |

## Участники процесса

| Участник | Роль в flow |
| --- | --- |
| `frontend/src/app/dashboard/adjustments/page.tsx` | UI для upload/preview/apply/history |
| `frontend/src/lib/adjustments.ts` | API client |
| `backend/src/routes/admin-adjustments.routes.js` | admin endpoints |
| `backend/src/validators/adjustments.js` | payload/query validation |
| `backend/src/services/adjustments.service.js` | CSV parsing, preview resolution, apply |
| `backend/src/lib/csv.js` | CSV parser |
| `backend/src/models/manualAdjustmentBatches.model.js` | batch storage |
| `backend/src/models/clicks.model.js` | create manual clicks |
| `backend/src/services/offer-goals.service.js` | create manual conversions |
| `backend/src/services/audit.service.js` | audit trail |

## Frontend entry points

| Файл / экран | Назначение |
| --- | --- |
| `frontend/src/app/dashboard/adjustments/page.tsx` | upload CSV, preview, apply, history |
| `frontend/src/lib/adjustments.ts` | вызовы preview/apply/list/detail |

## Backend entry points

| Route / файл | Метод / path | Назначение |
| --- | --- | --- |
| `backend/src/routes/admin-adjustments.routes.js` | `POST /api/v1/admin/adjustments/preview` | создаёт preview batch |
| `backend/src/routes/admin-adjustments.routes.js` | `POST /api/v1/admin/adjustments/:batchId/apply` | применяет preview batch |
| `backend/src/routes/admin-adjustments.routes.js` | `GET /api/v1/admin/adjustments/batches` | история batch |
| `backend/src/routes/admin-adjustments.routes.js` | `GET /api/v1/admin/adjustments/batches/:id` | детальный просмотр preview/result |

## Validation

| Файл / схема | Что проверяет |
| --- | --- |
| `validateAdjustmentPreviewPayload` | `type`, `partnerMode`, `csvText` обязательны |
| `validateAdjustmentPreviewPayload` | `defaultStatus` должен соответствовать click result или conversion status enum |
| `validateAdjustmentBatchesQuery` | filters/pagination/sort для history |
| `readCsvRows` в service | CSV не пустой, нет пустых/duplicate headers |
| row parsers в `adjustments.service.js` | `country`, `status`, `created_at`, identifiers, financial columns |

CSV структура подтверждена частично через UI examples:

- conversions example: `partner_id,offer_id,goal_id,status,external_id,created_at,comment`
- clicks example: `partner_id,offer_id,country,sub1,sub2,ip,created_at,comment`

Но service поддерживает больше алиасов колонок через `readAliasedCell`.

## Business logic

| Файл / service | Ответственность |
| --- | --- |
| `previewManualAdjustmentBatch` | parse CSV, resolve defaults/entities, собрать preview rows, создать batch со `status = previewed` |
| `applyManualAdjustmentBatch` | загрузить batch, пройти valid rows, создать clicks/conversions, обновить counters |
| `resolveAffiliateIdentifier` / `resolveOfferIdentifier` / `resolveGoalIdentifier` | поддержка UUID и public IDs (`#P`, `#O`, и т.д.) |
| `parseConversionStatus` / `parseClickResult` | row-level status normalization |
| `createClick` | manual click creation с `source = manual` |
| `createConversionWithResolvedGoal` | manual conversion creation с `source = manual` |

Flow реализован двухфазно:

1. preview: batch создаётся до фактических изменений данных
2. apply: используется уже созданный batch

Preview показывает:

- valid / invalid rows
- resolved affiliate/offer/goal
- hidden valid rows count
- ignored columns

## Database reads

| Таблица | Что читается | Зачем |
| --- | --- | --- |
| `manual_adjustment_batches` | preview/apply/history batch data | lifecycle |
| `affiliates` | resolve per-row/default affiliate | entity resolution |
| `advertisers` | resolve advertiser, если требуется row context | entity resolution |
| `offers` | resolve offer | entity resolution |
| `offer_goals` | resolve goal by UUID or name | conversion preview/apply |
| `clicks` | TODO: явный lookup unknown click id для update-mode не найден | уточнить |
| `conversions` | TODO: update existing conversion by id в apply path не подтверждён | уточнить |

## Database writes

| Таблица | Что записывается / обновляется | Когда |
| --- | --- | --- |
| `manual_adjustment_batches` | batch metadata, counters, status, result | preview/apply |
| `clicks` | manual click rows с `source = manual`, `manual_adjustment_batch_id`, `created_by` | click batch apply |
| `conversions` | manual conversion rows с `source = manual`, `manual_adjustment_batch_id`, `created_by` | conversion batch apply |
| `conversion_status_history` | initial status history для manual conversions | через conversion creation path |
| `audit_events` | batch preview/apply audit | admin actions |

## Redis / cache / locks

TODO: уточнить использование Redis/cache/locks в этом flow. В `adjustments.service.js` подтверждена синхронная DB-логика без Redis.

## Queue / async events

TODO: уточнить queue / async events для этого flow.

Отдельного enqueue на пересчёт stats в `adjustments.service.js` не подтверждено. Если `daily_stats` обновляется, это надо проверять через вложенные conversion/click services и тесты.

## Statuses

Статусы batch:

| Статус | Когда устанавливается | Что означает |
| --- | --- | --- |
| `previewed` | после успешного preview | batch ещё не применён |
| `applied` | после успешного apply | valid rows обработаны |
| `failed` | при ошибке применения | apply завершился с ошибкой |

Для rows используются click results или conversion statuses в зависимости от `type`.

## Error cases

| Ошибка / ситуация | Где возникает | Что происходит | Что проверить |
| --- | --- | --- | --- |
| invalid CSV format | `parseCsv` / `readCsvRows` | preview `400` | delimiter/quotes |
| missing required columns | row resolvers/default logic | row invalid | preview errors |
| unknown partner/offer/goal | entity resolution | row invalid | public ID / UUID |
| invalid status | parser | row invalid | enum |
| invalid amount | financial parser | row invalid | numeric fields |
| duplicate header | `readCsvRows` | whole preview fails | CSV headers |
| partial import | apply path | valid rows создаются, invalid/skipped считаются отдельно | batch counters |
| batch already applied | TODO: уточнить exact guard in apply service | повторный apply нежелателен | batch status |
| stats not recalculated | TODO | смотреть `daily_stats` и tests | manual stats impact |

## Idempotency / deduplication

Для этого flow idempotency/deduplication не используется напрямую на уровне batch replay, кроме естественных уникальных ограничений в `conversions`.

TODO: уточнить, есть ли явная защита от повторного `apply` одного и того же batch сверх `manual_adjustment_batches.status`.

## Security / permissions

- все routes защищены `authenticate` + `authorizeAdminArea`
- flow доступен только admin/manager ролям, которым разрешена admin area
- `created_by` сохраняется в batch/clicks/conversions для traceability

## Observability / debugging

- batch history: `manual_adjustment_batches`
- audit trail: `audit_events`
- созданные сущности: `clicks.manual_adjustment_batch_id`, `conversions.manual_adjustment_batch_id`
- UI показывает preview/result и скрытые valid rows

## Tests

| Тест | Что проверяет |
| --- | --- |
| `backend/tests/integration/admin-adjustments-stage14.test.js` | preview/apply flow для manual adjustments |
| `backend/tests/integration/daily-stats-stage16.test.js` | влияние manual source на stats |
| `backend/tests/integration/audit-log-stage18.test.js` | audit events для admin actions |

## Known limitations

- Rollback path не найден.
- Update existing click/conversion по ID не подтверждён; текущий код выглядит как create-only batch flow.
- TODO: уточнить, как именно manual clicks/conversions попадают в `daily_stats` без отдельного queue step.

## Связанные разделы

- [conversion-flow.md](./conversion-flow.md)
- [stats-rollup-flow.md](./stats-rollup-flow.md)
- [../domains/adjustments.md](../domains/adjustments.md)
- [../domains/postbacks-conversions.md](../domains/postbacks-conversions.md)
- [../domains/stats.md](../domains/stats.md)
- [../domains/finance.md](../domains/finance.md)
