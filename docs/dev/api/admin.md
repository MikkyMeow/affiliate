# Admin API

Статус: draft

## Назначение

Admin API покрывает внутренний кабинет платформы: dashboard/stats, CRUD и листинги сущностей, offer access и GEO targeting, conversion moderation, adjustments, questionnaires, audit logs и postback logs.

## Base path

- Общий base path для admin area: `/api/v1`
- Явно admin-prefixed группы:
  - `/api/v1/admin/stats`
  - `/api/v1/admin/offer-requests`
  - `/api/v1/admin/offers/...`
  - `/api/v1/admin/managers`
  - `/api/v1/admin/adjustments`
  - `/api/v1/admin/postback-logs`
  - `/api/v1/admin/questionnaires`
  - `/api/v1/admin/audit-logs`

## Response format

Успешные ответы используют общий envelope:

```json
{
  "success": true,
  "data": {},
  "meta": null
}
```

Листинги часто используют `meta` с `total`, `limit`, `offset`, `page`, `totalPages`.

## Auth / permissions

- Почти весь admin API требует `Authorization: Bearer <token>`.
- Основная зона admin area доступна ролям `admin`, `manager` через `authorizeAdminArea`.
- Только `admin` может:
  - создавать advertisers;
  - reset advertiser password;
  - управлять managers CRUD;
  - управлять questionnaires.
- Ownership checks для manager-specific scope происходят в service layer. `TODO: уточнить все места, где manager видит только назначенные сущности`.

## Endpoint map

### Dashboard

| Method | Path | Roles | Frontend page | Route file | Service | Test |
|---|---|---|---|---|---|---|
| GET | `/api/v1/admin/stats/dashboard` | admin, manager | `frontend/src/app/dashboard/page.tsx` | `backend/src/routes/admin-stats.routes.js` | `backend/src/services/stats/stats.service.js` | `backend/tests/integration/admin-dashboard-stage11.test.js`, `backend/tests/integration/admin-adjustments-stage14.test.js` |
| GET | `/api/v1/admin/stats/summary` | admin, manager | `frontend/src/app/dashboard/page.tsx`, `frontend/src/lib/admin-stats.ts` | `backend/src/routes/admin-stats.routes.js` | `backend/src/services/stats/stats.service.js` | `backend/tests/integration/admin-summary-stage13.test.js`, `backend/tests/integration/daily-stats-stage16.test.js` |
| POST | `/api/v1/admin/stats/recalculate` | admin, manager | `frontend/src/app/dashboard/page.tsx` TODO: уточнить точную кнопку | `backend/src/routes/admin-stats.routes.js` | `backend/src/services/stats/rollup.service.js` | `backend/tests/integration/daily-stats-stage16.test.js` |
| GET | `/api/v1/admin/stats/totals` | admin, manager | Frontend usage TODO: уточнить | `backend/src/routes/admin-stats.routes.js` | `backend/src/services/stats/stats.service.js` | `backend/tests/integration/advertiser-security.test.js` |

### Affiliates

| Method | Path | Roles | Frontend page | Route file | Service | Test |
|---|---|---|---|---|---|---|
| POST | `/api/v1/affiliates` | admin, manager | `frontend/src/app/dashboard/affiliates/create/page.tsx` | `backend/src/routes/affiliates.js` | `backend/src/services/affiliates.service.js` | `backend/tests/integration/public-ids.test.js` |
| GET | `/api/v1/affiliates` | admin, manager | `frontend/src/app/dashboard/affiliates/page.tsx` | `backend/src/routes/affiliates.js` | `backend/src/services/affiliates.service.js` | `backend/tests/integration/manager-assignment.test.js`, `backend/tests/integration/public-ids.test.js` |
| GET | `/api/v1/affiliates/:id` | admin, manager | `frontend/src/app/dashboard/affiliates/[id]/edit/page.tsx` | `backend/src/routes/affiliates.js` | `backend/src/services/affiliates.service.js` | `backend/tests/integration/manager-assignment.test.js`, `backend/tests/integration/questionnaires.test.js` |
| PATCH | `/api/v1/affiliates/:id` | admin, manager | `frontend/src/app/dashboard/affiliates/[id]/edit/page.tsx` | `backend/src/routes/affiliates.js` | `backend/src/services/affiliates.service.js` | TODO: tests |
| PATCH | `/api/v1/affiliates/:id/manager` | admin, manager | `frontend/src/app/dashboard/affiliates/[id]/edit/page.tsx` | `backend/src/routes/affiliates.js` | `backend/src/services/affiliates.service.js` | `backend/tests/integration/manager-assignment.test.js` |
| PATCH | `/api/v1/affiliates/:id/internal-note` | admin, manager | `frontend/src/app/dashboard/affiliates/[id]/edit/page.tsx` | `backend/src/routes/affiliates.js` | `backend/src/services/affiliates.service.js` | `backend/tests/integration/questionnaires.test.js` |

