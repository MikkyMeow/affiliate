# Tracking API

Статус: draft

## Назначение

Tracking API обслуживает публичные tracking-ссылки и внешний postback flow: регистрацию клика, выбор redirect destination, GEO/access checks, дедупликацию кликов, приём postback’ов, валидацию подписи, создание conversion и логирование postback lifecycle.

## Base path

- `/track`

## Response format

- Для `GET /track/click` основной успешный ответ не JSON, а `302 Redirect`.
- Для `POST|GET /track/postback` успешный ответ использует backend envelope `success/data/meta`.
- Для части ошибок tracking click route возвращает raw JSON вида:

```json
{
  "error": "offerId обязателен",
  "code": "VALIDATION_ERROR"
}
```

- Для postback ошибки идут через общий error handler. `TODO: уточнить точный error envelope по middleware/errorHandler.js`.

## Auth / permissions

- `GET /track/click` публичный endpoint.
- `GET /track/postback` и `POST /track/postback` публичные external endpoints для advertiser/system-to-system callbacks.
- Авторизация по user session не требуется.
- Для postback обязательны:
  - `token` оффера;
  - `clickId` или `click_id`;
  - `goalId` или `goal_id`;
  - `signature` или `sig`.
- `token` резолвит оффер, а `signature` HMAC-подписывает payload `clickId|status|payoutRub`.
- Дополнительно postback проверяет, что клик относится к тому же offer, и что affiliate действительно имел доступ к offer.

## Endpoint map

| Method | Path | Roles | Frontend page | Route file | Service | Test |
|---|---|---|---|---|---|---|
| GET | `/track/click` | public | Не используется frontend напрямую; используется tracking link | `backend/src/routes/tracking.routes.js` | `backend/src/services/tracking/clicks.service.js` | `backend/tests/integration/critical-path.test.js`, `backend/tests/integration/offer-visibility-stage7.test.js`, `backend/tests/integration/postback-goal-awareness-stage8_1.test.js` |
| POST | `/track/postback` | public external | Не используется frontend напрямую | `backend/src/routes/tracking.routes.js` | `backend/src/services/postback/conversions.service.js` | `backend/tests/integration/critical-path.test.js`, `backend/tests/integration/postback-goal-awareness-stage8_1.test.js` |
| GET | `/track/postback` | public external | Не используется frontend напрямую | `backend/src/routes/tracking.routes.js` | `backend/src/services/postback/conversions.service.js` | `backend/tests/integration/postback-goal-awareness-stage8_1.test.js` |
| GET | `/track/unavailable` | public | Не используется frontend напрямую; fallback landing page | `backend/src/routes/tracking.routes.js` | route-local HTML response | `backend/tests/integration/critical-path.test.js` |

## Detailed endpoints

## GET /track/click

### Назначение

Регистрирует клик, проверяет доступ партнёра к офферу, применяет GEO-targeting и duplicate-click protection, затем редиректит на target URL, fallback URL или internal unavailable page.

### Роли

- `public`

### Query params

| Param | Type | Required | Description |
|---|---|---|---|
| `offerId` | `uuid` | Да | UUID оффера. Валидируется в `validateTrackingQuery()`. |
| `affiliateId` | `uuid` | Да | UUID партнёра. |
| `sub1` | `string` | Нет | Пользовательский tracking sub parameter. |
| `sub2` | `string` | Нет | Пользовательский tracking sub parameter. |
| `sub3` | `string` | Нет | Пользовательский tracking sub parameter. |
| `sub4` | `string` | Нет | Пользовательский tracking sub parameter. |
| `sub5` | `string` | Нет | Пользовательский tracking sub parameter. |
| `device` | `string` | Нет | Если не передан, backend пытается определить device по `User-Agent`. |

### Path params

Нет.

### Body

Нет.

### Response

- Успех: `302 Found`
- Redirect URL строится из `offer.targetUrl` через `buildRedirectUrl()`.
- В target URL backend подставляет `click_id`.
- Если GEO strict не блокирует трафик, redirect outcome = `allowed_target_redirect`.
- Если GEO strict блокирует и у offer есть `fallbackUrl`, redirect outcome = `fallback_redirect`.
- Если GEO strict блокирует и `fallbackUrl` нет, redirect идёт на `/track/unavailable?...`, outcome = `internal_unavailable_redirect`.

Подтверждённые свойства registerClick result:

- `clickId`
- `redirectUrl`
- `redirectOutcome`
- `redirectReason`
- `destinationType`
- `countryCode`
- `targetingStrict`
- `deduplicated`

JSON успешного ответа нет, потому что endpoint редиректит.

### Errors

