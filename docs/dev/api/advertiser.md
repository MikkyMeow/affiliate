# Advertiser API

Статус: draft

## Назначение

Advertiser API обслуживает advertiser cabinet: профиль, список собственных offer’ов, stats, finance, postback logs и questionnaire flow.

## Base path

- `/api/v1/advertiser`
- Дополнительные advertiser-prefixed группы:
  - `/api/v1/advertiser/offers`
  - `/api/v1/advertiser/stats`
  - `/api/v1/advertiser/postbacks`
  - `/api/v1/advertiser/finance`

## Response format

Успешные ответы используют общий envelope `success/data/meta`.

## Auth / permissions

- Все advertiser endpoints требуют `Authorization: Bearer <token>`.
- Все advertiser cabinet routes защищены `authorizeRole('advertiser')`.
- Для `/offers`, `/stats`, `/postbacks`, `/finance` дополнительно требуется completion анкеты через `requireQuestionnaireCompletion()`.
- Ownership check advertiser -> own data делается через `resolveAdvertiserIdFromUser()` и сервисный слой.

## Endpoint map

### Dashboard

| Method | Path | Roles | Frontend page | Route file | Service | Test |
|---|---|---|---|---|---|---|
| GET | `/api/v1/advertiser/stats/summary` | advertiser + questionnaire completed | `frontend/src/app/advertiser/page.tsx`, `frontend/src/app/advertiser/stats/page.tsx` | `backend/src/routes/advertiser-stats.routes.js` | `backend/src/services/advertisers/advertiser-stats.service.js` | `backend/tests/integration/advertiser-stats.test.js` |

### Offers

| Method | Path | Roles | Frontend page | Route file | Service | Test |
|---|---|---|---|---|---|---|
| GET | `/api/v1/advertiser/offers` | advertiser + questionnaire completed | `frontend/src/app/advertiser/offers/page.tsx` | `backend/src/routes/advertiser-offers.routes.js` | `backend/src/services/advertisers/advertiser-offers.service.js` | `backend/tests/integration/advertiser-offers.test.js`, `backend/tests/integration/questionnaires.test.js` |
| GET | `/api/v1/advertiser/offers/:offerId` | advertiser + questionnaire completed | `frontend/src/app/advertiser/offers/[offerId]/page.tsx` | `backend/src/routes/advertiser-offers.routes.js` | `backend/src/services/advertisers/advertiser-offers.service.js` | `backend/tests/integration/advertiser-offers.test.js` |

### Offer detail

| Method | Path | Roles | Frontend page | Route file | Service | Test |
|---|---|---|---|---|---|---|
| GET | `/api/v1/advertiser/stats/offers/:offerId` | advertiser + questionnaire completed | `frontend/src/app/advertiser/offers/[offerId]/page.tsx` | `backend/src/routes/advertiser-stats.routes.js` | `backend/src/services/advertisers/advertiser-stats.service.js` | `backend/tests/integration/advertiser-stats.test.js` |

### Conversions

| Method | Path | Roles | Frontend page | Route file | Service | Test |
|---|---|---|---|---|---|---|
| TODO: отдельный advertiser conversions endpoint не найден | TODO: endpoint не найден | advertiser | TODO: уточнить | TODO: уточнить | TODO: уточнить | TODO: уточнить |

### Stats

| Method | Path | Roles | Frontend page | Route file | Service | Test |
|---|---|---|---|---|---|---|
| GET | `/api/v1/advertiser/stats/summary` | advertiser + questionnaire completed | `frontend/src/app/advertiser/stats/page.tsx` | `backend/src/routes/advertiser-stats.routes.js` | `backend/src/services/advertisers/advertiser-stats.service.js` | `backend/tests/integration/advertiser-stats.test.js` |
| GET | `/api/v1/advertiser/stats/breakdowns` | advertiser + questionnaire completed | `frontend/src/app/advertiser/stats/page.tsx` | `backend/src/routes/advertiser-stats.routes.js` | `backend/src/services/advertisers/advertiser-stats.service.js` | `backend/tests/integration/advertiser-stats.test.js` |
| GET | `/api/v1/advertiser/stats/offers/:offerId` | advertiser + questionnaire completed | `frontend/src/app/advertiser/offers/[offerId]/page.tsx` | `backend/src/routes/advertiser-stats.routes.js` | `backend/src/services/advertisers/advertiser-stats.service.js` | `backend/tests/integration/advertiser-stats.test.js` |

