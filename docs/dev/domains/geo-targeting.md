# GEO таргетинг

Статус: draft

## Назначение

Домен описывает GEO rules offer-а, strict/fallback redirect behavior и country resolution для tracking.

## Основные пользовательские сценарии

- admin/manager добавляет allow/deny country rule к offer;
- admin/manager включает `targetingStrict`;
- tracking определяет страну запроса и решает, вести на `target_url`, `fallback_url` или internal unavailable;
- partner click блокируется/редиректится в зависимости от country и strict mode.

## Frontend files

| Файл / папка | Назначение |
|---|---|
| `frontend/src/app/dashboard/offers/[id]/edit/OfferGeoTargetingSection.tsx` | UI для geo rules и `targetingStrict` |
| `frontend/src/lib/offers.ts` | fetch/create/delete geo rules, patch targeting |
| `frontend/src/lib/countries.ts` | frontend country labels/utilities |

## Backend routes

| Route / файл | Назначение | Роли |
|---|---|---|
| `GET /api/v1/admin/offers/:offerId/geo-rules` (`backend/src/routes/admin-offer-geo-targeting.routes.js`) | list geo rules | `admin`, `manager` |
| `POST /api/v1/admin/offers/:offerId/geo-rules` (`backend/src/routes/admin-offer-geo-targeting.routes.js`) | create rule | `admin`, `manager` |
| `DELETE /api/v1/admin/offers/:offerId/geo-rules/:ruleId` (`backend/src/routes/admin-offer-geo-targeting.routes.js`) | delete rule | `admin`, `manager` |
| `PATCH /api/v1/admin/offers/:offerId/targeting` (`backend/src/routes/admin-offer-geo-targeting.routes.js`) | update `targetingStrict` | `admin`, `manager` |
| `GET /track/click` (`backend/src/routes/tracking.routes.js`) | применяет geo access при click redirect | публичный |

## Validators

| Файл / схема | Что валидирует |
|---|---|
| `backend/src/validators/offerGeoRules.js#validateCreateOfferGeoRulePayload` | `ruleType`, `countryCode` |
| `backend/src/validators/offerGeoRules.js#validateOfferTargetingStrictPayload` | boolean `targetingStrict` |
| `backend/src/validators/offers.js#validateUuid` | offerId/ruleId |
| `backend/src/validators/tracking.js#validateTrackingQuery` | tracking query, включая country-related input payload |

## Services

| Service / файл | Ответственность |
|---|---|
| `backend/src/services/offer-geo-rules.service.js` | create/list/remove geo rules |
| `backend/src/services/offers.service.js` | patch `targetingStrict` on offer |
| `backend/src/services/tracking/clicks.service.js` | resolve geo access и redirect decision |
| `backend/src/lib/resolveOfferGeoAccess.js` | core GEO allow/deny algorithm |
| `backend/src/lib/detectRequestCountry.js` | detection source for request country |

## Models / repositories

| Model / repository / файл | Ответственность |
|---|---|
| `backend/src/models/offerGeoRules.model.js` | rules storage/query, allow/deny sets |
| `backend/src/models/offers.model.js` | `targeting_strict`, `fallback_url` |

## Database tables

| Таблица | Назначение | Важные связи |
|---|---|---|
| `offer_geo_rules` | GEO allow/deny rules | `offer_id`, `rule_type`, `country_code` |
| `offers` | strict/fallback settings | `targeting_strict`, `fallback_url` |
| `clicks` | сохраняет `country_code` и redirect outcome/result | связь с отладкой GEO |

## Main data flow

```txt
Offer geo settings UI
  -> /api/v1/admin/offers/:offerId/geo-rules or /targeting
  -> geo validators
  -> geo rules service / offers.service
  -> offer_geo_rules / offers tables

Tracking click
  -> detectRequestCountry(req)
  -> offerGeoRules.model.getOfferGeoRuleSets
  -> resolveOfferGeoAccess
  -> strict? yes -> target / fallback / internal unavailable
  -> create click with country_code + redirect outcome
```

## Permissions / roles

- Только `admin` и `manager` управляют GEO rules.
- GEO checks не зависят от advertiser/affiliate roles после начала tracking request: они применяются к resolved offer.
- Partner UI напрямую не проверяет GEO, это делается в tracking route.

## Edge cases

- country unknown -> при strict mode denyReason `unknown_country`, fallback/internal unavailable;
- country not allowed -> fallback/internal unavailable;
- fallback URL missing -> internal unavailable redirect;
- invalid country code -> validation error при create rule;
- conflicting geo rules (allow и deny на одну страну) -> TODO: уточнить приоритет по коду сервиса/модели;
- tracking click может сохраниться и уйти на fallback вместо target при strict deny.

## Known limitations

- Отдельного frontend/UI для просмотра GEO outcome в partner/advertiser кабинетах нет.
- Поведение конфликта allow/deny правил нужно уточнять по реализации `resolveOfferGeoAccess`; в документации не фиксируется без прямого подтверждения. TODO: уточнить.
- Country detection source зависит от `detectRequestCountry.js`; точный провайдер/IP DB надо смотреть отдельно.

## Tests

| Тест | Что проверяет |
|---|---|
| `backend/tests/integration/critical-path.test.js` | geo-aware tracking flow на основном пути |
| `backend/tests/integration/offer-visibility-stage7.test.js` | косвенно подтверждает блокировки tracking при недоступности |

## Связанные разделы

- [Offers](./offers.md)
- [Tracking Clicks](./tracking-clicks.md)