### Advertisers

| Method | Path | Roles | Frontend page | Route file | Service | Test |
|---|---|---|---|---|---|---|
| POST | `/api/v1/advertisers` | admin only | `frontend/src/app/dashboard/advertisers/create/page.tsx` | `backend/src/routes/advertisers.js` | `backend/src/services/advertisers.service.js` | `backend/tests/integration/public-ids.test.js` |
| GET | `/api/v1/advertisers` | admin, manager | `frontend/src/app/dashboard/advertisers/page.tsx` | `backend/src/routes/advertisers.js` | `backend/src/services/advertisers.service.js` | `backend/tests/integration/manager-assignment.test.js`, `backend/tests/integration/public-ids.test.js` |
| GET | `/api/v1/advertisers/:id` | admin, manager | `frontend/src/app/dashboard/advertisers/[id]/edit/page.tsx` | `backend/src/routes/advertisers.js` | `backend/src/services/advertisers.service.js` | `backend/tests/integration/manager-assignment.test.js`, `backend/tests/integration/questionnaires.test.js` |
| PATCH | `/api/v1/advertisers/:id` | admin, manager | `frontend/src/app/dashboard/advertisers/[id]/edit/page.tsx` | `backend/src/routes/advertisers.js` | `backend/src/services/advertisers.service.js` | TODO: tests |
| PATCH | `/api/v1/advertisers/:id/manager` | admin, manager | `frontend/src/app/dashboard/advertisers/[id]/edit/page.tsx` | `backend/src/routes/advertisers.js` | `backend/src/services/advertisers.service.js` | `backend/tests/integration/manager-assignment.test.js` |
| PATCH | `/api/v1/advertisers/:id/internal-note` | admin, manager | `frontend/src/app/dashboard/advertisers/[id]/edit/page.tsx` | `backend/src/routes/advertisers.js` | `backend/src/services/advertisers.service.js` | `backend/tests/integration/questionnaires.test.js` |
| POST | `/api/v1/advertisers/:id/reset-password` | admin only | Frontend usage TODO: уточнить | `backend/src/routes/advertisers.js` | `backend/src/services/advertisers.service.js` | TODO: tests |

### Managers

| Method | Path | Roles | Frontend page | Route file | Service | Test |
|---|---|---|---|---|---|---|
| GET | `/api/v1/admin/managers/lookup` | admin, manager | `frontend/src/app/dashboard/advertisers/page.tsx`, `frontend/src/app/dashboard/affiliates/page.tsx` | `backend/src/routes/admin-managers.routes.js` | `backend/src/services/managers.service.js` | `backend/tests/integration/manager-assignment.test.js` |
| GET | `/api/v1/admin/managers` | admin only | `frontend/src/app/dashboard/managers/page.tsx` | `backend/src/routes/admin-managers.routes.js` | `backend/src/services/managers.service.js` | `backend/tests/integration/manager-admin.test.js` |
| POST | `/api/v1/admin/managers` | admin only | `frontend/src/app/dashboard/managers/page.tsx` | `backend/src/routes/admin-managers.routes.js` | `backend/src/services/managers.service.js` | `backend/tests/integration/manager-admin.test.js` |
| PATCH | `/api/v1/admin/managers/:id` | admin only | `frontend/src/app/dashboard/managers/page.tsx` | `backend/src/routes/admin-managers.routes.js` | `backend/src/services/managers.service.js` | `backend/tests/integration/manager-admin.test.js` |
| POST | `/api/v1/admin/managers/:id/reset-password` | admin only | `frontend/src/app/dashboard/managers/page.tsx` TODO: уточнить | `backend/src/routes/admin-managers.routes.js` | `backend/src/services/managers.service.js` | `backend/tests/integration/manager-admin.test.js` |
| DELETE | `/api/v1/admin/managers/:id` | admin only | `frontend/src/app/dashboard/managers/page.tsx` | `backend/src/routes/admin-managers.routes.js` | `backend/src/services/managers.service.js` | `backend/tests/integration/manager-admin.test.js` |

### Offers

| Method | Path | Roles | Frontend page | Route file | Service | Test |
|---|---|---|---|---|---|---|
| POST | `/api/v1/offers` | admin, manager | `frontend/src/app/dashboard/offers/create/page.tsx` | `backend/src/routes/offers.routes.js` | `backend/src/services/offers.service.js` | `backend/tests/integration/public-ids.test.js` |
| GET | `/api/v1/offers` | admin, manager | `frontend/src/app/dashboard/offers/page.tsx` | `backend/src/routes/offers.routes.js` | `backend/src/services/offers.service.js` | `backend/tests/integration/public-ids.test.js` |
| GET | `/api/v1/offers/:id` | admin, manager | `frontend/src/app/dashboard/offers/[id]/edit/page.tsx` | `backend/src/routes/offers.routes.js` | `backend/src/services/offers.service.js` | `backend/tests/integration/public-ids.test.js` |
| PATCH | `/api/v1/offers/:id` | admin, manager | `frontend/src/app/dashboard/offers/[id]/edit/page.tsx` | `backend/src/routes/offers.routes.js` | `backend/src/services/offers.service.js` | `backend/tests/integration/offer-visibility-stage7.test.js`, `backend/tests/integration/advertiser-offers.test.js` |