### Finance

| Method | Path | Roles | Frontend page | Route file | Service | Test |
|---|---|---|---|---|---|---|
| GET | `/api/v1/advertiser/finance/summary` | advertiser + questionnaire completed | `frontend/src/app/advertiser/finance/page.tsx` | `backend/src/routes/advertiser-finance.routes.js` | `backend/src/services/advertisers/advertiser-finance.service.js` | `backend/tests/integration/advertiser-finance.test.js` |
| GET | `/api/v1/advertiser/finance/breakdowns` | advertiser + questionnaire completed | `frontend/src/app/advertiser/finance/page.tsx` | `backend/src/routes/advertiser-finance.routes.js` | `backend/src/services/advertisers/advertiser-finance.service.js` | `backend/tests/integration/advertiser-finance.test.js` |

### Postback settings / logs

| Method | Path | Roles | Frontend page | Route file | Service | Test |
|---|---|---|---|---|---|---|
| GET | `/api/v1/advertiser/postbacks` | advertiser + questionnaire completed | `frontend/src/app/advertiser/postbacks/page.tsx` | `backend/src/routes/advertiser-postbacks.routes.js` | `backend/src/services/advertisers/advertiser-postbacks.service.js` | `backend/tests/integration/advertiser-postbacks.test.js` |
| GET | `/api/v1/advertiser/postbacks/:postbackId` | advertiser + questionnaire completed | `frontend/src/app/advertiser/postbacks/[postbackId]/page.tsx` | `backend/src/routes/advertiser-postbacks.routes.js` | `backend/src/services/advertisers/advertiser-postbacks.service.js` | `backend/tests/integration/advertiser-postbacks.test.js` |
| TODO: отдельный endpoint для postback settings не найден | TODO: endpoint не найден | advertiser | TODO: уточнить | TODO: уточнить | TODO: уточнить | TODO: уточнить |

### Questionnaire

| Method | Path | Roles | Frontend page | Route file | Service | Test |
|---|---|---|---|---|---|---|
| GET | `/api/v1/me/questionnaire` | advertiser | `frontend/src/app/advertiser/questionnaire/page.tsx`, `frontend/src/components/questionnaires/UserQuestionnairePage.tsx` | `backend/src/routes/me-questionnaire.routes.js` | `backend/src/services/questionnaires.service.js` | `backend/tests/integration/questionnaires.test.js` |
| PUT | `/api/v1/me/questionnaire/answers` | advertiser | `frontend/src/app/advertiser/questionnaire/page.tsx`, `frontend/src/components/questionnaires/UserQuestionnairePage.tsx` | `backend/src/routes/me-questionnaire.routes.js` | `backend/src/services/questionnaires.service.js` | `backend/tests/integration/questionnaires.test.js` |

### Profile

| Method | Path | Roles | Frontend page | Route file | Service | Test |
|---|---|---|---|---|---|---|
| GET | `/api/v1/advertiser/profile` | advertiser | `frontend/src/app/advertiser/profile/page.tsx` | `backend/src/routes/advertiser-self.routes.js` | `backend/src/services/advertisers/advertiser-profile.service.js` | `backend/tests/integration/advertiser-foundation.test.js`, `backend/tests/integration/questionnaires.test.js` |
| PATCH | `/api/v1/advertiser/profile` | advertiser | `frontend/src/app/advertiser/profile/page.tsx` | `backend/src/routes/advertiser-self.routes.js` | `backend/src/services/profile.service.js` | TODO: tests |

