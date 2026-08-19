# Click Flow

Статус: draft

## Назначение

Документ описывает ingest tracking-click: от партнёрской tracking-ссылки до записи в `clicks`, dedupe, GEO-решения и редиректа. Flow важен, потому что от него зависят postback/conversion, daily stats и диагностика трафика.

## Краткая схема

```txt
Affiliate opens tracking link
  -> GET /track/click
  -> validate query params
  -> rate limit
  -> resolve offer and affiliate
  -> check offer status and affiliate status
  -> check affiliate visibility/access to offer
  -> detect country and device
  -> load GEO rules
  -> build dedupe fingerprint
  -> optional duplicate resolution via click_dedup_registry
  -> generate clickId
  -> persist clicks row
  -> enqueue click_created job for rollup
  -> redirect to target/fallback/internal unavailable page
```

## Когда запускается flow

Flow запускается, когда пользователь открывает tracking URL, который фронтенд строит через `frontend/src/lib/tracking.ts` и показывает на странице оффера партнёра `frontend/src/app/partner/offers/[offerId]/page.tsx`.

HTTP entry point подтверждён в `backend/src/routes/tracking.routes.js`: `GET /track/click`.

## Входные данные

| Поле / источник | Назначение | Обязательность | Где используется |
| --- | --- | --- | --- |
| `offerId` из query | UUID оффера | обязательно | `backend/src/validators/tracking.js`, `backend/src/services/tracking/clicks.service.js` |
| `affiliateId` из query | UUID партнёра | обязательно | `backend/src/validators/tracking.js`, `backend/src/services/tracking/clicks.service.js` |
| `sub1`..`sub5` из query | партнёрские сабы | опционально | записываются в `clicks`, входят в dedupe fingerprint |
| `device` из query | override устройства | опционально | `backend/src/routes/tracking.routes.js`, `backend/src/validators/tracking.js` |
| `user-agent` header | автоопределение устройства и fingerprint | опционально | `backend/src/lib/detectDevice.js`, `buildClickDedupFingerprint` |
| client IP | GEO и dedupe | опционально | `backend/src/lib/getClientIp.js`, `backend/src/lib/detectRequestCountry.js` |
| `referer` header | запись источника перехода и dedupe | опционально | `clicks.referer`, `buildClickDedupFingerprint` |
| определённый `countryCode` | GEO access decision | опционально | `resolveOfferGeoAccess`, `clicks.country_code` |

## Участники процесса

| Участник | Роль в flow |
| --- | --- |
| `frontend/src/app/partner/offers/[offerId]/page.tsx` | показывает tracking-link партнёру |
| `frontend/src/lib/tracking.ts` | собирает `/track/click` URL |
| `backend/src/routes/tracking.routes.js` | HTTP entry point, pre-processing, rate limit, redirect response |
| `backend/src/validators/tracking.js` | валидация query |
| `backend/src/services/tracking/clicks.service.js` | основная бизнес-логика click ingestion |
| `backend/src/services/tracking/hot-lookup.service.js` | hot lookup оффера/партнёра через Redis cache с fallback в БД |
| `backend/src/services/tracking/click-dedup.service.js` | duplicate detection window и advisory lock |
| `backend/src/services/offer-visibility.service.js` | вычисляет видимость оффера для партнёра |
| `backend/src/services/offers/affiliate-visibility.js` | решает, можно ли партнёру открыть оффер |
| `backend/src/lib/detectRequestCountry.js` | определяет страну по запросу |
| `backend/src/lib/detectDevice.js` | определяет устройство по `user-agent` |
| `backend/src/lib/buildRedirectUrl.js` | подставляет `clickId` в `offer.targetUrl` |
| `backend/src/lib/buildClickDedupFingerprint.js` | строит SHA-256 fingerprint |
| `backend/src/models/clicks.model.js` | insert/find click rows |
| `backend/src/models/offerGeoRules.model.js` | читает allow/deny GEO rules |
| `backend/src/models/clickDedupRegistry.model.js` | читает/пишет dedupe registry |
| `backend/src/services/async-jobs.service.js` | enqueue async job |
| `backend/src/workers/registerJobs.js` | обрабатывает `click_created` и обновляет rollup |

