# Статистика

Статус: draft

## Назначение

Домен описывает dashboard/reporting поверх raw clicks/conversions и `daily_stats`, включая admin summary, advertiser stats, partner stats и ручной daily rollup recalculation.

## Основные пользовательские сценарии

- admin/manager смотрит dashboard и summary отчёты;
- admin/manager фильтрует клики и конверсии списками;
- admin/manager пересчитывает `daily_stats` за диапазон дат;
- affiliate смотрит summary stats в partner cabinet;
- advertiser смотрит summary/breakdowns по своим офферам;
- finance и reports берут агрегаты из тех же stats services.

## Frontend files

| Файл / папка | Назначение |
|---|---|
| `frontend/src/app/dashboard/page.tsx` | admin dashboard |
| `frontend/src/app/dashboard/DashboardMainPageContent.tsx` | dashboard widgets |
| `frontend/src/app/dashboard/stats/page.tsx` | admin stats summary/report |
| `frontend/src/app/dashboard/clicks/page.tsx` | admin click list |
| `frontend/src/app/dashboard/conversions/page.tsx` | admin conversion list |
| `frontend/src/app/partner/stats/page.tsx` | partner stats |
| `frontend/src/app/advertiser/stats/page.tsx` | advertiser stats |
| `frontend/src/lib/dashboard.ts` | admin dashboard client |
| `frontend/src/lib/admin-stats.ts` | admin summary/breakdowns/recalculate client |
| `frontend/src/lib/admin-lists.ts` | admin clicks/conversions list client |
| `frontend/src/lib/stats.ts` | partner stats helper |
| `frontend/src/lib/partner.ts` | partner stats/clicks/conversions client |
| `frontend/src/lib/advertiser.api.ts` | advertiser stats client |

## Backend routes

| Route / файл | Назначение | Роли |
|---|---|---|
| `GET /api/v1/admin/stats/dashboard` (`backend/src/routes/admin-stats.routes.js`) | dashboard cards + timeseries | `admin`, `manager` |
| `GET /api/v1/admin/stats/summary` (`backend/src/routes/admin-stats.routes.js`) | admin grouped summary | `admin`, `manager` |
| `POST /api/v1/admin/stats/recalculate` (`backend/src/routes/admin-stats.routes.js`) | daily rollup recalculation | `admin`, `manager` |
| `GET /api/v1/admin/stats/totals` (`backend/src/routes/admin-stats.routes.js`) | legacy/global totals | `admin`, `manager` |
| `GET /api/v1/stats/summary|breakdowns|offers/:id|daily-summary` (`backend/src/routes/stats.routes.js`) | admin-area stats API | `admin`, `manager` |
| `GET /api/v1/clicks` (`backend/src/routes/clicks.routes.js`) | admin raw click list | `admin`, `manager` |
| `GET /api/v1/conversions` (`backend/src/routes/conversions.routes.js`) | admin raw conversion list | `admin`, `manager` |
| `GET /api/v1/partner/stats` (`backend/src/routes/partner.routes.js`) | partner summary | `affiliate` |
| `GET /api/v1/advertiser/stats/summary|breakdowns|offers/:offerId` (`backend/src/routes/advertiser-stats.routes.js`) | advertiser stats | `advertiser` |

## Validators

| Файл / схема | Что валидирует |
|---|---|
| `backend/src/validators/stats.js#validateDashboardStatsQuery` | admin dashboard filters |
| `backend/src/validators/stats.js#validateAdminStatsSummaryQuery` | admin summary query |
| `backend/src/validators/stats.js#validateStatsRecalculationPayload` | date range + timezone recalc |
| `backend/src/validators/stats.js#validateStatsSummaryFilters` | `/stats/summary` and `/breakdowns` |
| `backend/src/validators/stats.js#validateDailySummaryFilters` | `/stats/daily-summary` |
| `backend/src/validators/stats.js#validateClicksListFilters` | admin click filters |
| `backend/src/validators/stats.js#validateConversionsListFilters` | admin conversion filters |
| `backend/src/validators/stats.js#validatePartnerClicksQuery` | partner clicks |
| `backend/src/validators/stats.js#validatePartnerConversionsQuery` | partner conversions |
| `backend/src/validators/stats.js#validateAdvertiserStatsFilters` | advertiser summary/breakdowns |
| `backend/src/validators/stats.js#validateAdvertiserOfferStatsFilters` | advertiser offer stats |