## Detailed endpoints

## GET /api/v1/advertiser/stats/summary

### Назначение

Главный advertiser dashboard summary.

### Роли

- `advertiser`

### Query params

| Param | Type | Required | Description |
|---|---|---|---|
| `dateFrom` | `string` | Нет | Начало периода. |
| `dateTo` | `string` | Нет | Конец периода. |

### Path params

Нет.

### Body

Нет.

### Response

Возвращает summary объект. По frontend типам подтверждены агрегаты:

- `clicks`
- `conversionsTotal`
- `conversionsPending`
- `conversionsApproved`
- `conversionsRejected`
- `conversionsCancelled`
- `revenue`
- `payout`
- `profit`

`TODO: уточнить полный response example.`

### Errors

| Code | Причина | Когда возникает |
|---|---|---|
| `401` | Not authenticated | Нет токена. |
| `403` | User is not advertiser | Неверная роль. |
| `403` + `QUESTIONNAIRE_REQUIRED` | Questionnaire required | Анкета не завершена. |
| `400` + `VALIDATION_ERROR` | Invalid date range | Фильтры не проходят validator. |

### Used by frontend

| Frontend file / page | Как использует |
|---|---|
| `frontend/src/app/advertiser/page.tsx` | Summary на главной advertiser page. |
| `frontend/src/app/advertiser/stats/page.tsx` | Summary cards на отдельной stats page. |
| `frontend/src/lib/advertiser.api.ts` | `getStatsSummary()`. |

### Backend files

| Файл | Назначение |
|---|---|
| `backend/src/routes/advertiser-stats.routes.js` | Route `/summary`. |
| `backend/src/validators/stats.js` | `validateAdvertiserStatsFilters`. |
| `backend/src/services/advertisers/advertiser-stats.service.js` | `getAdvertiserStatsSummary()`. |

### Tests

| Test file | Что проверяет |
|---|---|
| `backend/tests/integration/advertiser-stats.test.js` | Summary totals и advertiser ownership. |

## GET /api/v1/advertiser/offers

### Назначение

Возвращает список offer’ов, принадлежащих текущему advertiser.

### Роли

- `advertiser`

### Query params

| Param | Type | Required | Description |
|---|---|---|---|
| `page` | `number` | Нет | Номер страницы. |
| `pageSize` | `number` | Нет | Размер страницы. |
| `status` | `string` | Нет | Фильтр по статусу offer. |
| `search` | `string` | Нет | Поисковый фильтр. |

### Path params

Нет.

### Body

Нет.

### Response

Подтверждённая структура верхнего уровня по frontend типам:

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

Item включает, как минимум:

- `id`
- `name`
- `status`
- `revenueRub`
- `trackingType`
- `category`
- `previewUrl`
- `createdAt`
- `updatedAt`

### Errors

| Code | Причина | Когда возникает |
|---|---|---|
| `401` | Not authenticated | Нет токена. |
| `403` | User is not advertiser | Неверная роль. |
| `403` + `QUESTIONNAIRE_REQUIRED` | Questionnaire required | Анкета не завершена. |
| `400` + `VALIDATION_ERROR` | Invalid filters | Некорректный `page`, `pageSize`, `status`, `search`. |

### Used by frontend

| Frontend file / page | Как использует |
|---|---|
| `frontend/src/app/advertiser/offers/page.tsx` | Offers list. |
| `frontend/src/lib/advertiser.api.ts` | `getOffers()`. |

### Backend files

| Файл | Назначение |
|---|---|
| `backend/src/routes/advertiser-offers.routes.js` | Route offers list. |
| `backend/src/validators/advertiserOffers.js` | `validateAdvertiserOfferListQuery`. |
| `backend/src/services/advertisers/advertiser-offers.service.js` | `listAdvertiserOffers()`. |
| `backend/src/services/advertisers/advertiser-context.service.js` | Resolve current advertiser id. |

### Tests