### Offer goals

| Method | Path | Roles | Frontend page | Route file | Service | Test |
|---|---|---|---|---|---|---|
| GET | `/api/v1/admin/offers/:offerId/goals` | admin, manager | `frontend/src/app/dashboard/offers/[id]/edit/OfferGoalsSection.tsx` | `backend/src/routes/admin-offer-goals.routes.js` | `backend/src/services/offer-goals.service.js` | `backend/tests/integration/offer-goals-stage8.test.js` |
| POST | `/api/v1/admin/offers/:offerId/goals` | admin, manager | `frontend/src/app/dashboard/offers/[id]/edit/OfferGoalsSection.tsx` | `backend/src/routes/admin-offer-goals.routes.js` | `backend/src/services/offer-goals.service.js` | `backend/tests/integration/offer-goals-stage8.test.js`, `backend/tests/integration/offer-visibility-stage7.test.js` |
| PATCH | `/api/v1/admin/offers/:offerId/goals/:goalId` | admin, manager | `frontend/src/app/dashboard/offers/[id]/edit/OfferGoalsSection.tsx` | `backend/src/routes/admin-offer-goals.routes.js` | `backend/src/services/offer-goals.service.js` | `backend/tests/integration/offer-goals-stage8.test.js` |
| GET | `/api/v1/admin/offers/:offerId/goals/:goalId/affiliate-rates` | admin, manager | `frontend/src/app/dashboard/offers/[id]/edit/OfferGoalsSection.tsx` | `backend/src/routes/admin-offer-goals.routes.js` | `backend/src/services/offer-goals.service.js` | `backend/tests/integration/offer-goals-stage8.test.js` |
| PUT | `/api/v1/admin/offers/:offerId/goals/:goalId/affiliate-rates/:affiliateId` | admin, manager | `frontend/src/app/dashboard/offers/[id]/edit/OfferGoalsSection.tsx` | `backend/src/routes/admin-offer-goals.routes.js` | `backend/src/services/offer-goals.service.js` | `backend/tests/integration/offer-goals-stage8.test.js` |
| DELETE | `/api/v1/admin/offers/:offerId/goals/:goalId/affiliate-rates/:affiliateId` | admin, manager | `frontend/src/app/dashboard/offers/[id]/edit/OfferGoalsSection.tsx` | `backend/src/routes/admin-offer-goals.routes.js` | `backend/src/services/offer-goals.service.js` | `backend/tests/integration/offer-goals-stage8.test.js` |

### Offer access

| Method | Path | Roles | Frontend page | Route file | Service | Test |
|---|---|---|---|---|---|---|
| GET | `/api/v1/admin/offer-requests` | admin, manager | `frontend/src/app/dashboard/offers/[id]/edit/page.tsx` TODO: уточнить общий inbox UI | `backend/src/routes/admin-offer-requests.routes.js` | `backend/src/services/offer-requests.service.js` | `backend/tests/integration/critical-path.test.js` |
| POST | `/api/v1/admin/offer-requests/:requestId/decision` | admin, manager | TODO: уточнить | `backend/src/routes/admin-offer-requests.routes.js` | `backend/src/services/offer-requests.service.js` | `backend/tests/integration/critical-path.test.js` |
| GET | `/api/v1/admin/offers/:offerId/requests` | admin, manager | `frontend/src/app/dashboard/offers/[id]/edit/page.tsx` | `backend/src/routes/admin-offer-access.routes.js` | `backend/src/services/offer-requests.service.js` | `backend/tests/integration/offer-visibility-stage7.test.js` |
| POST | `/api/v1/admin/offers/:offerId/requests/:requestId/decision` | admin, manager | `frontend/src/app/dashboard/offers/[id]/edit/page.tsx` | `backend/src/routes/admin-offer-access.routes.js` | `backend/src/services/offer-requests.service.js` | `backend/tests/integration/offer-visibility-stage7.test.js` |
| GET | `/api/v1/admin/offers/:offerId/access` | admin, manager | `frontend/src/app/dashboard/offers/[id]/edit/page.tsx` | `backend/src/routes/admin-offer-access.routes.js` | `backend/src/services/offer-affiliate-access.service.js` | `backend/tests/integration/offer-visibility-stage7.test.js` |
| POST | `/api/v1/admin/offers/:offerId/access` | admin, manager | `frontend/src/lib/offers.ts` | `backend/src/routes/admin-offer-access.routes.js` | `backend/src/services/offer-affiliate-access.service.js` | `backend/tests/integration/offer-visibility-stage7.test.js` |
| DELETE | `/api/v1/admin/offers/:offerId/access/:affiliateId` | admin, manager | `frontend/src/lib/offers.ts` | `backend/src/routes/admin-offer-access.routes.js` | `backend/src/services/offer-affiliate-access.service.js` | `backend/tests/integration/offer-visibility-stage7.test.js` |
| PUT | `/api/v1/admin/offers/:offerId/affiliates/:affiliateId/access` | admin, manager | `frontend/src/lib/offers.ts` | `backend/src/routes/admin-offer-access.routes.js` | `backend/src/services/offer-affiliate-access.service.js` | TODO: tests |
| DELETE | `/api/v1/admin/offers/:offerId/affiliates/:affiliateId/access` | admin, manager | `frontend/src/lib/offers.ts` | `backend/src/routes/admin-offer-access.routes.js` | `backend/src/services/offer-affiliate-access.service.js` | TODO: tests |

