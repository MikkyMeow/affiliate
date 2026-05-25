# Conversion Flow

Статус: draft

## Назначение

Документ описывает создание и изменение conversion как самостоятельной сущности: от источника события до статусов, history, финансовых snapshot и влияния на статистику.

## Краткая схема

```txt
Conversion source
  -> postback or manual adjustment or admin status action
  -> resolve click / offer / affiliate / goal
  -> resolve payout and revenue snapshots
  -> insert/update conversion
  -> write conversion_status_history
  -> update postback logs / audit / daily_stats
  -> return result
```

## Когда запускается flow

Подтверждены три источника:

1. postback flow через `GET/POST /track/postback`
2. manual adjustments через `POST /api/v1/admin/adjustments/preview` и затем `POST /api/v1/admin/adjustments/:batchId/apply`
3. admin status change через `PATCH /api/v1/conversions/:conversionId/status` и `POST /api/v1/conversions/:conversionId/status`

TODO: отдельный admin-create-conversion endpoint не найден.

## Входные данные

| Поле / источник | Назначение | Обязательность | Где используется |
| --- | --- | --- | --- |
| `clickId` | связь с click | обязательно для postback, опционально для manual rows на уровне схемы, но обычно нужен | `conversions`, unique constraints |
| `offerId` | связь с оффером | обязательно | `createConversionWithResolvedGoal`, `createConversion` |
| `affiliateId` | связь с партнёром | обязательно | `createConversionWithResolvedGoal`, `createConversion` |
| `goalId` | выбор goal snapshot | обязательно в postback, опционально в manual path в зависимости от defaults | `offer-goals.service` |
| `status` | текущий статус conversion | обязательно фактически | creation/update paths |
| `externalTransactionId` | внешний id для idempotency | опционально | unique index `(offer_id, goal_id, external_transaction_id)` |
| `source` | `tracking` или `manual` | вычисляется backend | `conversions.source` |
| `manualAdjustmentBatchId` | привязка к batch | только manual path | `conversions.manual_adjustment_batch_id` |
| `reason` | комментарй к смене статуса | опционально | `conversion_status_history.reason` |

## Участники процесса

| Участник | Роль в flow |
| --- | --- |
| `backend/src/services/postback/conversions.service.js` | создаёт conversion из postback |
| `backend/src/services/offer-goals.service.js` | goal resolution, rate resolution, snapshot creation |
| `backend/src/services/adjustments.service.js` | создаёт manual conversions |
| `backend/src/services/conversions.service.js` | меняет статус существующей conversion |
| `backend/src/models/conversions.model.js` | insert/select/update conversion rows |
| `backend/src/models/conversionStatusHistory.model.js` | status history |
| `backend/src/models/postback-logs.model.js` | lifecycle log для postback-создания |
| `backend/src/models/daily-stats.model.js` | rollup upsert |
| `backend/src/workers/registerJobs.js` | async rollup update |

## Frontend entry points

| Файл / экран | Назначение |
| --- | --- |
| `frontend/src/app/dashboard/conversions/page.tsx` | админский просмотр conversion list |
| `frontend/src/app/partner/conversions/page.tsx` | партнёрский просмотр conversion list |
| `frontend/src/app/dashboard/adjustments/page.tsx` | создание manual conversion batch |

## Backend entry points

| Route / файл | Метод / path | Назначение |
| --- | --- | --- |
| `backend/src/routes/tracking.routes.js` | `GET/POST /track/postback` | создание conversion из postback |
| `backend/src/routes/admin-adjustments.routes.js` | `POST /api/v1/admin/adjustments/preview` | preview manual conversion rows |
| `backend/src/routes/admin-adjustments.routes.js` | `POST /api/v1/admin/adjustments/:batchId/apply` | создание manual conversions |
| `backend/src/routes/conversions.routes.js` | `PATCH /api/v1/conversions/:conversionId/status` | изменение статуса conversion |
| `backend/src/routes/conversions.routes.js` | `GET /api/v1/conversions/:conversionId/status-history` | просмотр history |

## Validation

| Файл / схема | Что проверяет |
| --- | --- |
| `backend/src/validators/postback.js` | валидирует postback payload для создания conversion |
| `backend/src/validators/adjustments.js` | валидирует adjustment preview payload и CSV defaults |
| inline validation в `backend/src/routes/conversions.routes.js` | `conversionId`, `status`, `reason` для status update |

Дополнительно business validation:

- goal должен принадлежать offer
- affiliate должен существовать
- для goal limit может сработать `GOAL_LIMIT_REACHED`
- uniqueness проверяется unique indexes в БД

## Business logic

| Файл / service | Ответственность |
| --- | --- |
| `createConversionWithResolvedGoal` в `backend/src/services/offer-goals.service.js` | создаёт conversion с goal snapshot |
| `findByClickIdAndGoalIdForUpdate` / `findByOfferGoalAndExternalTransactionId` | idempotency lookups |
| `getCountedConversionCountByGoalId` | проверяет goal limit |
| `createConversion` | insert conversion row |
| `insertConversionStatusHistory` | пишет status history |
| `updateConversionStatus` | меняет status существующей conversion, пишет audit и rollup update |

Creation path заполняет snapshot-поля в `conversions`:

- `goal_id`
- `goal_name`
- `goal_type`
- `revenue_amount`
- `payout_amount`
- `payout_rub`

Это означает, что conversion хранит snapshot цели и финансов на момент создания, а не live lookup.

Admin status update path:

- блокирует row через `findConversionById(..., forUpdate: true)`
- если статус не меняется, history не создаётся
- если меняется, обновляет `conversions.status`
- пишет `conversion_status_history`
- пишет audit event
- пересчитывает `daily_stats` для даты `conversion.createdAt`

## Database reads

| Таблица | Что читается | Зачем |
| --- | --- | --- |
| `clicks` | click row | привязка conversion к трафику |
| `offers` | offer existence/context | базовый контекст |
| `affiliates` | existence | affiliate context |
| `offer_goals` | goal definition | snapshot goal name/type/revenue/payout |
| `offer_goal_affiliate_rates` | affiliate-specific rate overrides | payout/revenue snapshot |
| `conversions` | existing conversion for uniqueness or status update | idempotency/status transitions |
| `conversion_status_history` | history list | UI/debugging |

## Database writes

| Таблица | Что записывается / обновляется | Когда |
| --- | --- | --- |
| `conversions` | новая conversion row или update `status`/`updated_at` | create/update |
| `conversion_status_history` | initial or changed status history entry | при создании и status update |
| `postback_logs` | resolved goal / processed/duplicate/rejected/failed | только postback source |
| `manual_adjustment_batches` | metadata/result linkage | только manual source |
| `daily_stats` | rollup update по conversion date | async или sync при status update |
| `audit_events` | status change audit, adjustment audit | admin/manual flows |

## Redis / cache / locks

Отдельной Redis-логики у conversion flow не подтверждено.

Используются:

- PostgreSQL row lock при admin status update
- BullMQ/Redis только для async rollup jobs после создания conversion

## Queue / async events

| Событие / очередь | Где создаётся | Что делает |
| --- | --- | --- |
| `POSTBACK_EVENT` c `type = conversion_created` | postback service | асинхронно вызывает `updateConversionRollup` |

Manual adjustments в `applyManualAdjustmentBatch` отдельную queue на stats не публикуют. Они обновляют данные синхронно в рамках flow. TODO: уточнить, пересчитывается ли `daily_stats` для manual conversions сразу в том же transaction path.

## Statuses

| Статус | Когда устанавливается | Что означает |
| --- | --- | --- |
| `pending` | default postback status или manual default | conversion ещё не подтверждена |
| `approved` | approved postback или admin update | подтверждённая conversion |
| `rejected` | rejected postback или admin update | отклонённая conversion |
| `cancelled` | admin update/manual import | отменённая conversion |

## Error cases

| Ошибка / ситуация | Где возникает | Что происходит | Что проверить |
| --- | --- | --- | --- |
| click не найден | postback service | conversion не создаётся | `clicks.click_id` |
| goal не найден | offer-goals service | `404 GOAL_NOT_FOUND_FOR_OFFER` | `offer_goals` |
| conversion уже существует | unique index | duplicate error | `click_id`, `goal_id`, `external_transaction_id` |
| repeated status update | `updateConversionStatus` | returns conversion without new history entry | same `status` |
| rejected после approved | код не запрещает явно | status обновится, history создастся | business expectation |
| approved после rejected | код не запрещает явно | status обновится, history создастся | business expectation |
| payout/revenue изменились после создания goal | snapshot в conversion не меняется автоматически | проверять snapshot columns | `conversions.revenue_amount/payout_amount` |
| goal переименован после conversion | snapshot name/type не меняются | проверять `conversions.goal_name` | snapshot semantics |
| manual adjustment конфликтует с postback | сработает uniqueness/index | duplicate or failed batch row | batch errors |

## Idempotency / deduplication

Используется напрямую.

- creation idempotency основана на unique indexes таблицы `conversions`
- repeated status update идемпотентен на уровне `updateConversionStatus`: если статус уже такой же, update/history не выполняются

## Security / permissions

- postback source защищён `token + signature`
- admin status updates и manual adjustments доступны только authenticated admin area через `authenticate` + `authorizeAdminArea`
- partner/advertiser не могут менять conversion status напрямую через подтверждённые routes

## Observability / debugging

- для postback-создания смотреть `postback_logs`
- для admin/manual изменений смотреть `audit_events`
- для history смотреть `conversion_status_history`
- для stats side-effects смотреть `daily_stats`
- полезные conversion fields: `source`, `manual_adjustment_batch_id`, `goal_id`, `goal_name`, `revenue_amount`, `payout_amount`, `external_transaction_id`, `updated_at`

## Tests

| Тест | Что проверяет |
| --- | --- |
| `backend/tests/integration/postback-goal-awareness-stage8_1.test.js` | создание goal-aware conversion и uniqueness |
| `backend/tests/integration/conversion-status-stage15.test.js` | status update/history |
| `backend/tests/integration/admin-adjustments-stage14.test.js` | manual conversion creation |
| `backend/tests/integration/daily-stats-stage16.test.js` | влияние conversions на rollup |

## Known limitations

- TODO: правила допустимых status transition не найдены; код допускает смену между всеми значениями из enum.
- TODO: отдельный flow “update conversion from repeated postback” не реализован; вместо этого duplicate отклоняется.
- TODO: не подтверждён отдельный finance ledger beyond snapshot fields and daily stats.

## Связанные разделы

- [postback-flow.md](./postback-flow.md)
- [manual-adjustment-flow.md](./manual-adjustment-flow.md)
- [stats-rollup-flow.md](./stats-rollup-flow.md)
- [../domains/postbacks-conversions.md](../domains/postbacks-conversions.md)
- [../domains/offer-goals.md](../domains/offer-goals.md)
- [../domains/finance.md](../domains/finance.md)