## Services

| Service / файл | Ответственность |
|---|---|
| `backend/src/services/stats/stats.service.js` | admin summary/breakdowns, click/conversion lists, partner stats |
| `backend/src/services/stats/rollup.service.js` | recompute `daily_stats` for date range/timezone |
| `backend/src/services/advertisers/advertiser-stats.service.js` | advertiser summary/breakdowns |
| `backend/src/services/advertisers/advertiser-finance.service.js` | finance view over same stats aggregations |
| `backend/src/services/conversions.service.js` | updates rollup after status changes |

## Models / repositories

| Model / repository / файл | Ответственность |
|---|---|
| `backend/src/models/daily-stats.model.js` | read/write rollup rows |
| `backend/src/models/stats-aggregator.model.js` | aggregated summary/breakdown queries |
| `backend/src/models/admin-dashboard.model.js` | dashboard query layer |
| `backend/src/models/admin-stats-summary.model.js` | admin grouped summary query layer |
| `backend/src/models/clicks.model.js` | raw click list |
| `backend/src/models/conversions.model.js` | raw conversion list |

## Database tables

| Таблица | Назначение | Важные связи |
|---|---|---|
| `daily_stats` | materialized daily rollup | `date`, `timezone`, `offer_id`, `affiliate_id`, `advertiser_id`, `goal_id`, counts and payout/revenue totals |
| `clicks` | raw source for click metrics | `source`, `created_at`, `country_code`, `redirect_outcome` |
| `conversions` | raw source for conversion/finance metrics | `status`, `source`, `is_test`, `goal_id`, payout/revenue |
| `offers` | titles and advertiser mapping in breakdowns | joins for labels |
| `affiliates` | partner labels | joins for labels |
| `advertisers` | advertiser labels | joins for labels |

## Main data flow

```txt
Raw click/conversion data
  -> stats.service / stats-aggregator.model
  -> live aggregation for lists/summaries
  -> or rollup.service recalculates daily_stats
  -> API response
  -> dashboard/report UI
```

## Permissions / roles

- admin и manager имеют доступ к full admin reporting.
- advertiser видит только свои aggregates через advertiser context filter.
- affiliate видит только собственную summary/list data через partner routes.
- `requireQuestionnaireCompletion` стоит на partner/advertiser stats routes.

## Edge cases

- delayed stats: raw clicks/conversions могут уже существовать, а `daily_stats` быть не пересчитанными;
- timezone boundaries: rollup хранит `timezone`, поэтому один и тот же UTC период может давать разные даты;
- pending/rejected/approved/cancelled считаются отдельно;
- manual/test conversions учитываются отдельными колонками в Stage 16;
- stats mismatch after adjustment/status change требует recalculation;
- visibility by role различается: admin raw lists без ownership limits, advertiser/partner with ownership filters.

## Known limitations

- В проекте одновременно есть live aggregation и `daily_stats`; при расхождении нужно понимать, какой endpoint что использует.
- Нет отдельного async scheduler в этой документации, хотя есть `run-daily-rollup.js` и worker infrastructure. TODO: уточнить production trigger rollup job.
- Не все frontend страницы явно показывают `statsUpdatedAt`, хотя API местами его возвращает.

## Tests

| Тест | Что проверяет |
|---|---|
| `backend/tests/integration/admin-dashboard-stage11.test.js` | admin dashboard |
| `backend/tests/integration/admin-summary-stage13.test.js` | grouped summary |
| `backend/tests/integration/admin-list-filters-stage12.test.js` | click/conversion filters |
| `backend/tests/integration/daily-stats-stage16.test.js` | extended daily_stats and recalculation |
| `backend/tests/integration/advertiser-stats.test.js` | advertiser stats |
| `backend/tests/integration/advertiser-finance.test.js` | finance over stats |
| `backend/tests/integration/critical-path.test.js` | raw data feeding stats |
| `backend/tests/integration/admin-adjustments-stage14.test.js` | adjustments impact on lists/stats |

## Связанные разделы

- [Tracking Clicks](./tracking-clicks.md)
- [Postbacks and Conversions](./postbacks-conversions.md)
- [Adjustments](./adjustments.md)
- [Finance](./finance.md)
- [Stats Rollup Flow](../data-flow/stats-rollup-flow.md)