### GEO

| Method | Path | Roles | Frontend page | Route file | Service | Test |
|---|---|---|---|---|---|---|
| GET | `/api/v1/admin/offers/:offerId/geo-rules` | admin, manager | `frontend/src/app/dashboard/offers/[id]/edit/OfferGeoTargetingSection.tsx` | `backend/src/routes/admin-offer-geo-targeting.routes.js` | `backend/src/services/offer-geo-rules.service.js` | TODO: tests |
| POST | `/api/v1/admin/offers/:offerId/geo-rules` | admin, manager | `frontend/src/app/dashboard/offers/[id]/edit/OfferGeoTargetingSection.tsx` | `backend/src/routes/admin-offer-geo-targeting.routes.js` | `backend/src/services/offer-geo-rules.service.js` | TODO: tests |
| DELETE | `/api/v1/admin/offers/:offerId/geo-rules/:ruleId` | admin, manager | `frontend/src/app/dashboard/offers/[id]/edit/OfferGeoTargetingSection.tsx` | `backend/src/routes/admin-offer-geo-targeting.routes.js` | `backend/src/services/offer-geo-rules.service.js` | TODO: tests |
| PATCH | `/api/v1/admin/offers/:offerId/targeting` | admin, manager | `frontend/src/app/dashboard/offers/[id]/edit/OfferGeoTargetingSection.tsx` | `backend/src/routes/admin-offer-geo-targeting.routes.js` | `backend/src/services/offers.service.js` | TODO: tests |

### Clicks

| Method | Path | Roles | Frontend page | Route file | Service | Test |
|---|---|---|---|---|---|---|
| GET | `/api/v1/clicks` | admin, manager | `frontend/src/app/dashboard/clicks/page.tsx` | `backend/src/routes/clicks.routes.js` | `backend/src/services/stats/stats.service.js` | `backend/tests/integration/admin-list-filters-stage12.test.js`, `backend/tests/integration/admin-adjustments-stage14.test.js` |

### Conversions

| Method | Path | Roles | Frontend page | Route file | Service | Test |
|---|---|---|---|---|---|---|
| GET | `/api/v1/conversions` | admin, manager | `frontend/src/app/dashboard/conversions/page.tsx` | `backend/src/routes/conversions.routes.js` | `backend/src/services/stats/stats.service.js` | `backend/tests/integration/admin-list-filters-stage12.test.js`, `backend/tests/integration/admin-adjustments-stage14.test.js` |
| GET | `/api/v1/conversions/:conversionId/status-history` | admin, manager | `frontend/src/app/dashboard/conversions/page.tsx` | `backend/src/routes/conversions.routes.js` | `backend/src/services/conversions.service.js` | `backend/tests/integration/conversion-status-stage15.test.js` |
| PATCH | `/api/v1/conversions/:conversionId/status` | admin, manager | `frontend/src/app/dashboard/conversions/page.tsx` | `backend/src/routes/conversions.routes.js` | `backend/src/services/conversions.service.js` | `backend/tests/integration/conversion-status-stage15.test.js` |
| POST | `/api/v1/conversions/:conversionId/status` | admin, manager | `frontend/src/app/dashboard/conversions/page.tsx` TODO: alias/legacy | `backend/src/routes/conversions.routes.js` | `backend/src/services/conversions.service.js` | `backend/tests/integration/conversion-status-stage15.test.js` |

### Adjustments

