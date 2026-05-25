# Postback Flow

Статус: draft

## Назначение

Документ описывает inbound postback от рекламодателя: как callback валидируется, как ищется click, как создаётся conversion, что пишется в `postback_logs` и как обновляется stats rollup.

## Краткая схема

```txt
Advertiser sends postback
  -> GET /track/postback or POST /track/postback
  -> rate limit
  -> normalize query/body payload
  -> validate token, clickId, goalId, status, payout, signature
  -> create postback_logs row with status=received
  -> resolve offer by token
  -> resolve click by clickId
  -> verify click belongs to offer
  -> verify signature
  -> verify affiliate still has access to offer
  -> resolve goal and financial snapshot
  -> create conversion
  -> update postback_logs
  -> enqueue conversion_created job
  -> return API response
```

## Когда запускается flow

Flow запускается входящим advertiser callback в public tracking endpoint.

Подтверждённые entry points в `backend/src/routes/tracking.routes.js`:

- `POST /track/postback`
- `GET /track/postback`

## Входные данные

| Поле / источник | Назначение | Обязательность | Где используется |
| --- | --- | --- | --- |
| `token` | ищет оффер по postback token | обязательно | `validatePostbackParams`, `findOfferForPostbackByToken` |
| `clickId` / `click_id` | идентификатор клика | обязательно | `validatePostbackParams`, `getClickByClickId` |
| `goalId` / `goal_id` | goal-aware conversion resolution | обязательно | `validatePostbackParams`, `createConversionWithResolvedGoal` |
| `status` | статус конверсии | опционально, default `pending` | `validatePostbackParams`, `ensureValidStatus` |
| `payoutRub` / `payout_rub` / `payout` | сумма для подписи; в conversion snapshot прямо не записывается | опционально | signature verification |
| `externalTransactionId` и алиасы | внешний transaction id | опционально | conversion uniqueness / snapshot |
| `signature` / `sig` | HMAC-подпись | обязательно | `verifySignature` |

## Участники процесса

| Участник | Роль в flow |
| --- | --- |
| `backend/src/routes/tracking.routes.js` | public postback route, GET/POST support |
| `backend/src/validators/postback.js` | нормализация и валидация payload |
| `backend/src/services/postback/conversions.service.js` | orchestration postback lifecycle |
| `backend/src/services/tracking/clicks.service.js` | lookup click by `clickId` |
| `backend/src/services/offer-goals.service.js` | goal resolution, financial snapshots, create conversion |
| `backend/src/models/offers.model.js` | lookup offer by `postback_token` |
| `backend/src/models/postback-logs.model.js` | lifecycle log `received/processed/rejected/duplicate/failed` |
| `backend/src/models/conversions.model.js` | persist conversion row |
| `backend/src/models/processed-async-events.model.js` | async rollup dedupe in worker |
| `backend/src/services/offer-visibility.service.js` | проверка, что affiliate ещё может конвертить оффер |
| `backend/src/workers/registerJobs.js` | conversion rollup update |

## Frontend entry points

Frontend не участвует напрямую.

## Backend entry points

| Route / файл | Метод / path | Назначение |
| --- | --- | --- |
| `backend/src/routes/tracking.routes.js` | `POST /track/postback` | postback через body |
| `backend/src/routes/tracking.routes.js` | `GET /track/postback` | postback через query string |

## Validation

Payload валидируется в `validatePostbackParams` из `backend/src/validators/postback.js`.

| Файл / схема | Что проверяет |
| --- | --- |
| `validatePostbackParams` | `token` обязателен, строка, длина <= 255 |
| `validatePostbackParams` | `clickId`/`click_id` обязателен, строка, длина <= 255 |
| `validatePostbackParams` | `goalId`/`goal_id` обязателен и должен быть UUID |
| `validatePostbackParams` | `status`, если передан, должен быть одним из `pending/approved/rejected/cancelled` |
| `parsePayout` | `payout` должен быть числом >= 0 |
| `validatePostbackParams` | `externalTransactionId` и алиасы должны быть непустой строкой <= 255 |
| `validatePostbackParams` | `signature`/`sig` обязателен |
| `verifySignature` в `backend/src/services/postback/conversions.service.js` | подпись должна быть hex и проходить `timingSafeEqual` |

Если валидация не проходит, route:

- пишет `postback_logs` через `logPostbackValidationFailure`
- возвращает `400`
- для отсутствующего `goalId` использует `ERROR_CODES.GOAL_REQUIRED`

## Business logic

| Файл / service | Ответственность |
| --- | --- |
| `handlePostbackRequest` | общий GET/POST handler, извлекает payload и вызывает `registerConversion` |
| `registerConversion` в `backend/src/services/postback/conversions.service.js` | orchestrates весь lifecycle |
| `findOfferForPostbackByToken` | находит оффер по `offers.postback_token` |
| `assertOfferMatchesClick` | токен должен принадлежать тому же офферу, что и click |
| `getClickByClickId` | поднимает click из `clicks` |
| `getPartnerOfferVisibilityState` + `canPartnerAccessOffer` | postback отвергается, если affiliate не должен видеть/конвертить оффер |
| `createConversionWithResolvedGoal` | создаёт conversion, выбирает goal snapshot, revenue/payout snapshot и uniqueness rules |
| `publishConversionCreatedJob` | отправляет async job для rollup |

Flow по шагам:

1. Route нормализует payload: для GET query конвертируется в plain object, для POST используется body.
2. Создаётся `postback_logs` row со `status = received`.
3. По `token` ищется оффер. Токен одновременно является HMAC secret.
4. По `clickId` ищется клик в `clicks`.
5. Проверяется соответствие `click.offerId === offer.id`.
6. Проверяется HMAC SHA-256 подпись от строки `clickId|status|payoutRub`.
7. Проверяется visibility/access оффера для affiliate из клика.
8. Через `createConversionWithResolvedGoal` создаётся conversion.
9. `postback_logs` обновляется в `processed`, `duplicate`, `rejected` или `failed`.
10. При успехе публикуется async job `conversion_created`.

## Database reads

| Таблица | Что читается | Зачем |
| --- | --- | --- |
| `offers` | оффер по `postback_token` | auth + goal context |
| `clicks` | click по `click_id` | привязка conversion к click |
| `offer_goals` | goal по `goalId`, default goal, goal snapshots | goal-aware conversion |
| `offer_goal_affiliate_rates` | payout/revenue override по affiliate | финансовый snapshot |
| `conversions` | uniqueness checks по `click_id`, `goal_id`, `external_transaction_id` | idempotency |
| `offer_affiliate_access` / `offer_affiliate_hidden` | TODO: уточнить точные SQL в visibility service | access re-check |

## Database writes

| Таблица | Что записывается / обновляется | Когда |
| --- | --- | --- |
| `postback_logs` | lifecycle log, error code, resolved goal, goal error | всегда |
| `conversions` | conversion row со статусом, goal snapshot, revenue/payout snapshot, `external_transaction_id` | при успехе |
| `conversion_status_history` | initial history entry для созданной conversion | создаётся внутри goal-aware conversion service |
| `processed_async_events` | reservation ключей async событий | асинхронно в worker |
| `daily_stats` | conversion rollup upsert | асинхронно через worker |

## Redis / cache / locks

TODO: уточнить использование Redis/cache/locks именно в postback-flow. В `registerConversion` прямой Redis-логики нет. Queue использует Redis через BullMQ, но domain-логика postback не зависит от Redis cache.

## Queue / async events

| Событие / очередь | Где создаётся | Кто обрабатывает | Что делает |
| --- | --- | --- | --- |
| `POSTBACK_EVENT` c payload `type = conversion_created` | `publishConversionCreatedJob` | `backend/src/workers/registerJobs.js` | вызывает `updateConversionRollup`, обновляет `daily_stats` |

Повторная обработка async event защищена таблицей `processed_async_events`.

## Statuses

Статусы conversion подтверждены в `backend/src/constants/conversions.js` и миграции `1738100000000_stage15_conversion_status_history.js`.

| Статус | Значение |
| --- | --- |
| `pending` | конверсия создана, но ещё не подтверждена |
| `approved` | подтверждённая конверсия |
| `rejected` | отклонённая конверсия |
| `cancelled` | отменённая конверсия |

Дополнительно `postback_logs.status`:

| Статус | Когда устанавливается | Что означает |
| --- | --- | --- |
| `received` | сразу после входа postback | callback принят route |
| `processed` | conversion создана | успешная обработка |
| `duplicate` | uniqueness constraint сработал | повторный postback |
| `rejected` | validation/domain/auth error | бизнес-ошибка |
| `failed` | unexpected/internal error | серверная ошибка |