| Code | Причина | Когда возникает |
|---|---|---|
| `400` + `VALIDATION_ERROR` | Missing offer id | Не передан `offerId`. |
| `400` + `VALIDATION_ERROR` | Invalid offer id | `offerId` не UUID. |
| `400` + `VALIDATION_ERROR` | Missing affiliate id | Не передан `affiliateId`. |
| `400` + `VALIDATION_ERROR` | Invalid affiliate id | `affiliateId` не UUID. |
| `400` + `VALIDATION_ERROR` | Invalid tracking sub/device param | `sub1..sub5` или `device` не проходят валидацию длины/типа. |
| `403` + `FORBIDDEN` | No access to offer | `getPartnerOfferVisibilityState()` решил, что affiliate не может лить на offer. |
| `404` + `NOT_FOUND` | Offer not found | Оффер не найден в hot lookup. |
| `404` + `NOT_FOUND` | Affiliate not found | Партнёр не найден в hot lookup. |
| `409` + `CONFLICT` | Offer not active | Оффер найден, но `status !== active`. |
| `409` + `CONFLICT` | Affiliate not active | Партнёр найден, но `status !== active`. |
| `409` + `CONFLICT` | Duplicate click_id | Сгенерированный или переданный `clickId` уже занят. |
| `500` + `INTERNAL_ERROR` | Redirect URL build failed | Не удалось собрать redirect URL. |

### Used by frontend

| Frontend file / page | Как использует |
|---|---|
| `frontend/src/app/partner/page.tsx` | Не вызывает endpoint, а собирает tracking link для партнёра. |
| `frontend/src/app/partner/offers/[offerId]/page.tsx` | Показывает готовую tracking link. |
| `frontend/src/lib/tracking.ts` | Утилиты для tracking base URL. |

`GET /track/click` используется не SPA-клиентом, а внешним пользователем/источником трафика по сгенерированной ссылке.

### Backend files

| Файл | Назначение |
|---|---|
| `backend/src/routes/tracking.routes.js` | Public click route. |
| `backend/src/validators/tracking.js` | Валидация `offerId`, `affiliateId`, `sub1..sub5`, `device`. |
| `backend/src/services/tracking/clicks.service.js` | Основная бизнес-логика клика. |
| `backend/src/lib/generateClickId.js` | Генерация canonical click id. |
| `backend/src/lib/buildRedirectUrl.js` | Сборка target redirect URL с `click_id`. |
| `backend/src/lib/resolveOfferGeoAccess.js` | GEO allow/deny decision. |
| `backend/src/models/offerGeoRules.model.js` | GEO rule sets оффера. |
| `backend/src/services/tracking/hot-lookup.service.js` | Быстрый lookup оффера и партнёра. |
| `backend/src/services/tracking/click-dedup.service.js` | Duplicate click protection. |
| `backend/src/models/clickDedupRegistry.model.js` | Registry дедупликации. |
| `backend/src/models/clicks.model.js` | Сохранение клика. |
| `backend/src/services/offer-visibility.service.js` | Проверка доступа affiliate к offer. |

### Tests

| Test file | Что проверяет |
|---|---|
| `backend/tests/integration/critical-path.test.js` | Click redirect, duplicate click handling, fallback/internal unavailable flow. |
| `backend/tests/integration/offer-visibility-stage7.test.js` | Ограничение click tracking для private/on-request offers, hidden affiliates. |
| `backend/tests/integration/postback-goal-awareness-stage8_1.test.js` | Получение `click_id` для последующего postback flow. |

## POST /track/postback

### Назначение

Принимает postback от внешней системы, валидирует token/signature/click/goal/status, создаёт conversion и пишет postback log.

### Роли

- `public external`

### Query params

Нет.

### Path params

Нет.

### Body

| Field | Type | Required | Description |
|---|---|---|---|
| `token` | `string` | Да | Postback token оффера. |
| `clickId` / `click_id` | `string` | Да | ID клика. |
| `goalId` / `goal_id` | `uuid` | Да | Goal оффера. |
| `status` | `string` | Нет | Статус conversion. По умолчанию `pending`. |
| `payoutRub` / `payout_rub` / `payout` | `number` | Нет | Выплата партнёру. Не может быть отрицательной. |
| `externalTransactionId` / `externalId` / `transactionId` / snake_case варианты | `string` | Нет | Внешний transaction/external id. |
| `signature` / `sig` | `string` | Да | HMAC signature. |

### Response

- Успех: `200 OK`
- Endpoint возвращает `clickId`, `status`, `conversion`, `goal`.

Подтверждённый короткий пример:

```json
{
  "clickId": "clk_123",
  "status": "approved",
  "conversion": {
    "id": "uuid",
    "offerId": "uuid",
    "goalId": "uuid",
    "clickId": "clk_123",
    "externalTransactionId": "txn-1",
    "status": "approved",
    "isTest": false
  },
  "goal": {
    "id": "uuid",
    "name": "Registration"
  }
}
```

### Errors