| Method | Path | Roles | Frontend page | Route file | Service | Test |
|---|---|---|---|---|---|---|
| POST | `/api/v1/admin/adjustments/preview` | admin, manager | `frontend/src/app/dashboard/adjustments/page.tsx` | `backend/src/routes/admin-adjustments.routes.js` | `backend/src/services/adjustments.service.js` | `backend/tests/integration/admin-adjustments-stage14.test.js` |
| POST | `/api/v1/admin/adjustments/:batchId/apply` | admin, manager | `frontend/src/app/dashboard/adjustments/page.tsx` | `backend/src/routes/admin-adjustments.routes.js` | `backend/src/services/adjustments.service.js` | `backend/tests/integration/admin-adjustments-stage14.test.js` |
| GET | `/api/v1/admin/adjustments/batches` | admin, manager | `frontend/src/app/dashboard/adjustments/page.tsx` | `backend/src/routes/admin-adjustments.routes.js` | `backend/src/services/adjustments.service.js` | `backend/tests/integration/admin-adjustments-stage14.test.js` |
| GET | `/api/v1/admin/adjustments/batches/:id` | admin, manager | `frontend/src/app/dashboard/adjustments/page.tsx` | `backend/src/routes/admin-adjustments.routes.js` | `backend/src/services/adjustments.service.js` | `backend/tests/integration/admin-adjustments-stage14.test.js` |

### Questionnaires

| Method | Path | Roles | Frontend page | Route file | Service | Test |
|---|---|---|---|---|---|---|
| GET | `/api/v1/admin/questionnaires` | admin only | `frontend/src/app/dashboard/questionnaires/page.tsx` | `backend/src/routes/admin-questionnaires.routes.js` | `backend/src/services/questionnaires.service.js` | `backend/tests/integration/questionnaires.test.js` |
| GET | `/api/v1/admin/questionnaires/:id` | admin only | `frontend/src/app/dashboard/questionnaires/page.tsx` | `backend/src/routes/admin-questionnaires.routes.js` | `backend/src/services/questionnaires.service.js` | `backend/tests/integration/questionnaires.test.js` |
| PUT | `/api/v1/admin/questionnaires/:targetRole` | admin only | `frontend/src/app/dashboard/questionnaires/page.tsx` | `backend/src/routes/admin-questionnaires.routes.js` | `backend/src/services/questionnaires.service.js` | `backend/tests/integration/questionnaires.test.js` |
| GET | `/api/v1/me/questionnaire` | affiliate, advertiser | `frontend/src/components/questionnaires/UserQuestionnairePage.tsx` | `backend/src/routes/me-questionnaire.routes.js` | `backend/src/services/questionnaires.service.js` | `backend/tests/integration/questionnaires.test.js` |
| PUT | `/api/v1/me/questionnaire/answers` | affiliate, advertiser | `frontend/src/components/questionnaires/UserQuestionnairePage.tsx` | `backend/src/routes/me-questionnaire.routes.js` | `backend/src/services/questionnaires.service.js` | `backend/tests/integration/questionnaires.test.js` |

### Audit logs

| Method | Path | Roles | Frontend page | Route file | Service | Test |
|---|---|---|---|---|---|---|
| GET | `/api/v1/admin/audit-logs` | admin, manager | `frontend/src/app/dashboard/audit-logs/page.tsx`, `frontend/src/components/AuditLogsModal.tsx` | `backend/src/routes/admin-audit-logs.routes.js` | `backend/src/services/audit.service.js` | `backend/tests/integration/audit-log-stage18.test.js` |
| GET | `/api/v1/admin/audit-logs/entity/:entityType/:entityId` | admin, manager | `frontend/src/components/AuditLogsModal.tsx` | `backend/src/routes/admin-audit-logs.routes.js` | `backend/src/services/audit.service.js` | `backend/tests/integration/audit-log-stage18.test.js` |

### Postback logs

| Method | Path | Roles | Frontend page | Route file | Service | Test |
|---|---|---|---|---|---|---|
| GET | `/api/v1/admin/postback-logs` | admin, manager | `frontend/src/app/dashboard/offers/[id]/edit/OfferPostbackSection.tsx` TODO: уточнить все usage | `backend/src/routes/admin-postback-logs.routes.js` | `backend/src/services/postback-logs.service.js` | TODO: tests |

### Finance

| Method | Path | Roles | Frontend page | Route file | Service | Test |
|---|---|---|---|---|---|---|
| TODO: endpoint не найден | TODO: endpoint не найден | TODO: уточнить | TODO: уточнить | TODO: уточнить | TODO: уточнить | TODO: уточнить |

## Detailed endpoints

## GET /api/v1/admin/stats/dashboard

### Назначение

Основной dashboard endpoint для admin/manager с агрегированной статистикой по дате, timezone и bucket.

### Роли

- `admin`
- `manager`

### Query params

| Param | Type | Required | Description |
|---|---|---|---|
| `date` | `string` | Да | Дата dashboard snapshot. |
| `timezone` | `string` | Да | IANA timezone. |
| `bucket` | `string` | Да | Подтверждён `hour`; остальные значения TODO: уточнить по validator. |

