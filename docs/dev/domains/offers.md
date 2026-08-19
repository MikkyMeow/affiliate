# Офферы

Статус: draft

## Назначение

Домен описывает offer entity, admin CRUD, advertiser read-only view, partner visibility, target/fallback URLs, category, description, duplicate click settings и связи с goals/access/GEO/tracking/postbacks.

## Основные пользовательские сценарии

- администратор создаёт оффер;
- admin/manager редактирует offer status, availability, URLs, category, description и dedupe settings;
- admin/manager смотрит offer detail вместе с advertiser, goals и postback token;
- advertiser смотрит только свои offers;
- affiliate видит список доступных/ограниченных offers и detail карточку;
- tracking использует offer как основной объект разрешения redirect и postback ownership.

## Frontend files

| Файл / папка | Назначение |
|---|---|
| `frontend/src/app/dashboard/offers/page.tsx` | admin/manager список offers |
| `frontend/src/app/dashboard/offers/create/page.tsx` | создание offer |
| `frontend/src/app/dashboard/offers/[id]/edit/page.tsx` | редактирование offer и секции management |
| `frontend/src/app/dashboard/offers/[id]/edit/OfferPostbackSection.tsx` | postback token/examples в offer UI |
| `frontend/src/app/dashboard/offers/[id]/edit/OfferGoalsSection.tsx` | goals management UI |
| `frontend/src/app/dashboard/offers/[id]/edit/OfferGeoTargetingSection.tsx` | geo targeting UI |
| `frontend/src/app/dashboard/offers/[id]/edit/OfferStatsSection.tsx` | stats summary for offer |
| `frontend/src/app/dashboard/offers/components/DuplicateClickSettings.tsx` | duplicate click protection inputs |
| `frontend/src/app/partner/offers/[offerId]/page.tsx` | partner detail view offer |
| `frontend/src/app/advertiser/offers/page.tsx` | advertiser offer list |
| `frontend/src/app/advertiser/offers/[offerId]/page.tsx` | advertiser offer detail |
| `frontend/src/lib/offers.ts` | admin offer/goals/access/geo API client |
| `frontend/src/lib/partnerOffers.ts` | partner offer API client |
| `frontend/src/lib/advertiser.api.ts` | advertiser offer API client |

## Backend routes

| Route / файл | Назначение | Роли |
|---|---|---|
| `POST /api/v1/offers` (`backend/src/routes/offers.routes.js`) | создать offer | `admin`, `manager` |
| `GET /api/v1/offers` (`backend/src/routes/offers.routes.js`) | admin list offers | `admin`, `manager` |
| `GET /api/v1/offers/:id` (`backend/src/routes/offers.routes.js`) | admin detail offer | `admin`, `manager` |
| `PATCH /api/v1/offers/:id` (`backend/src/routes/offers.routes.js`) | update offer | `admin`, `manager` |
| `GET /api/v1/partner/offers` (`backend/src/routes/partner.routes.js`) | partner list visible offers | `affiliate` |
| `GET /api/v1/partner/offers/:id` (`backend/src/routes/partner.routes.js`) | partner offer detail / restricted view | `affiliate` |
| `GET /api/v1/advertiser/offers` (`backend/src/routes/advertiser-offers.routes.js`) | advertiser list own offers | `advertiser` |
| `GET /api/v1/advertiser/offers/:offerId` (`backend/src/routes/advertiser-offers.routes.js`) | advertiser detail own offer | `advertiser` |
| `GET /api/v1/stats/offers/:id` (`backend/src/routes/stats.routes.js`) | offer stats for admin area | `admin`, `manager` |

## Validators

| Файл / схема | Что валидирует |
|---|---|
| `backend/src/validators/offers.js#validateCreateOfferDto` | создание offer |
| `backend/src/validators/offers.js#validateUpdateOfferDto` | update offer |
| `backend/src/validators/offers.js#validateOfferFilters` | admin list filters |
| `backend/src/validators/offers.js#validateOfferCategory` | category query для partner list |
| `backend/src/validators/offers.js#validateUuid` | offerId и связанные UUID |
| `backend/src/validators/advertiserOffers.js` | advertiser offer list filters |

## Services

| Service / файл | Ответственность |
|---|---|
| `backend/src/services/offers.service.js` | create/list/get/update offer, audit, category/URL validation |
| `backend/src/services/offer-visibility.service.js` | вычисление visibility/access state для affiliate |
| `backend/src/services/offers/affiliate-visibility.js` | финальное решение `none/restricted/full` |
| `backend/src/services/advertisers/advertiser-offers.service.js` | advertiser ownership-aware offer list/detail |
| `backend/src/services/tracking/hot-lookup.service.js` | быстрый lookup offer для tracking |
| `backend/src/services/tracking/cache-invalidation.service.js` | сброс cache после update |