## Frontend entry points

| Файл / экран | Назначение |
| --- | --- |
| `frontend/src/app/partner/offers/[offerId]/page.tsx` | показывает tracking link вида `${TRACKING_BASE}/click?offerId=...&affiliateId=...` |
| `frontend/src/lib/tracking.ts` | helper `buildTrackingUrl("/click")` |

## Backend entry points

| Route / файл | Метод / path | Назначение |
| --- | --- | --- |
| `backend/src/routes/tracking.routes.js` | `GET /track/click` | принимает tracking query, валидирует, регистрирует клик, делает `302` redirect |
| `backend/src/routes/tracking.routes.js` | `GET /track/unavailable` | internal fallback page для GEO deny без `offer.fallbackUrl` |

## Validation

Query валидируется в `backend/src/validators/tracking.js`.

Проверки:

| Файл / схема | Что проверяет |
| --- | --- |
| `validateTrackingQuery` в `backend/src/validators/tracking.js` | `offerId` обязателен и должен быть UUID |
| `validateTrackingQuery` | `affiliateId` обязателен и должен быть UUID |
| `validateSubParam` | `sub1`..`sub5` должны быть строками не длиннее 255 |
| `validateDeviceParam` | `device` должен быть строкой не длиннее 64 |

Ошибки валидации на уровне route возвращаются как `400` JSON с `code = VALIDATION_ERROR`. Ошибки бизнес-логики выбрасываются как `ApiError` и тоже отдаются JSON, если до редиректа не дошло.

## Business logic

Основная логика находится в `backend/src/services/tracking/clicks.service.js`.

| Файл / service | Ответственность |
| --- | --- |
| `prepareClick` | проверяет обязательные поля, находит оффер и партнёра, грузит GEO rules, делает access-check, строит target redirect URL и решение по destination |
| `findActiveOffer` | оффер должен существовать и иметь `status = active` |
| `findActiveAffiliate` | партнёр должен существовать и иметь `status = active` |
| `getPartnerOfferVisibilityState` + `canPartnerAccessOffer` | запрещает click, если оффер скрыт/недоступен партнёру |
| `resolveOfferGeoAccess` | определяет allow/deny по `countryCode`, `allowCountries`, `denyCountries`, `targetingStrict` |
| `resolveRedirectDecision` | выбирает target URL, `offer.fallbackUrl` или internal unavailable page |
| `generateClickId` | генерирует новый `clickId`, если он не передан извне |
| `buildClickDedupFingerprint` | строит fingerprint из `offerId`, `affiliateId`, `ip`, `userAgent`, `device`, `referer`, `sub1`..`sub5` |
| `isDuplicateClickProtectionEnabled` | включает dedupe только если `offers.allow_duplicate_clicks = false` и есть окно `duplicate_click_window_seconds` |
| `resolveDuplicateClick` | берёт `pg_advisory_xact_lock(hashtext(fingerprint))`, чистит просроченный registry entry, ищет active dedupe entry |
| `createClick` | создаёт `clicks` row; duplicate получает `is_duplicate = true`, `canonical_click_id` и `duplicate_of_click_id` |
| `publishClickCreatedJob` | enqueue `POSTBACK_EVENT` job с `type = click_created` для rollup |

Target URL берётся из `offers.target_url`. `buildRedirectUrl` подставляет `clickId` в target URL. Если клик deduplicated, redirect строится по canonical click:

- `destinationType = target`: target URL пересобирается с canonical `clickId`
- `destinationType = fallback`: используется `offers.fallback_url`
- `destinationType = internal_unavailable`: route собирает URL `/track/unavailable?reason=...`

Rate limit включён middleware `clickRateLimiter` из `backend/src/middleware/rateLimit.js`. Точные лимиты в этом документе не раскрываются, потому что конфиг надо уточнять в коде middleware.

## Database reads