### Path params

Нет.

### Body

Нет.

### Response

`TODO: уточнить полный response format.` По тестам и frontend usage endpoint критичен для dashboard cards/charts.

### Errors

| Code | Причина | Когда возникает |
|---|---|---|
| `401` | Unauthorized | Нет bearer token. |
| `403` | Forbidden role | Роль не `admin|manager`. |
| `400` + `VALIDATION_ERROR` | Invalid date range / bucket / timezone | Параметры не проходят `validateDashboardStatsQuery()`. |

### Used by frontend

| Frontend file / page | Как использует |
|---|---|
| `frontend/src/app/dashboard/page.tsx` | Загружает сводку dashboard. |
| `frontend/src/lib/dashboard.ts` | TODO: уточнить точный API client helper. |

### Backend files

| Файл | Назначение |
|---|---|
| `backend/src/routes/admin-stats.routes.js` | Route `/dashboard`. |
| `backend/src/validators/stats.js` | `validateDashboardStatsQuery`. |
| `backend/src/services/stats/stats.service.js` | `getAdminDashboardStats()`. |

### Tests

| Test file | Что проверяет |
|---|---|
| `backend/tests/integration/admin-dashboard-stage11.test.js` | Dashboard aggregates и доступность по ролям. |
| `backend/tests/integration/admin-adjustments-stage14.test.js` | Пересчёт dashboard после adjustments. |

## POST /api/v1/offers

### Назначение

Создание offer в admin area.

### Роли

- `admin`
- `manager`

### Query params

Нет.

### Path params

Нет.

### Body

`TODO: уточнить полный DTO по validateCreateOfferDto.` Подтверждено только то, что тело валидируется централизованно через `backend/src/validators/offers.js`.

### Response

- `201 Created`
- Возвращает `{ offer }`.

### Errors

| Code | Причина | Когда возникает |
|---|---|---|
| `401` | Unauthorized | Нет bearer token. |
| `403` | Forbidden role | Роль не `admin|manager`. |
| `400` + `VALIDATION_ERROR` | Validation error | Некорректное тело offer DTO. |
| `409` | Duplicate entity | TODO: уточнить, какие конфликты реально выбрасывает service/model. |

### Used by frontend

| Frontend file / page | Как использует |
|---|---|
| `frontend/src/app/dashboard/offers/create/page.tsx` | Форма создания offer. |

### Backend files

| Файл | Назначение |
|---|---|
| `backend/src/routes/offers.routes.js` | Route create offer. |
| `backend/src/validators/offers.js` | `validateCreateOfferDto`. |
| `backend/src/services/offers.service.js` | `createOffer()`. |

### Tests

| Test file | Что проверяет |
|---|---|
| `backend/tests/integration/public-ids.test.js` | Создание offer и public IDs. |

## PATCH /api/v1/offers/:id

### Назначение

Обновление offer и связанных общих полей, включая настройки visibility/targeting, которые не вынесены в отдельные endpoints.

### Роли

- `admin`
- `manager`

### Query params

Нет.

### Path params

| Param | Type | Required | Description |
|---|---|---|---|
| `id` | `uuid` | Да | ID offer. |

### Body

`TODO: уточнить полный DTO по validateUpdateOfferDto.` Подтверждено, что endpoint используется для изменения offer visibility и advertiser-side fields.

### Response

- `200 OK`
- Возвращает `{ offer }`.

### Errors

| Code | Причина | Когда возникает |
|---|---|---|
| `400` + `VALIDATION_ERROR` | Invalid offer id or body | Некорректный `id` или DTO. |
| `404` | Entity not found | Offer не найден. TODO: уточнить точный error code в service. |
| `409` | Invalid visibility / access conflict | Используется при сценариях visibility и related rules. TODO: уточнить набор конфликтов. |

### Used by frontend

| Frontend file / page | Как использует |
|---|---|
| `frontend/src/app/dashboard/offers/[id]/edit/page.tsx` | Главная форма редактирования offer. |
| `frontend/src/app/dashboard/offers/[id]/edit/OfferPostbackSection.tsx` | Частично меняет postback-related settings через общий save flow. TODO: уточнить. |

### Backend files

| Файл | Назначение |
|---|---|
| `backend/src/routes/offers.routes.js` | Route update offer. |
| `backend/src/validators/offers.js` | `validateUpdateOfferDto`. |
| `backend/src/services/offers.service.js` | `updateOffer()`. |

### Tests

| Test file | Что проверяет |
|---|---|
| `backend/tests/integration/offer-visibility-stage7.test.js` | Visibility changes. |
| `backend/tests/integration/advertiser-offers.test.js` | Изменения offer отражаются в advertiser cabinet. |