## Models / repositories

| Model / repository / файл | Ответственность |
|---|---|
| `backend/src/models/offers.model.js` | основная offer persistence и query filters |
| `backend/src/models/advertiserModel.js` | advertiser existence/ownership |
| `backend/src/models/offerGoals.model.js` | goals offer detail |
| `backend/src/models/offerAffiliateAccess.model.js` | allow/reject/exclude visibility rules |
| `backend/src/models/offerAffiliateHidden.model.js` | hidden affiliates |
| `backend/src/models/offerRequests.model.js` | pending request state |
| `backend/src/models/offerGeoRules.model.js` | GEO allow/deny rules |

## Database tables

| Таблица | Назначение | Важные связи |
|---|---|---|
| `offers` | основная сущность offer | `advertiser_id`, `target_url`, `status`, `visibility_mode`, `targeting_strict`, `fallback_url`, `preview_url`, `category`, `description`, `postback_token`, dedupe fields |
| `advertisers` | владелец оффера | `offers.advertiser_id -> advertisers.id` |
| `offer_goals` | цели offer | `offer_id -> offers.id` |
| `offer_affiliate_access` | ручные доступы | `offer_id + affiliate_id unique` |
| `offer_affiliate_hidden` | скрытые для affiliate офферы | `offer_id + affiliate_id unique` |
| `offer_requests` | запросы доступа | `offer_id + affiliate_id`, pending unique |
| `offer_geo_rules` | GEO policy | `offer_id`, `rule_type`, `country_code` |
| `click_dedup_registry` | реестр дедупликации кликов | связан с dedupe settings оффера |

## Main data flow

```txt
Admin offer form
  -> POST/PATCH /api/v1/offers
  -> validateCreateOfferDto / validateUpdateOfferDto
  -> offers.service
  -> advertiser existence check
  -> offers.model
  -> offers table
  -> audit_events

Partner offer list/detail
  -> /api/v1/partner/offers
  -> partner.service
  -> offer-visibility.service
  -> offer access/hidden/request state
  -> restricted or full offer response
```

## Permissions / roles

- `admin` и `manager` имеют полный admin CRUD по offers.
- `advertiser` видит только offers со своим `advertiser_id` и только read-only endpoints.
- `affiliate` видит только offers, которые разрешены visibility/access rules; для `on_request` возможен restricted view.
- Проверки ownership и видимости происходят в `advertiser-context.service.js`, `offer-visibility.service.js`, `affiliate-visibility.js`.

## Edge cases

- offer not found -> 404;
- offer inactive -> tracking блокируется, partner detail может существовать, но продуктово зависит от visibility state;
- missing/invalid `targetUrl` -> validation error;
- invalid category -> validation error;
- invalid availability/visibilityMode -> validation error;
- private offer без access для affiliate -> partner detail 404;
- on-request offer без доступа -> restricted detail и запрет tracking;
- offer с пустыми goals допустим на уровне entity, но может быть проблемой для postback/conversion. TODO: уточнить обязательность active/default goal по продукту;
- duplicate click settings включаются только если `allowDuplicateClicks === false` и окно валидно.

## Known limitations

- В коде нет отдельного slug/permalink для offers; основной идентификатор UUID/public ID.
- Advertiser self routes только читают offers; editing в advertiser cabinet не реализован.
- Поле `trackingType` встречается в advertiser view mapping, но не подтверждено как часть основной схемы offer. TODO: уточнить происхождение поля.

## Tests

| Тест | Что проверяет |
|---|---|
| `backend/tests/integration/offer-visibility-stage7.test.js` | admin/manager update availability, partner visibility, private/on_request flows |
| `backend/tests/integration/offer-goals-stage8.test.js` | отсутствие `payout_rub`, goal-aware offer detail |
| `backend/tests/integration/advertiser-offers.test.js` | advertiser ownership list/detail |
| `backend/tests/integration/public-ids.test.js` | public IDs на offer/affiliate/advertiser |
| `backend/tests/integration/critical-path.test.js` | использование offer в click/postback flow |

## Связанные разделы

- [Offer Goals](./offer-goals.md)
- [Offer Access](./offer-access.md)
- [Geo Targeting](./geo-targeting.md)
- [Tracking Clicks](./tracking-clicks.md)
- [Postbacks and Conversions](./postbacks-conversions.md)
