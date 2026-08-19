# Постбеки и конверсии

Статус: draft

## Назначение

Домен описывает public postback endpoint, resolution click/offer/goal, idempotent conversion create/update rules, status history, postback logs и admin conversion management.

## Основные пользовательские сценарии

- advertiser/система отправляет postback на public endpoint с token, clickId, status и signature;
- backend валидирует payload и подпись;
- backend находит click и offer по token;
- backend резолвит goal и affiliate-specific rate;
- backend создаёт conversion или отклоняет duplicate;
- backend пишет postback log и async event;
- admin/manager просматривает conversions list и меняет статус вручную;
- admin/manager смотрит history статусов конверсии.

## Frontend files

| Файл / папка | Назначение |
|---|---|
| `frontend/src/app/dashboard/conversions/page.tsx` | admin/manager список conversions |
| `frontend/src/app/dashboard/offers/[id]/edit/OfferPostbackSection.tsx` | postback token/examples в offer UI |
| `frontend/src/app/partner/conversions/page.tsx` | affiliate conversions list |
| `frontend/src/app/advertiser/postbacks/page.tsx` | advertiser postback log list |
| `frontend/src/app/advertiser/postbacks/[postbackId]/page.tsx` | advertiser postback detail |
| `frontend/src/lib/admin-lists.ts` | admin list + status update + status history |
| `frontend/src/lib/partner.ts` | partner conversions API |
| `frontend/src/lib/advertiser.api.ts` | advertiser postbacks API |

## Backend routes

| Route / файл | Назначение | Роли |
|---|---|---|
| `GET /track/postback` (`backend/src/routes/tracking.routes.js`) | public GET postback | публичный |
| `POST /track/postback` (`backend/src/routes/tracking.routes.js`) | public POST postback | публичный |
| `GET /api/v1/conversions` (`backend/src/routes/conversions.routes.js`) | admin/manager conversion list | `admin`, `manager` |
| `PATCH /api/v1/conversions/:conversionId/status` (`backend/src/routes/conversions.routes.js`) | change conversion status | `admin`, `manager` |
| `POST /api/v1/conversions/:conversionId/status` (`backend/src/routes/conversions.routes.js`) | alias для status update | `admin`, `manager` |
| `GET /api/v1/conversions/:conversionId/status-history` (`backend/src/routes/conversions.routes.js`) | history list | `admin`, `manager` |
| `GET /api/v1/partner/conversions` (`backend/src/routes/partner.routes.js`) | affiliate conversions list | `affiliate` |
| `GET /api/v1/advertiser/postbacks` (`backend/src/routes/advertiser-postbacks.routes.js`) | advertiser postback logs | `advertiser` |
| `GET /api/v1/advertiser/postbacks/:postbackId` (`backend/src/routes/advertiser-postbacks.routes.js`) | advertiser postback detail | `advertiser` |
| `GET /api/v1/admin/postback-logs` (`backend/src/routes/admin-postback-logs.routes.js`) | TODO: уточнить точный набор admin log routes по файлу |

## Validators

| Файл / схема | Что валидирует |
|---|---|
| `backend/src/validators/postback.js#validatePostbackParams` | token, clickId, status, signature, goalId, externalTransactionId |
| `backend/src/validators/stats.js#validateConversionsListFilters` | admin conversion filters |
| `backend/src/validators/stats.js#validatePartnerConversionsQuery` | partner conversion filters |
| `backend/src/validators/offers.js#validateUuid` | `conversionId` |

## Services

| Service / файл | Ответственность |
|---|---|
| `backend/src/services/postback/conversions.service.js` | registerConversion, signature check, postback logging, async publish |
| `backend/src/services/offer-goals.service.js#createConversionWithResolvedGoal` | create conversion with resolved goal/rates/uniqueness |
| `backend/src/services/conversions.service.js` | admin status update + history + rollup update |
| `backend/src/services/postback-logs.service.js` | admin postback log access |
| `backend/src/services/advertisers/advertiser-postbacks.service.js` | advertiser-facing postback logs |
| `backend/src/services/async-jobs.service.js` | enqueue `conversion_created` |

## Models / repositories

| Model / repository / файл | Ответственность |
|---|---|
| `backend/src/models/conversions.model.js` | insert/find/update conversions, uniqueness/lookups |
| `backend/src/models/conversionStatusHistory.model.js` | insert/list status history |
| `backend/src/models/postback-logs.model.js` | lifecycle log create/update |
| `backend/src/models/offers.model.js` | find offer by postback token |
| `backend/src/models/clicks.model.js` | resolve click by `click_id` |
| `backend/src/models/offerGoals.model.js` | resolve goal |