| Code | Причина | Когда возникает |
|---|---|---|
| `400` + `VALIDATION_ERROR` | Missing click id | Не передан `clickId` / `click_id`. |
| `400` + `GOAL_REQUIRED` | Missing goal id | Не передан `goalId` / `goal_id`. |
| `400` + `VALIDATION_ERROR` | Invalid goal id | `goalId` не UUID. |
| `400` + `VALIDATION_ERROR` | Invalid payout | `payout` не число или отрицательный. |
| `400` + `VALIDATION_ERROR` | Invalid status | `status` не входит в `pending/approved/rejected/cancelled`. |
| `401` + `UNAUTHORIZED` | Missing signature | Не передана подпись. |
| `401` + `UNAUTHORIZED` | Invalid signature | Подпись не hex или не прошла HMAC-проверку. |
| `403` + `INVALID_POSTBACK_TOKEN` | Invalid token | `token` не нашёл оффер или token не соответствует offer клика. |
| `403` + `FORBIDDEN` | No access | Партнёр не должен был иметь доступ к offer. |
| `404` + `NOT_FOUND` | Click not found | `clickId` не найден. |
| `400/404` + `GOAL_NOT_FOUND_FOR_OFFER` | Invalid goal | TODO: уточнить точный status code по service при goal mismatch. |
| `409` + `DUPLICATE_CONVERSION` | Duplicate postback / conversion already exists | Повторный postback создаёт дубль conversion. |
| `409` + `GOAL_LIMIT_REACHED` | Goal limit reached | Goal не принимает новые conversions. |

### Used by frontend

| Frontend file / page | Как использует |
|---|---|
| Frontend usage не найден / endpoint используется внешней системой. |

Advertiser UI и admin UI не вызывают endpoint напрямую; они показывают postback logs и conversions, которые появляются после его обработки.

### Backend files

| Файл | Назначение |
|---|---|
| `backend/src/routes/tracking.routes.js` | Public postback routes `GET` и `POST`. |
| `backend/src/validators/postback.js` | Валидация token/click/goal/status/payout/signature. |
| `backend/src/services/postback/conversions.service.js` | Основная логика postback и conversion creation. |
| `backend/src/services/tracking/clicks.service.js` | Поиск клика по `clickId`. |
| `backend/src/models/offers.model.js` | Lookup оффера по postback token. |
| `backend/src/models/postback-logs.model.js` | Lifecycle logging postback’а. |
| `backend/src/services/offer-goals.service.js` | Создание conversion с учётом goal. |
| `backend/src/services/offer-visibility.service.js` | Проверка доступа partner к offer. |

### Tests

| Test file | Что проверяет |
|---|---|
| `backend/tests/integration/critical-path.test.js` | Успешный postback, duplicate conversion path. |
| `backend/tests/integration/postback-goal-awareness-stage8_1.test.js` | Goal-aware postback, GET/POST варианты, body/query payload. |

## GET /track/postback

### Назначение

Альтернативный transport для того же postback flow, но через query string. Полезен для внешних систем, которые умеют только GET callback.

### Роли

- `public external`

### Query params

Те же поля, что и в `POST /track/postback`, но читаются из query string.

### Path params

Нет.

### Body

Нет.

### Response

Такая же, как у `POST /track/postback`.

### Errors

Такие же, как у `POST /track/postback`.

### Used by frontend

| Frontend file / page | Как использует |
|---|---|
| Frontend usage не найден / endpoint используется внешней системой. |

### Backend files

| Файл | Назначение |
|---|---|
| `backend/src/routes/tracking.routes.js` | GET variant. |
| `backend/src/services/postback/conversions.service.js` | Общий handler. |
| `backend/src/validators/postback.js` | Общая валидация. |

### Tests

| Test file | Что проверяет |
|---|---|
| `backend/tests/integration/postback-goal-awareness-stage8_1.test.js` | GET postback flow. |

## GET /track/unavailable

### Назначение

Fallback HTML page для GEO-blocked traffic, если у оффера нет `fallbackUrl`.

### Роли

- `public`

### Query params

| Param | Type | Required | Description |
|---|---|---|---|
| `reason` | `string` | Нет | Код причины, например `country_denied`, `not_in_allow_list`, `unknown_country`. |
| `offerId` | `string` | Нет | Пробрасывается для диагностики. |
| `clickId` | `string` | Нет | Пробрасывается для диагностики. |
| `affiliateId` | `string` | Нет | Пробрасывается для диагностики. |

### Path params

Нет.

### Body

Нет.

### Response

- `200 OK`
- `Content-Type: text/html`
- Простая HTML-страница “Offer unavailable”.

### Errors

`TODO: уточнить, есть ли отдельные error cases; по route file endpoint всегда отдаёт HTML 200.`

### Used by frontend

| Frontend file / page | Как использует |
|---|---|
| Не используется frontend напрямую. |

### Backend files

| Файл | Назначение |
|---|---|
| `backend/src/routes/tracking.routes.js` | Route-local HTML response. |

### Tests

| Test file | Что проверяет |
|---|---|
| `backend/tests/integration/critical-path.test.js` | Redirect на internal unavailable страницу. |

## Связанные разделы

- [Tracking click flow](../data-flow/click-flow.md)
- [Postback flow](../data-flow/postback-flow.md)
- [Conversion flow](../data-flow/conversion-flow.md)
- [Tracking clicks domain](../domains/tracking-clicks.md)
- [Postbacks and conversions domain](../domains/postbacks-conversions.md)
