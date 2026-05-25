# Трекинг кликов

Статус: draft

## Назначение

Домен описывает public tracking endpoint `/track/click`, валидацию query params, разрешение offer/affiliate, access/GEO checks, duplicate click protection, сохранение click и финальный redirect.

## Основные пользовательские сценарии

- пользователь открывает tracking URL партнёра;
- backend валидирует `offerId`, `affiliateId` и `sub1..sub5`;
- backend проверяет статус offer и affiliate;
- backend проверяет offer visibility для affiliate;
- backend проверяет GEO targeting;
- backend дедуплицирует клик при выключенных дублях и валидном окне;
- backend создаёт запись в `clicks`, при необходимости reused canonical click;
- backend отправляет async job `click_created` и делает redirect.

## Frontend files

| Файл / папка | Назначение |
|---|---|
| `frontend/src/lib/tracking.ts` | TODO: уточнить фактическое использование frontend helper для tracking ссылок |
| `frontend/src/app/partner/offers/[offerId]/page.tsx` | показывает offer detail, из которого разработчик обычно собирает tracking link |
| `frontend/src/app/dashboard/clicks/page.tsx` | admin/manager список кликов |
| `frontend/src/app/partner/clicks/page.tsx` | partner список собственных кликов |
| `frontend/src/lib/admin-lists.ts` | клиент `/clicks` для admin list |
| `frontend/src/lib/partner.ts` | клиент `/partner/clicks` |

## Backend routes

| Route / файл | Назначение | Роли |
|---|---|---|
| `GET /track/click` (`backend/src/routes/tracking.routes.js`) | public click ingest + redirect | публичный |
| `GET /api/v1/clicks` (`backend/src/routes/clicks.routes.js`) | admin/manager click list | `admin`, `manager` |
| `GET /api/v1/partner/clicks` (`backend/src/routes/partner.routes.js`) | affiliate click list | `affiliate` |

## Validators

| Файл / схема | Что валидирует |
|---|---|
| `backend/src/validators/tracking.js#validateTrackingQuery` | `offerId`, `affiliateId`, `sub1..sub5`, optional device and query payload |
| `backend/src/validators/stats.js#validateClicksListFilters` | admin click list filters |
| `backend/src/validators/stats.js#validatePartnerClicksQuery` | partner click pagination |

## Services

| Service / файл | Ответственность |
|---|---|
| `backend/src/services/tracking/clicks.service.js` | prepare/register click, redirect decision, async publish |
| `backend/src/services/tracking/click-dedup.service.js` | dedupe window logic, advisory lock, canonical click reuse |
| `backend/src/services/tracking/hot-lookup.service.js` | быстрый lookup active offer/affiliate |
| `backend/src/services/offer-visibility.service.js` | access check before click creation |
| `backend/src/services/async-jobs.service.js` | enqueue `click_created` |
| `backend/src/lib/resolveOfferGeoAccess.js` | GEO access check |
| `backend/src/lib/buildRedirectUrl.js` | сбор final target URL с click_id |
| `backend/src/lib/detectRequestCountry.js` | country detection |
| `backend/src/lib/detectDevice.js` | device detection |
| `backend/src/lib/getClientIp.js` | IP extraction |

## Models / repositories

| Model / repository / файл | Ответственность |
|---|---|
| `backend/src/models/clicks.model.js` | insert/find click records |
| `backend/src/models/clickDedupRegistry.model.js` | active dedupe window registry |
| `backend/src/models/offers.model.js` | tracking lookup for offer settings |
| `backend/src/models/affiliateModel.js` | tracking lookup for affiliate status |
| `backend/src/models/offerGeoRules.model.js` | allow/deny country sets |

## Database tables

| Таблица | Назначение | Важные связи |
|---|---|---|
| `clicks` | raw click storage | `click_id`, `canonical_click_id`, `offer_id`, `affiliate_id`, `goal_id`, `country_code`, `device`, `source`, `is_duplicate`, `duplicate_of_click_id`, `dedupe_fingerprint` |
| `click_dedup_registry` | dedupe registry | fingerprint -> canonical `click_id`, `expires_at` |
| `offers` | tracking settings | `status`, `target_url`, `fallback_url`, `targeting_strict`, `allow_duplicate_clicks`, `duplicate_click_window_seconds` |
| `affiliates` | tracking affiliate status | `status` |
| `offer_affiliate_access` | offer access for affiliate | affects allow/deny |
| `offer_affiliate_hidden` | hidden state | blocks tracking |
| `offer_requests` | pending/rejected state | affects access resolution |
| `offer_geo_rules` | GEO policy | allow/deny lists |

## Main data flow

```txt
User opens tracking URL
  -> /track/click
  -> validateTrackingQuery
  -> resolve offer via hot-lookup.service
  -> resolve affiliate via hot-lookup.service
  -> check offer status
  -> check affiliate status
  -> check affiliate access via offer-visibility.service
  -> detect request country
  -> check GEO via resolveOfferGeoAccess
  -> evaluate duplicate click policy
  -> create or reuse canonical click
  -> insert dedupe registry entry if needed
  -> enqueue async click_created event
  -> redirect to target / fallback / internal unavailable
```

## Permissions / roles

- Трекинг endpoint публичный, без JWT.
- Admin/manager видят все клики через `/api/v1/clicks`.
- Affiliate видит только свои клики через `/api/v1/partner/clicks`.
- Access rules к offer для affiliate применяются ещё до insert click.

## Edge cases

- offer not found -> 404;
- affiliate not found -> 404;
- offer inactive -> 409;
- affiliate inactive -> 409;
- no access -> 403;
- invalid GEO -> redirect на fallback/internal unavailable при strict mode;
- duplicate click -> reused canonical click, `is_duplicate=true` и increment duplicate metrics;
- `click_id` collision -> 409;
- missing target URL / invalid redirect build -> internal error;
- malformed tracking params -> 400 validation error;
- dedupe window outside allowed range -> duplicate protection effectively выключена.

## Known limitations

- Tracking link generation как отдельная backend-функция/endpoint не выделена; link собирается на стороне продукта/интерфейса. TODO: уточнить, есть ли единый helper/UX для копирования tracking URL.
- Click ingestion не использует Redis для дедупликации; используется Postgres registry и advisory lock.
- Async enqueue failure не откатывает click insert, а только логируется и инкрементит metric.

## Tests

| Тест | Что проверяет |
|---|---|
| `backend/tests/integration/critical-path.test.js` | end-to-end click flow |
| `backend/tests/integration/offer-visibility-stage7.test.js` | tracking denial for inaccessible offers |
| `backend/tests/integration/daily-stats-stage16.test.js` | clicks schema extension and rollup inclusion |
| `backend/tests/integration/admin-adjustments-stage14.test.js` | manual click imports affecting click domain |

## Связанные разделы

- [Offers](./offers.md)
- [Affiliates](./affiliates.md)
- [Offer Access](./offer-access.md)
- [Geo Targeting](./geo-targeting.md)
- [Postbacks and Conversions](./postbacks-conversions.md)
- [Stats](./stats.md)
- [Click Flow](../data-flow/click-flow.md)