## Database tables

| Таблица | Назначение | Важные связи |
|---|---|---|
| `conversions` | conversion storage | `click_id`, `offer_id`, `affiliate_id`, `goal_id`, `external_transaction_id`, `status`, `revenue_amount`, `payout_amount`, `source`, `manual_adjustment_batch_id`, `is_test` |
| `conversion_status_history` | история статусов | `conversion_id -> conversions.id`, `changed_by -> users.id` |
| `postback_logs` | журнал входящих postback-ов | `request_id`, `click_id`, `offer_id`, `affiliate_id`, `status`, `error_code`, `resolved_goal_id`, `goal_error`, `payload_json` |
| `offers` | источник `postback_token` | `postback_token unique` |
| `offer_goals` | goal resolution | `goal_id -> offer_goals.id` |
| `clicks` | click resolution | `click_id`, `offer_id`, `affiliate_id` |
| `daily_stats` | stats recalculation after status changes | rollup by statuses |

## Main data flow

```txt
Advertiser sends postback
  -> /track/postback
  -> validatePostbackParams
  -> verify signature and token
  -> resolve click by clickId
  -> resolve offer by postback token
  -> ensure offer matches click
  -> resolve partner access state
  -> resolve goal and effective rate
  -> create conversion or detect duplicate
  -> write postback log status/result
  -> enqueue conversion_created event
  -> return conversion/goal summary

Admin status update
  -> /api/v1/conversions/:conversionId/status
  -> validate status/reason
  -> conversions.service.updateConversionStatus
  -> conversions.model.update status
  -> conversion_status_history insert
  -> daily_stats rollup update
  -> audit_events
```

## Permissions / roles

- Public postback endpoint не требует JWT, но требует `token` и `signature`.
- `admin` и `manager` видят все conversions и могут менять status.
- `affiliate` видит только свои conversions через partner route.
- `advertiser` видит только postback logs своих offers, не admin conversions list.
- Visibility/access offer для affiliate повторно проверяется даже в postback flow через `getPartnerOfferVisibilityState`.

## Edge cases

- missing click id -> 400;
- click not found -> 404;
- invalid postback token -> 403;
- goal not found -> `GOAL_NOT_FOUND_FOR_OFFER` и rejected log;
- goal required -> 400;
- invalid status -> 400;
- duplicate postback / duplicate conversion -> `DUPLICATE_CONVERSION`, log status `duplicate`;
- conversion already exists by click+goal or external transaction unique indexes -> duplicate path;
- rejected after approved / approved after pending -> allowed via manual status update and history tracking;
- amount mismatch напрямую не валидируется против advertiser input, потому что snapshot берётся из goal/rate. TODO: уточнить, нужно ли product-level сравнение advertiser amount vs resolved amount;
- unknown advertiser фактически выражается как invalid offer token/ownership mismatch, а не отдельный advertiser lookup;
- signature invalid -> 401.

## Known limitations

- Status transitions не ограничены строгой state machine; сервис пишет history и обновляет статус, если новое значение отличается.
- Поле `responseStatusCode` встречается в advertiser postback mapping, но в текущем селекте таблицы не подтверждено как persisted column. TODO: уточнить.
- Отдельной очереди/retry mechanism для external postback processing не видно; endpoint обрабатывает запрос синхронно.

## Tests

| Тест | Что проверяет |
|---|---|
| `backend/tests/integration/critical-path.test.js` | основной click -> postback -> conversion flow |
| `backend/tests/integration/postback-goal-awareness-stage8_1.test.js` | goal-aware postbacks, uniqueness rules |
| `backend/tests/integration/conversion-status-stage15.test.js` | admin status update, history, permissions |
| `backend/tests/integration/advertiser-postbacks.test.js` | advertiser postback logs |
| `backend/tests/integration/daily-stats-stage16.test.js` | rollup impact statuses/manual/test |

## Связанные разделы

- [Tracking Clicks](./tracking-clicks.md)
- [Offer Goals](./offer-goals.md)
- [Offers](./offers.md)
- [Stats](./stats.md)
- [Finance](./finance.md)
- [Postback Flow](../data-flow/postback-flow.md)
- [Conversion Flow](../data-flow/conversion-flow.md)