| Таблица | Что читается | Зачем |
| --- | --- | --- |
| `offers` | `id`, `status`, `target_url`, `fallback_url`, `targeting_strict`, duplicate settings | определить доступность оффера, redirect и dedupe policy |
| `affiliates` | `id`, `status` | проверить существование и активность партнёра |
| `offer_affiliate_access` | TODO: уточнить точные поля через `offer-visibility.service` | access rules |
| `offer_affiliate_hidden` | TODO: уточнить точные поля через `offer-visibility.service` | скрытие оффера от партнёра |
| `offer_geo_rules` | allow/deny GEO sets | GEO targeting |
| `click_dedup_registry` | active entry по fingerprint | duplicate detection |
| `clicks` | canonical click по `click_id` | reuse canonical click при duplicate |

## Database writes

| Таблица | Что записывается / обновляется | Когда |
| --- | --- | --- |
| `clicks` | новый click row с `click_id`, `canonical_click_id`, `is_duplicate`, `dedupe_fingerprint`, `country_code`, `device`, `redirect_outcome`, `destination_type` и др. | всегда при успешной регистрации клика |
| `click_dedup_registry` | fingerprint -> canonical `click_id`, `expires_at` | только для не-duplicate click при включённой duplicate protection |
| `processed_async_events` | reservation event key для `click_created` | асинхронно в worker при rollup update |
| `daily_stats` | upsert click rollup | асинхронно через worker |

## Redis / cache / locks

Подтверждено два механизма:

1. Redis cache в `backend/src/services/tracking/hot-lookup.service.js`.
   Кэшируются `offer:<id>` и `affiliate:<id>` через `redisClient.get/setEx`.
   Если Redis недоступен, сервис логирует warning и падает обратно на прямой query в БД.

2. Dedupe lock не в Redis, а в PostgreSQL.
   `resolveDuplicateClick` использует `SELECT pg_advisory_xact_lock(hashtext($1))`.

В продуктовой схеме можно ожидать Redis-based dedupe, но в текущем коде подтверждён database-level registry `click_dedup_registry` плюс advisory lock.

## Queue / async events

После успешного non-duplicate click вызывается `publishClickCreatedJob`.

| Событие / очередь | Где создаётся | Кто обрабатывает | Что делает |
| --- | --- | --- | --- |
| `POSTBACK_EVENT` c payload `type = click_created` | `backend/src/services/tracking/clicks.service.js` | `backend/src/workers/registerJobs.js` через BullMQ worker | вызывает `updateClickRollup`, обновляет `daily_stats` за день клика |

Если queue отключена (`QUEUE_DISABLED=true` или `NODE_ENV=test`), `enqueueAsyncJob` возвращает `null`, и клик всё равно считается успешным.

## Statuses

В этом flow отдельные доменные статусы клика не используются. Но есть redirect/result поля:

| Статус / поле | Когда устанавливается | Что означает |
| --- | --- | --- |
| `redirect_outcome = allowed_target_redirect` | GEO/access разрешили target | редирект на `target_url` |
| `redirect_outcome = fallback_redirect` | strict GEO deny и есть `fallback_url` | редирект на fallback |
| `redirect_outcome = internal_unavailable_redirect` | strict GEO deny и `fallback_url` отсутствует | редирект на `/track/unavailable` |
| `is_duplicate = true` | dedupe сработал | запись есть, но canonical click reused |

## Error cases

| Ошибка / ситуация | Где возникает | Что происходит | Что проверить |
| --- | --- | --- | --- |
| `offerId`/`affiliateId` отсутствуют или не UUID | `validateTrackingQuery` | `400 VALIDATION_ERROR` | query string |
| оффер не найден | `findActiveOffer` | `404 NOT_FOUND` JSON | `offers.id` |
| партнёр не найден | `findActiveAffiliate` | `404 NOT_FOUND` JSON | `affiliates.id` |
| оффер не активен | `findActiveOffer` | `409 CONFLICT` | `offers.status` |
| партнёр не активен | `findActiveAffiliate` | `409 CONFLICT` | `affiliates.status` |
| нет доступа к офферу | `canPartnerAccessOffer` | `403 FORBIDDEN` | `offer_affiliate_access`, `offer_affiliate_hidden`, visibility rules |
| GEO запрещён и есть `fallbackUrl` | `resolveRedirectDecision` | `302` на fallback | `offers.fallback_url`, `offer_geo_rules` |
| GEO запрещён и fallback отсутствует | `resolveRedirectDecision` | `302` на `/track/unavailable` | `targeting_strict`, `fallback_url` |
| `targetUrl` не удаётся собрать | `buildRedirectUrl` | `500 INTERNAL_ERROR` | `offers.target_url` шаблон |
| duplicate click | `resolveDuplicateClick` | создаётся duplicate row, клиент уходит по canonical redirect | `click_dedup_registry`, `clicks.is_duplicate` |
| collision по `click_id` | insert `clicks` | `409 CONFLICT` | генератор `clickId`, уникальность |
| Redis недоступен | `hot-lookup.service.js` | cache отключается, flow идёт через БД | логи Redis warning |