## POST /api/v1/affiliates

### Назначение

Создание affiliate entity для admin/manager.

### Роли

- `admin`
- `manager`

### Query params

Нет.

### Path params

Нет.

### Body

`TODO: уточнить полный DTO по validateCreateAffiliateDto.`

### Response

- `201 Created`
- Возвращает `{ affiliate }`.

### Errors

| Code | Причина | Когда возникает |
|---|---|---|
| `400` + `VALIDATION_ERROR` | Validation error | Некорректные данные affiliate. |
| `409` | Duplicate entity | Email/public id conflict. TODO: уточнить точные кейсы. |

### Used by frontend

| Frontend file / page | Как использует |
|---|---|
| `frontend/src/app/dashboard/affiliates/create/page.tsx` | Форма создания affiliate. |

### Backend files

| Файл | Назначение |
|---|---|
| `backend/src/routes/affiliates.js` | Route create affiliate. |
| `backend/src/validators/affiliates.js` | `validateCreateAffiliateDto`. |
| `backend/src/services/affiliates.service.js` | `createAffiliate()`. |

### Tests

| Test file | Что проверяет |
|---|---|
| `backend/tests/integration/public-ids.test.js` | Создание affiliate и public IDs. |

## POST /api/v1/advertisers

### Назначение

Создание advertiser entity. Доступно только admin.

### Роли

- `admin`

### Query params

Нет.

### Path params

Нет.

### Body

`TODO: уточнить полный DTO по validateCreateAdvertiserDto.`

### Response

- `201 Created`
- Возвращает result из `createAdvertiser()`.

### Errors

| Code | Причина | Когда возникает |
|---|---|---|
| `401` | Unauthorized | Нет bearer token. |
| `403` | Forbidden role | Не admin. |
| `400` + `VALIDATION_ERROR` | Validation error | Некорректное advertiser DTO. |
| `409` | Duplicate entity | TODO: уточнить точные conflict cases. |

### Used by frontend

| Frontend file / page | Как использует |
|---|---|
| `frontend/src/app/dashboard/advertisers/create/page.tsx` | Форма создания advertiser. |

### Backend files

| Файл | Назначение |
|---|---|
| `backend/src/routes/advertisers.js` | Route create advertiser. |
| `backend/src/validators/advertisers.js` | `validateCreateAdvertiserDto`. |
| `backend/src/services/advertisers.service.js` | `createAdvertiser()`. |

### Tests

| Test file | Что проверяет |
|---|---|
| `backend/tests/integration/public-ids.test.js` | Создание advertiser и public IDs. |

## POST /api/v1/admin/offer-requests/:requestId/decision

### Назначение

Approve/reject access request партнёра к офферу.

### Роли

- `admin`
- `manager`

### Query params

Нет.

### Path params

| Param | Type | Required | Description |
|---|---|---|---|
| `requestId` | `uuid` | Да | ID offer access request. |

### Body

| Field | Type | Required | Description |
|---|---|---|---|
| `decision` | `string` | Да | Подтверждено, что валидируется специальным validator. Точные значения TODO: уточнить, вероятно `approve/reject`. |

### Response

`TODO: уточнить полный response format.` Возвращается result из `reviewOfferRequest()`.

### Errors

| Code | Причина | Когда возникает |
|---|---|---|
| `400` + `VALIDATION_ERROR` | Invalid request id or body | Неверный `requestId` или `decision`. |
| `404` | Entity not found | Request не найден. TODO: уточнить code. |
| `409` | Invalid status | Request уже обработан / access conflict. TODO: уточнить. |

### Used by frontend

| Frontend file / page | Как использует |
|---|---|
| `frontend/src/app/dashboard/offers/[id]/edit/page.tsx` | Модерация partner access requests. |

### Backend files

| Файл | Назначение |
|---|---|
| `backend/src/routes/admin-offer-requests.routes.js` | General decision endpoint. |
| `backend/src/validators/offerRequests.js` | Validation decision payload. |
| `backend/src/services/offer-requests.service.js` | `reviewOfferRequest()`. |

### Tests

| Test file | Что проверяет |
|---|---|
| `backend/tests/integration/critical-path.test.js` | Request access -> admin decision -> partner visibility changes. |

## PATCH /api/v1/conversions/:conversionId/status

### Назначение

Ручное обновление статуса conversion из admin area.

### Роли

- `admin`
- `manager`

### Query params

Нет.

### Path params

| Param | Type | Required | Description |
|---|---|---|---|
| `conversionId` | `uuid` | Да | ID conversion. |

### Body

| Field | Type | Required | Description |
|---|---|---|---|
| `status` | `string` | Да | Один из `pending`, `approved`, `rejected`, `cancelled`. |
| `reason` | `string \| null` | Нет | Комментарий причины. Если передан, должен быть строкой. |