## Error cases

| Ошибка / ситуация | Где возникает | Что происходит | Что проверить |
| --- | --- | --- | --- |
| missing `clickId` | validator | `400`, postback log `rejected` | payload aliases |
| missing `goalId` | validator | `400`, `GOAL_REQUIRED` | payload |
| invalid `status` | validator | `400` | allowed statuses |
| invalid `signature` | `verifySignature` | `401 UNAUTHORIZED` | secret, payload string, payout |
| invalid `token` | `findOfferForPostbackByToken` | `403 INVALID_POSTBACK_TOKEN` | `offers.postback_token` |
| click not found | `getClickByClickId` | `404 NOT_FOUND` | `clicks.click_id` |
| click belongs to another offer | `assertOfferMatchesClick` | `403 INVALID_POSTBACK_TOKEN` | click/offer consistency |
| goal not found for offer | goal resolution service | `404 GOAL_NOT_FOUND_FOR_OFFER` | `offer_goals` |
| goal limit reached | goal service | `409 GOAL_LIMIT_REACHED` | goal limit fields |
| duplicate postback | unique index violation | `409 DUPLICATE_CONVERSION`, postback log `duplicate` | conversion unique indexes |
| affiliate lost access to offer | visibility check | `403 FORBIDDEN` | visibility rules |
| amount invalid | validator | `400` | `payout` format |

## Idempotency / deduplication

Idempotency реализована на уровне БД, не на уровне Redis.

Подтверждённые ограничения:

- `conversions_click_id_without_goal_unique_idx`: unique `click_id`, если `goal_id IS NULL`
- `conversions_click_goal_unique_idx`: unique `(click_id, goal_id)`, если `goal_id IS NOT NULL`
- `conversions_offer_goal_external_transaction_unique_idx`: unique `(offer_id, goal_id, external_transaction_id)`, если `external_transaction_id IS NOT NULL`

При duplicate postback код ловит `23505` и:

- обновляет `postback_logs.status = duplicate`
- возвращает `409 DUPLICATE_CONVERSION`

## Security / permissions

- endpoint публичный, пользовательская auth-сессия не требуется
- защита строится на `token + signature + click/offer match`
- `postbackRateLimiter` ограничивает входящие запросы
- payload считается недоверенным: route и service валидируют все ключевые поля

## Observability / debugging

- `postback_logs` является главным источником диагностики
- structured logs: `postback_received`, `postback_goal_resolved`, `conversion_created`, `postback_duplicate`, `postback_failed`, `postback_validation_failed`
- метрики: `trackingPostbackRequestsCounter`, `trackingPostbackErrorsCounter`, `trackingPostbackDuplicatesCounter`
- для stats side-effect проверять `daily_stats`
- для повторных async updates смотреть `processed_async_events`

## Tests

| Тест | Что проверяет |
| --- | --- |
| `backend/tests/integration/postback-goal-awareness-stage8_1.test.js` | goal-aware postback, uniqueness и goal resolution |
| `backend/tests/integration/offer-goals-stage8.test.js` | goal model и финансовые правила |
| `backend/tests/integration/conversion-status-stage15.test.js` | conversion statuses/history |
| `backend/tests/integration/daily-stats-stage16.test.js` | влияние conversion на rollup |
| `backend/tests/helpers/postback.js` | test helper для postback payload/signature |

## Known limitations

- `payoutRub` участвует в подписи, но текущий путь создания conversion использует goal snapshot и affiliate rate snapshot; TODO: уточнить, должна ли сумма из postback переопределять snapshot.
- TODO: flow обновления уже существующей conversion не найден; текущий код в postback-path только создаёт новую conversion и отклоняет duplicate.
- TODO: support `amount/revenue` как отдельного входного финансового поля для conversion не подтверждён.

## Связанные разделы

- [../domains/postbacks-conversions.md](../domains/postbacks-conversions.md)
- [../domains/tracking-clicks.md](../domains/tracking-clicks.md)
- [../domains/offer-goals.md](../domains/offer-goals.md)
- [../domains/finance.md](../domains/finance.md)
- [../domains/stats.md](../domains/stats.md)
- [../api/tracking.md](../api/tracking.md)
- [conversion-flow.md](./conversion-flow.md)