## Idempotency / deduplication

Deduplication используется напрямую.

- fingerprint строится в `backend/src/lib/buildClickDedupFingerprint.js`
- состав fingerprint: `offerId`, `affiliateId`, `ip`, `userAgent`, `device`, `referer`, `sub1`, `sub2`, `sub3`, `sub4`, `sub5`
- fingerprint хэшируется `sha256`
- окно dedupe задаётся полем `offers.duplicate_click_window_seconds`
- duplicate protection работает только если `offers.allow_duplicate_clicks = false`
- canonical click id хранится в `clicks.canonical_click_id`
- duplicate rows получают `duplicate_of_click_id = canonical_click_id`
- registry хранится в `click_dedup_registry`

Повторный запрос не игнорируется полностью: создаётся новая запись в `clicks`, но redirect и stats опираются на canonical click. Async `click_created` публикуется только для non-duplicate click.

## Security / permissions

- Flow публичный, auth token не нужен.
- Запросы ограничиваются `clickRateLimiter`.
- Партнёр не может трекать скрытый/запрещённый оффер: это проверяется сервером через visibility/access services, а не доверием к `affiliateId` в query.
- Никаких ролей фронтенд не пробрасывает в tracking endpoint.

## Observability / debugging

- Логи route: `logInfo('track_click', ...)` в `backend/src/routes/tracking.routes.js`
- Метрики: `trackingClickRequestsCounter`, `trackingClickErrorsCounter`, `trackingClickDuplicatesCounter`, `geoRedirectFallbackCounter`
- Таблицы для проверки: `clicks`, `click_dedup_registry`, `daily_stats`
- Полезные поля в `clicks`: `click_id`, `canonical_click_id`, `is_duplicate`, `dedupe_fingerprint`, `country_code`, `redirect_outcome`, `redirect_reason`, `destination_type`, `source`
- Для async rollup: worker logs `click_rollup_job_started/completed/deduplicated`

## Tests

| Тест | Что проверяет |
| --- | --- |
| `backend/tests/integration/critical-path.test.js` | базовый tracking -> conversion path |
| `backend/tests/integration/offer-visibility-stage7.test.js` | доступность оффера для партнёров, влияет на click access checks |
| `backend/tests/integration/daily-stats-stage16.test.js` | попадание click/conversion в `daily_stats` |
| `backend/tests/integration/public-ids.test.js` | косвенно подтверждает публичные ID, используемые рядом с tracking UI |

TODO: уточнить наличие отдельного интеграционного теста именно для duplicate click и GEO fallback flow.

## Known limitations

- TODO: уточнить точные лимиты `clickRateLimiter`.
- В текущем коде dedupe реализован через PostgreSQL registry, а не через Redis lock/store.
- TODO: уточнить, должен ли duplicate click всегда создавать отдельную строку в `clicks` по продуктовым требованиям; код именно так и делает.
- TODO: flow не пишет отдельную audit/event таблицу кроме `processed_async_events` и stats rollup.

## Связанные разделы

- [../domains/tracking-clicks.md](../domains/tracking-clicks.md)
- [../domains/offers.md](../domains/offers.md)
- [../domains/offer-access.md](../domains/offer-access.md)
- [../domains/geo-targeting.md](../domains/geo-targeting.md)
- [../domains/stats.md](../domains/stats.md)
- [../api/tracking.md](../api/tracking.md)
- [stats-rollup-flow.md](./stats-rollup-flow.md)
