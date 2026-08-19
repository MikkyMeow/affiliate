# Финансы

Статус: draft

## Назначение

Домен описывает payout/revenue на уровне goal/conversion/stats, advertiser finance summary и влияние статусов/adjustments на финансовые агрегаты.

## Основные пользовательские сценарии

- admin настраивает revenue/payout в goals и affiliate-specific overrides;
- postback создаёт conversion со snapshot `revenue_amount/payout_amount`;
- advertiser смотрит finance summary и breakdowns;
- admin/manager анализирует finance через общие stats/conversions;
- manual adjustments создают manual conversions/clicks, влияющие на revenue/payout после rollup.

## Frontend files

| Файл / папка | Назначение |
|---|---|
| `frontend/src/app/advertiser/finance/page.tsx` | advertiser finance UI |
| `frontend/src/app/dashboard/conversions/page.tsx` | admin finance-visible conversion list |
| `frontend/src/app/dashboard/stats/page.tsx` | admin summary с revenue/payout |
| `frontend/src/app/dashboard/offers/[id]/edit/OfferGoalsSection.tsx` | настройка revenue/payout и overrides |
| `frontend/src/lib/advertiser.api.ts` | advertiser finance API client |
| `frontend/src/lib/admin-stats.ts` | admin stats summary values |
| `frontend/src/lib/admin-lists.ts` | conversions list with revenue/payout filters |
| `frontend/src/lib/offers.ts` | goal finance CRUD |
| `frontend/src/lib/adjustments.ts` | manual adjustment preview/apply affecting finance |

## Backend routes

| Route / файл | Назначение | Роли |
|---|---|---|
| `GET /api/v1/advertiser/finance/summary` (`backend/src/routes/advertiser-finance.routes.js`) | advertiser finance summary | `advertiser` |
| `GET /api/v1/advertiser/finance/breakdowns` (`backend/src/routes/advertiser-finance.routes.js`) | advertiser finance breakdowns | `advertiser` |
| `GET /api/v1/conversions` (`backend/src/routes/conversions.routes.js`) | admin raw conversions with payout/revenue | `admin`, `manager` |
| `PATCH /api/v1/conversions/:conversionId/status` (`backend/src/routes/conversions.routes.js`) | статус меняет finance buckets | `admin`, `manager` |
| `POST /api/v1/admin/adjustments/preview|:batchId/apply` (`backend/src/routes/admin-adjustments.routes.js`) | manual finance-affecting adjustments | `admin`, `manager` |
| `POST|PATCH /api/v1/admin/offers/:offerId/goals...` (`backend/src/routes/admin-offer-goals.routes.js`) | настройка payout/revenue и overrides | `admin`, `manager` |

## Validators

| Файл / схема | Что валидирует |
|---|---|
| `backend/src/validators/advertiserFinance.js` | advertiser finance filters |
| `backend/src/validators/offerGoals.js` | revenue/payout rules в goals |
| `backend/src/validators/stats.js#validateConversionsListFilters` | admin finance-related filters |
| `backend/src/validators/adjustments.js` | adjustment payloads, влияющие на finance |

## Services

| Service / файл | Ответственность |
|---|---|
| `backend/src/services/advertisers/advertiser-finance.service.js` | finance summary/breakdowns для advertiser |
| `backend/src/services/offer-goals.service.js` | source of revenue/payout config and overrides |
| `backend/src/services/postback/conversions.service.js` | conversion snapshot creation |
| `backend/src/services/conversions.service.js` | status changes and rollup impact |
| `backend/src/services/adjustments.service.js` | manual finance-affecting imports |
| `backend/src/services/stats/stats.service.js` | admin aggregation of revenue/payout |

## Models / repositories

| Model / repository / файл | Ответственность |
|---|---|
| `backend/src/models/offerGoals.model.js` | default revenue/payout per goal |
| `backend/src/models/offerGoalAffiliateRates.model.js` | affiliate-specific rates |
| `backend/src/models/conversions.model.js` | revenue/payout snapshots and status |
| `backend/src/models/stats-aggregator.model.js` | finance rollups by offer/status |
| `backend/src/models/daily-stats.model.js` | persisted aggregates |

## Database tables

| Таблица | Назначение | Важные связи |
|---|---|---|
| `offer_goals` | базовая финансовая конфигурация | `revenue`, `payout`, `currency`, `limit_*` |
| `offer_goal_affiliate_rates` | индивидуальные финусловия для affiliate | `revenue`, `payout` |
| `conversions` | финансовый snapshot факта | `revenue_amount`, `payout_amount`, `status`, `source`, `is_test` |
| `daily_stats` | агрегированные totals | approved/pending/rejected/cancelled payout/revenue totals |
| `manual_adjustment_batches` | batch source для manual finance records | links from conversions/clicks |

## Main data flow

```txt
Goal config
  -> offer-goals service
  -> offer_goals / affiliate overrides

Postback/manual import
  -> resolve goal + effective rate
  -> create conversion with payout/revenue snapshot
  -> status bucket assigned
  -> stats aggregation / daily_stats
  -> advertiser finance summary and admin reports
```

## Permissions / roles

- advertiser видит только финансы по своим offers через ownership filters.
- admin и manager видят финансы через conversions/stats/admin reports.
- affiliate отдельного finance endpoint не имеет; для него payout виден в partner conversions/stats.

## Edge cases

- payout/revenue mismatch в goal config -> validation error, если payout > revenue;
- currency mismatch -> фактически не поддерживается, только `RUB`;
- pending conversion counted incorrectly -> depends on stats rollup/live aggregation, проверять status buckets;
- rejected/cancelled conversion included incorrectly -> отдельные buckets в Stage 15/16;
- manual adjustment affects finance -> да, через manual conversions и rollup;
- missing goal rate -> используется default goal rate;
- advertiser and affiliate totals can differ по статусным/ownership/visibility разрезам и из-за test/manual records.

## Known limitations

- Отдельного billing/payments/invoices домена в коде не найдено.
- Finance реализован в основном через `conversions` snapshot и агрегаты `stats`; отдельной ledger/table выплат нет.
- Multi-currency не реализована.

## Tests

| Тест | Что проверяет |
|---|---|
| `backend/tests/integration/advertiser-finance.test.js` | advertiser finance summary/breakdowns |
| `backend/tests/integration/offer-goals-stage8.test.js` | revenue/payout constraints and overrides |
| `backend/tests/integration/postback-goal-awareness-stage8_1.test.js` | conversion financial snapshots |
| `backend/tests/integration/conversion-status-stage15.test.js` | status impact on finance buckets |
| `backend/tests/integration/admin-adjustments-stage14.test.js` | manual finance-affecting imports |
| `backend/tests/integration/daily-stats-stage16.test.js` | rollup totals by status/source |

## Связанные разделы

- [Offer Goals](./offer-goals.md)
- [Postbacks and Conversions](./postbacks-conversions.md)
- [Adjustments](./adjustments.md)
- [Stats](./stats.md)
