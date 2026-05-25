# Цели оффера

Статус: draft

## Назначение

Домен описывает `offer_goals`, финансовую модель `revenue/payout/currency`, default goal, goal limits и affiliate-specific rate overrides для конкретных goals.

## Основные пользовательские сценарии

- admin/manager создаёт goal для offer;
- admin/manager меняет payout/revenue/default/limit settings;
- admin/manager настраивает индивидуальные ставки для affiliate по goal;
- partner получает payout-safe список goals без revenue;
- postback резолвит goal и сохраняет snapshot в conversion.

## Frontend files

| Файл / папка | Назначение |
|---|---|
| `frontend/src/app/dashboard/offers/[id]/edit/OfferGoalsSection.tsx` | CRUD goals и affiliate rates |
| `frontend/src/lib/offers.ts` | fetch/create/update goals, affiliate rates |
| `frontend/src/lib/partnerOffers.ts` | partner goal payload без revenue |

## Backend routes

| Route / файл | Назначение | Роли |
|---|---|---|
| `GET /api/v1/admin/offers/:offerId/goals` (`backend/src/routes/admin-offer-goals.routes.js`) | список goals оффера | `admin`, `manager` |
| `POST /api/v1/admin/offers/:offerId/goals` (`backend/src/routes/admin-offer-goals.routes.js`) | создать goal | `admin`, `manager` |
| `PATCH /api/v1/admin/offers/:offerId/goals/:goalId` (`backend/src/routes/admin-offer-goals.routes.js`) | update goal | `admin`, `manager` |
| `GET /api/v1/admin/offers/:offerId/goals/:goalId/affiliate-rates` (`backend/src/routes/admin-offer-goals.routes.js`) | список affiliate overrides | `admin`, `manager` |
| `PUT /api/v1/admin/offers/:offerId/goals/:goalId/affiliate-rates/:affiliateId` (`backend/src/routes/admin-offer-goals.routes.js`) | upsert override | `admin`, `manager` |
| `DELETE /api/v1/admin/offers/:offerId/goals/:goalId/affiliate-rates/:affiliateId` (`backend/src/routes/admin-offer-goals.routes.js`) | удалить override | `admin`, `manager` |

## Validators

| Файл / схема | Что валидирует |
|---|---|
| `backend/src/validators/offerGoals.js#validateCreateOfferGoalPayload` | create goal |
| `backend/src/validators/offerGoals.js#validateUpdateOfferGoalPayload` | update goal |
| `backend/src/validators/offerGoals.js#validateUpsertOfferGoalAffiliateRatePayload` | override revenue/payout |
| `backend/src/validators/offers.js#validateUuid` | offerId/goalId/affiliateId |

## Services

| Service / файл | Ответственность |
|---|---|
| `backend/src/services/offer-goals.service.js` | create/list/update goals, limit logic, rate overrides, conversion creation with resolved goal |
| `backend/src/services/postback/conversions.service.js` | вызывает goal-aware conversion create |
| `backend/src/services/partner.service.js` | отдаёт partner-safe goals |

## Models / repositories

| Model / repository / файл | Ответственность |
|---|---|
| `backend/src/models/offerGoals.model.js` | CRUD/select goals |
| `backend/src/models/offerGoalAffiliateRates.model.js` | override storage |
| `backend/src/models/conversions.model.js` | limit counts, uniqueness by click/goal/externalTransactionId |
| `backend/src/models/affiliateModel.js` | existence check affiliate for rate override |

## Database tables

| Таблица | Назначение | Важные связи |
|---|---|---|
| `offer_goals` | goals of offer | `offer_id -> offers.id`, `is_default`, `revenue`, `payout`, `currency`, `limit_*` |
| `offer_goal_affiliate_rates` | per-affiliate rate overrides | `offer_goal_id -> offer_goals.id`, `affiliate_id -> affiliates.id`, unique pair |
| `conversions` | goal snapshot at conversion time | `goal_id`, `goal_name`, `goal_type`, `revenue_amount`, `payout_amount` |
| `clicks` | manual adjustments may reference goal | `goal_id` |
| `daily_stats` | rollup by goal | `goal_id` |

## Main data flow

```txt
Admin goal UI
  -> /api/v1/admin/offers/:offerId/goals
  -> offerGoals validators
  -> offer-goals.service
  -> offerGoals / offerGoalAffiliateRates models
  -> offer_goals / offer_goal_affiliate_rates tables

Postback
  -> registerConversion
  -> createConversionWithResolvedGoal
  -> goal lookup + affiliate-specific rate resolution
  -> conversions insert with goal snapshot
```

## Permissions / roles

- goal management доступен только `admin` и `manager`.
- partner не видит revenue, только effective payout/currency/default/limitReached.
- advertiser self routes не управляют goals.
- Affiliate-specific override применяется в partner UI и при conversion creation.

## Edge cases

- goal не найден или не принадлежит offer -> `GOAL_NOT_FOUND_FOR_OFFER`;
- goal required для offer-aware postback -> `GOAL_REQUIRED`;
- payout > revenue -> validation error;
- currency mismatch -> validator/service ждут `RUB`; иное значение не подтверждено как поддержанное;
- несколько default goals запрещены partial unique index;
- limit reached -> `GOAL_LIMIT_REACHED`;
- override для несуществующего affiliate -> 404;
- postback с неизвестной goal -> rejected/goal error в postback logs.

## Known limitations

- Currency фактически зафиксирована на `RUB` constraint-ом; мультивалютность не реализована.
- В UI и API нет отдельного soft-disable goal, после Stage 8 поле `is_active` удалено.
- Логика payment model ограничена типами `cpl/cpa/cpc`; иных моделей в коде нет.

## Tests

| Тест | Что проверяет |
|---|---|
| `backend/tests/integration/offer-goals-stage8.test.js` | новая goal schema, create/update, overrides, partner-safe responses |
| `backend/tests/integration/postback-goal-awareness-stage8_1.test.js` | goal-aware postbacks, uniqueness, external transaction id |
| `backend/tests/integration/critical-path.test.js` | goal usage in tracking/postback flow |

## Связанные разделы

- [Offers](./offers.md)
- [Postbacks and Conversions](./postbacks-conversions.md)
- [Finance](./finance.md)