| Test file | Что проверяет |
|---|---|
| `backend/tests/integration/advertiser-offers.test.js` | Pagination, filters, ownership. |
| `backend/tests/integration/questionnaires.test.js` | Questionnaire gate. |

## GET /api/v1/advertiser/offers/:offerId

### Назначение

Возвращает детали одного offer, принадлежащего текущему advertiser.

### Роли

- `advertiser`

### Query params

Нет.

### Path params

| Param | Type | Required | Description |
|---|---|---|---|
| `offerId` | `uuid` | Да | ID offer. |

### Body

Нет.

### Response

- `200 OK`
- Возвращает `{ offer }`.
- По frontend типам payload совпадает с `AdvertiserOfferDetails`.

### Errors

| Code | Причина | Когда возникает |
|---|---|---|
| `400` + `VALIDATION_ERROR` | Invalid offer id | `offerId` не UUID. |
| `404` | Offer not found | Offer не принадлежит advertiser или отсутствует. |
| `403` + `QUESTIONNAIRE_REQUIRED` | Questionnaire required | Анкета не завершена. |

### Used by frontend

| Frontend file / page | Как использует |
|---|---|
| `frontend/src/app/advertiser/offers/[offerId]/page.tsx` | Offer detail page. |
| `frontend/src/lib/advertiser.api.ts` | `getOfferById()`. |

### Backend files

| Файл | Назначение |
|---|---|
| `backend/src/routes/advertiser-offers.routes.js` | Route offer detail. |
| `backend/src/validators/offers.js` | `validateUuid`. |
| `backend/src/services/advertisers/advertiser-offers.service.js` | `getAdvertiserOfferById()`. |

### Tests

| Test file | Что проверяет |
|---|---|
| `backend/tests/integration/advertiser-offers.test.js` | Detail response и запрет на foreign offer. |

## GET /api/v1/advertiser/postbacks

### Назначение

Листинг postback logs текущего advertiser.

### Роли

- `advertiser`

### Query params

| Param | Type | Required | Description |
|---|---|---|---|
| `page` | `number` | Нет | Номер страницы. |
| `pageSize` | `number` | Нет | Размер страницы. |
| `status` | `string` | Нет | Фильтр по статусу postback log. |
| `dateFrom` | `string` | Нет | Начало периода. |
| `dateTo` | `string` | Нет | Конец периода. |
| `offerId` | `uuid` | Нет | Фильтр по own offer. |

### Path params

Нет.

### Body

Нет.

### Response

Подтверждённая структура по frontend типам:

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

Item включает:

- `id`
- `offerId`
- `conversionId`
- `clickId`
- `status`
- `errorCode`
- `responseStatusCode`
- `sentAt`
- `createdAt`
- `updatedAt`

### Errors

| Code | Причина | Когда возникает |
|---|---|---|
| `401` | Not authenticated | Нет токена. |
| `403` | User is not advertiser | Неверная роль. |
| `403` + `QUESTIONNAIRE_REQUIRED` | Questionnaire required | Анкета не завершена. |
| `400` + `VALIDATION_ERROR` | Invalid filters | Некорректные `page`, `pageSize`, `offerId`, date range, status. |
| `404` | Advertiser has no access to offer | Передан foreign `offerId`. TODO: уточнить точный code. |

### Used by frontend

| Frontend file / page | Как использует |
|---|---|
| `frontend/src/app/advertiser/postbacks/page.tsx` | Список логов postback. |
| `frontend/src/lib/advertiser.api.ts` | `getPostbacks()`. |

### Backend files

| Файл | Назначение |
|---|---|
| `backend/src/routes/advertiser-postbacks.routes.js` | Route list. |
| `backend/src/validators/advertiserPostbacks.js` | `validateAdvertiserPostbackListQuery`. |
| `backend/src/services/advertisers/advertiser-postbacks.service.js` | `listAdvertiserPostbacks()`. |

### Tests

| Test file | Что проверяет |
|---|---|
| `backend/tests/integration/advertiser-postbacks.test.js` | List filters, foreign data isolation, auth. |