### Response

`TODO: уточнить полный response body.` Возвращает result из `updateConversionStatusService()`.

### Errors

| Code | Причина | Когда возникает |
|---|---|---|
| `400` + `VALIDATION_ERROR` | Missing status | Не передан `status`. |
| `400` + `VALIDATION_ERROR` | Invalid status | Статус не входит в разрешённые значения. |
| `400` + `VALIDATION_ERROR` | Invalid reason | `reason` не строка. |
| `404` | Entity not found | Conversion не найдена. TODO: уточнить code. |
| `409` | Invalid status transition | TODO: уточнить, если service запрещает часть переходов. |

### Used by frontend

| Frontend file / page | Как использует |
|---|---|
| `frontend/src/app/dashboard/conversions/page.tsx` | Ручная модерация conversion status. |
| `frontend/src/lib/admin-lists.ts` | `updateConversionStatus()`. |

### Backend files

| Файл | Назначение |
|---|---|
| `backend/src/routes/conversions.routes.js` | Route status update. |
| `backend/src/services/conversions.service.js` | `updateConversionStatus()`. |
| `backend/src/constants/conversions.js` | Allowed status values. |

### Tests

| Test file | Что проверяет |
|---|---|
| `backend/tests/integration/conversion-status-stage15.test.js` | Обновление статуса и history. |

## POST /api/v1/admin/adjustments/preview

### Назначение

Предварительная валидация и расчёт batch manual adjustments перед применением.

### Роли

- `admin`
- `manager`

### Query params

Нет.

### Path params

Нет.

### Body

`TODO: уточнить точную CSV/DTO схему по validateAdjustmentPreviewPayload.` Подтверждено, что это критичный endpoint Stage 14.

### Response

Возвращает preview batch из `previewManualAdjustmentBatch()`. По тестам дальше используется `batch.id`.

### Errors

| Code | Причина | Когда возникает |
|---|---|---|
| `400` + `VALIDATION_ERROR` | CSV validation failed | Некорректный payload preview. |
| `403` | Forbidden role | Не admin/manager. |
| `409` | Adjustment batch failed | TODO: уточнить conflict cases. |

### Used by frontend

| Frontend file / page | Как использует |
|---|---|
| `frontend/src/app/dashboard/adjustments/page.tsx` | Preview manual adjustments. |

### Backend files

| Файл | Назначение |
|---|---|
| `backend/src/routes/admin-adjustments.routes.js` | Route preview. |
| `backend/src/validators/adjustments.js` | `validateAdjustmentPreviewPayload`. |
| `backend/src/services/adjustments.service.js` | `previewManualAdjustmentBatch()`. |

### Tests

| Test file | Что проверяет |
|---|---|
| `backend/tests/integration/admin-adjustments-stage14.test.js` | Preview/import/apply/cancel flow. |

## GET /api/v1/admin/audit-logs

### Назначение

Листинг audit events по всей системе.

### Роли

- `admin`
- `manager`

### Query params

`TODO: уточнить все фильтры по validateAuditLogListQuery.` Подтверждено наличие pagination и фильтров.

### Path params

Нет.

### Body

Нет.

### Response

Подтверждённая структура верхнего уровня:

```json
{
  "items": [],
  "page": 1,
  "limit": 20,
  "total": 0,
  "totalPages": 0
}
```

### Errors

| Code | Причина | Когда возникает |
|---|---|---|
| `400` + `VALIDATION_ERROR` | Invalid date range / filters | Некорректные query params. |
| `401` | Unauthorized | Нет токена. |
| `403` | Forbidden role | Не admin/manager. |

### Used by frontend

| Frontend file / page | Как использует |
|---|---|
| `frontend/src/app/dashboard/audit-logs/page.tsx` | Страница общего audit log. |
| `frontend/src/components/AuditLogsModal.tsx` | Модальное окно по сущности. |

### Backend files

| Файл | Назначение |
|---|---|
| `backend/src/routes/admin-audit-logs.routes.js` | Routes list/entity scoped list. |
| `backend/src/validators/auditLogs.js` | Query validation. |
| `backend/src/services/audit.service.js` | `listAuditEvents()`. |

### Tests

| Test file | Что проверяет |
|---|---|
| `backend/tests/integration/audit-log-stage18.test.js` | Audit trail выдача. |

## Связанные разделы

- [Backend architecture](../architecture/03-backend.md)
- [Offers domain](../domains/offers.md)
- [Affiliates domain](../domains/affiliates.md)
- [Advertisers domain](../domains/advertisers.md)
- [Offer access domain](../domains/offer-access.md)
- [Postbacks and conversions domain](../domains/postbacks-conversions.md)
- [Adjustments domain](../domains/adjustments.md)
- [Stats domain](../domains/stats.md)
- [Questionnaires domain](../domains/questionnaires.md)