## GET /api/v1/advertiser/finance/summary

### Назначение

Сводка финансов advertiser по статусам и totals.

### Роли

- `advertiser`

### Query params

| Param | Type | Required | Description |
|---|---|---|---|
| `offerId` | `uuid` | Нет | Фильтр по own offer. |
| `dateFrom` | `string` | Нет | Начало периода. |
| `dateTo` | `string` | Нет | Конец периода. |

### Path params

Нет.

### Body

Нет.

### Response

По frontend типам подтверждены поля:

- `pendingRevenue`
- `approvedRevenue`
- `rejectedRevenue`
- `cancelledRevenue`
- `pendingPayout`
- `approvedPayout`
- `rejectedPayout`
- `cancelledPayout`
- `conversionsPending`
- `conversionsApproved`
- `conversionsRejected`
- `conversionsCancelled`

### Errors

| Code | Причина | Когда возникает |
|---|---|---|
| `401` | Not authenticated | Нет токена. |
| `403` | User is not advertiser | Неверная роль. |
| `403` + `QUESTIONNAIRE_REQUIRED` | Questionnaire required | Анкета не завершена. |
| `400` + `VALIDATION_ERROR` | Invalid filters | Некорректный `offerId` или date range. |
| `404` | Finance data unavailable / foreign offer | TODO: уточнить точный code для чужого offerId. |

### Used by frontend

| Frontend file / page | Как использует |
|---|---|
| `frontend/src/app/advertiser/finance/page.tsx` | Finance summary cards. |
| `frontend/src/lib/advertiser.api.ts` | `getFinanceSummary()`. |

### Backend files

| Файл | Назначение |
|---|---|
| `backend/src/routes/advertiser-finance.routes.js` | Route `/summary`. |
| `backend/src/validators/advertiserFinance.js` | `validateAdvertiserFinanceFilters`. |
| `backend/src/services/advertisers/advertiser-finance.service.js` | `getAdvertiserFinanceSummary()`. |

### Tests

| Test file | Что проверяет |
|---|---|
| `backend/tests/integration/advertiser-finance.test.js` | Summary, filtering, foreign offer restrictions, auth. |

## GET /api/v1/advertiser/profile

### Назначение

Возвращает advertiser profile для текущего user.

### Роли

- `advertiser`

### Query params

Нет.

### Path params

Нет.

### Body

Нет.

### Response

По frontend типам подтверждены поля:

- `id`
- `publicId`
- `name`
- `email`
- `status`
- `telegram`
- `questionnaireAnswers`
- `createdAt`
- `updatedAt`
- `manager`

### Errors

| Code | Причина | Когда возникает |
|---|---|---|
| `401` | Not authenticated | Нет токена. |
| `403` | User is not advertiser | Неверная роль, в том числе affiliate/admin. |

### Used by frontend

| Frontend file / page | Как использует |
|---|---|
| `frontend/src/app/advertiser/profile/page.tsx` | Profile page. |
| `frontend/src/lib/advertiser.api.ts` | `getProfile()`. |

### Backend files

| Файл | Назначение |
|---|---|
| `backend/src/routes/advertiser-self.routes.js` | Route `/profile`. |
| `backend/src/services/advertisers/advertiser-profile.service.js` | `getAdvertiserProfileByUser()`. |

### Tests

| Test file | Что проверяет |
|---|---|
| `backend/tests/integration/advertiser-foundation.test.js` | Profile доступность по auth/roles. |
| `backend/tests/integration/questionnaires.test.js` | Questionnaire answers видны в profile-related flows. |

## Связанные разделы

- [Advertisers domain](../domains/advertisers.md)
- [Offers domain](../domains/offers.md)
- [Postbacks and conversions domain](../domains/postbacks-conversions.md)
- [Stats domain](../domains/stats.md)
- [Finance domain](../domains/finance.md)
- [Tracking API](./tracking.md)
