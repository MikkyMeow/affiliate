# Partner API

Статус: draft

## Назначение

Partner API обслуживает кабинет affiliate/partner: профиль, список доступных офферов, детализацию offer access, request access, dashboard stats, клики и конверсии.

## Base path

- `/api/v1/partner`

## Response format

Успешные ответы используют общий envelope:

```json
{
  "success": true,
  "data": {},
  "meta": null
}
```

Для list endpoints (`/clicks`, `/conversions`) используется `meta.total/limit/offset`.

## Auth / permissions

- Все endpoints требуют `Authorization: Bearer <token>`.
- Все endpoints защищены `authorizeRole('affiliate')`.
- Дополнительно router проверяет наличие `req.user.affiliateId`; иначе возвращает `403 AFFILIATE_NOT_LINKED`.
- После `/profile` и `PATCH /profile` на router уровне включается `requireQuestionnaireCompletion()`.
- Поэтому offers/stats/clicks/conversions/request access доступны только affiliate с заполненной обязательной анкетой.

## Endpoint map

### Dashboard

| Method | Path | Roles | Frontend page | Route file | Service | Test |
|---|---|---|---|---|---|---|
| GET | `/api/v1/partner/stats` | affiliate | `frontend/src/app/partner/page.tsx`, `frontend/src/app/partner/stats/page.tsx` | `backend/src/routes/partner.routes.js` | `backend/src/services/partner.service.js` | `backend/tests/integration/critical-path.test.js` |

### Offers

| Method | Path | Roles | Frontend page | Route file | Service | Test |
|---|---|---|---|---|---|---|
| GET | `/api/v1/partner/offers` | affiliate + questionnaire completed | `frontend/src/app/partner/page.tsx` | `backend/src/routes/partner.routes.js` | `backend/src/services/partner.service.js` | `backend/tests/integration/critical-path.test.js`, `backend/tests/integration/offer-visibility-stage7.test.js`, `backend/tests/integration/questionnaires.test.js` |
| GET | `/api/v1/partner/offers/:id` | affiliate + questionnaire completed | `frontend/src/app/partner/offers/[offerId]/page.tsx` | `backend/src/routes/partner.routes.js` | `backend/src/services/partner.service.js` | `backend/tests/integration/critical-path.test.js`, `backend/tests/integration/offer-visibility-stage7.test.js` |

### Offer access requests

| Method | Path | Roles | Frontend page | Route file | Service | Test |
|---|---|---|---|---|---|---|
| POST | `/api/v1/partner/offers/:id/request` | affiliate + questionnaire completed | `frontend/src/app/partner/offers/[offerId]/page.tsx` | `backend/src/routes/partner.routes.js` | `backend/src/services/offer-requests.service.js` | `backend/tests/integration/critical-path.test.js`, `backend/tests/integration/offer-visibility-stage7.test.js` |

### Tracking links

| Method | Path | Roles | Frontend page | Route file | Service | Test |
|---|---|---|---|---|---|---|
| TODO: отдельный endpoint не найден | TODO: endpoint не найден | affiliate | `frontend/src/app/partner/page.tsx`, `frontend/src/app/partner/offers/[offerId]/page.tsx` | TODO: уточнить | Frontend строит ссылку сам через `frontend/src/lib/tracking.ts` | TODO: tests |

### Clicks

| Method | Path | Roles | Frontend page | Route file | Service | Test |
|---|---|---|---|---|---|---|
| GET | `/api/v1/partner/clicks` | affiliate + questionnaire completed | `frontend/src/app/partner/clicks/page.tsx` | `backend/src/routes/partner.routes.js` | `backend/src/services/partner.service.js` | TODO: уточнить отдельный test file |

### Conversions

| Method | Path | Roles | Frontend page | Route file | Service | Test |
|---|---|---|---|---|---|---|
| GET | `/api/v1/partner/conversions` | affiliate + questionnaire completed | `frontend/src/app/partner/conversions/page.tsx` | `backend/src/routes/partner.routes.js` | `backend/src/services/partner.service.js` | TODO: уточнить отдельный test file |

### Questionnaire

| Method | Path | Roles | Frontend page | Route file | Service | Test |
|---|---|---|---|---|---|---|
| GET | `/api/v1/me/questionnaire` | affiliate | `frontend/src/app/partner/questionnaire/page.tsx`, `frontend/src/components/questionnaires/UserQuestionnairePage.tsx` | `backend/src/routes/me-questionnaire.routes.js` | `backend/src/services/questionnaires.service.js` | `backend/tests/integration/questionnaires.test.js` |
| PUT | `/api/v1/me/questionnaire/answers` | affiliate | `frontend/src/app/partner/questionnaire/page.tsx`, `frontend/src/components/questionnaires/UserQuestionnairePage.tsx` | `backend/src/routes/me-questionnaire.routes.js` | `backend/src/services/questionnaires.service.js` | `backend/tests/integration/questionnaires.test.js` |

### Profile

| Method | Path | Roles | Frontend page | Route file | Service | Test |
|---|---|---|---|---|---|---|
| GET | `/api/v1/partner/profile` | affiliate | `frontend/src/app/partner/profile/page.tsx` | `backend/src/routes/partner.routes.js` | `backend/src/services/partner.service.js` | `backend/tests/integration/manager-assignment.test.js`, `backend/tests/integration/questionnaires.test.js` |
| PATCH | `/api/v1/partner/profile` | affiliate | `frontend/src/app/partner/profile/page.tsx` | `backend/src/routes/partner.routes.js` | `backend/src/services/profile.service.js` | TODO: tests |

## Detailed endpoints

## GET /api/v1/partner/offers

### Назначение

Возвращает список офферов, видимых текущему affiliate, с учётом visibility, hidden affiliates, pending/rejected requests и questionnaire gate.

### Роли

- `affiliate`

### Query params

| Param | Type | Required | Description |
|---|---|---|---|
| `category` | `string` | Нет | Фильтр по категории. Валидируется через `validateOfferCategory(..., allowMissing: true)`. |

### Path params

Нет.

### Body

Нет.

### Response

- `200 OK`
- Возвращает массив offers.
- По тестам у offer присутствуют поля вида:
  - `accessLevel`
  - `availability`
  - `view.type`
  - `canRequestAccess`
  - `denyReason`
- `TODO: уточнить полный payload по service result`.

### Errors

| Code | Причина | Когда возникает |
|---|---|---|
| `401` + `AUTH_REQUIRED` | Not authenticated | Нет bearer token. |
| `403` + `FORBIDDEN` | User is not affiliate | Роль не `affiliate`. |
| `403` + `AFFILIATE_NOT_LINKED` | Affiliate not linked | В токене нет `affiliateId`. |
| `403` + `QUESTIONNAIRE_REQUIRED` | Questionnaire required | Партнёр не заполнил обязательную анкету. |
| `400` + `VALIDATION_ERROR` | Invalid filters | Некорректный `category`. |

### Used by frontend

| Frontend file / page | Как использует |
|---|---|
| `frontend/src/app/partner/page.tsx` | Главный список доступных offer’ов. |

### Backend files

| Файл | Назначение |
|---|---|
| `backend/src/routes/partner.routes.js` | Route `/offers`. |
| `backend/src/validators/offers.js` | `validateOfferCategory`. |
| `backend/src/services/partner.service.js` | `listPartnerOffers()`. |
| `backend/src/middleware/requireQuestionnaireCompletion.js` | Доступ только после completion. |

### Tests

| Test file | Что проверяет |
|---|---|
| `backend/tests/integration/critical-path.test.js` | Visibility/access behavior для public/on-request offers. |
| `backend/tests/integration/offer-visibility-stage7.test.js` | Hidden/private visibility cases. |
| `backend/tests/integration/questionnaires.test.js` | Questionnaire gate перед offers list. |

## GET /api/v1/partner/offers/:id

### Назначение

Детальная карточка одного offer для текущего affiliate.

### Роли

- `affiliate`

### Query params

Нет.

### Path params

| Param | Type | Required | Description |
|---|---|---|---|
| `id` | `uuid` | Да | ID offer. |

### Body

Нет.

### Response

- `200 OK`
- Возвращает `{ offer }`.
- Полный payload зависит от access level. `TODO: уточнить подробную схему`.

### Errors

| Code | Причина | Когда возникает |
|---|---|---|
| `400` + `VALIDATION_ERROR` | Invalid offer id | `id` не UUID. |
| `403` + `QUESTIONNAIRE_REQUIRED` | Questionnaire required | Анкета не завершена. |
| `404` | Offer not found | Offer не найден. TODO: уточнить точный error code. |
| `403` | Offer not available / access required | Offer скрыт или недоступен текущему affiliate. TODO: уточнить distinction по code. |

### Used by frontend

| Frontend file / page | Как использует |
|---|---|
| `frontend/src/app/partner/offers/[offerId]/page.tsx` | Страница offer detail и CTA request access. |

### Backend files

| Файл | Назначение |
|---|---|
| `backend/src/routes/partner.routes.js` | Route `/offers/:id`. |
| `backend/src/services/partner.service.js` | `getPartnerOfferDetails()`. |
| `backend/src/validators/offers.js` | `validateUuid`. |

### Tests

| Test file | Что проверяет |
|---|---|
| `backend/tests/integration/critical-path.test.js` | Доступ после approve request. |
| `backend/tests/integration/offer-visibility-stage7.test.js` | Private/on-request detail visibility. |

## POST /api/v1/partner/offers/:id/request

### Назначение

Создаёт request на доступ к offer для affiliate.

### Роли

- `affiliate`

### Query params

Нет.

### Path params

| Param | Type | Required | Description |
|---|---|---|---|
| `id` | `uuid` | Да | ID offer. |

### Body

| Field | Type | Required | Description |
|---|---|---|---|
| `message` | `string \| null` | Нет | Сообщение/комментарий к заявке. |

### Response

- `201 Created`
- Возвращает `{ request }`.

### Errors

| Code | Причина | Когда возникает |
|---|---|---|
| `400` + `VALIDATION_ERROR` | Invalid offer id/body | Некорректный `id` или payload. |
| `403` + `QUESTIONNAIRE_REQUIRED` | Questionnaire required | Анкета не завершена. |
| `404` | Offer not found | Offer не найден. |
| `409` | Access request already exists | Повторная заявка в pending/processed state. TODO: уточнить code/message. |
| `409` | Offer not available for request | Для public/private case заявка недопустима. TODO: уточнить code/message. |

### Used by frontend

| Frontend file / page | Как использует |
|---|---|
| `frontend/src/app/partner/offers/[offerId]/page.tsx` | Кнопка `request access`. |

### Backend files

| Файл | Назначение |
|---|---|
| `backend/src/routes/partner.routes.js` | Route request access. |
| `backend/src/validators/offerRequests.js` | `validateOfferRequestPayload`. |
| `backend/src/services/offer-requests.service.js` | `requestOfferAccess()`. |

### Tests

| Test file | Что проверяет |
|---|---|
| `backend/tests/integration/critical-path.test.js` | Request -> admin decision flow. |
| `backend/tests/integration/offer-visibility-stage7.test.js` | Request logic для разных visibility modes. |

## Tracking link generation

### Назначение

Отдельного backend endpoint для генерации tracking link не найдено. Текущий frontend строит ссылку сам.

### Роли

- `affiliate`

### Query params

Нет.

### Path params

Нет.

### Body

Нет.

### Response

`TODO: endpoint не найден.` На текущем этапе tracking link формируется во frontend на основе `affiliateId`, `offerId` и base tracking URL.

### Used by frontend

| Frontend file / page | Как использует |
|---|---|
| `frontend/src/app/partner/page.tsx` | Показывает tracking link в списке offers. |
| `frontend/src/app/partner/offers/[offerId]/page.tsx` | Показывает/copy tracking link на странице offer detail. |
| `frontend/src/lib/tracking.ts` | Утилита сборки tracking URL. |

## GET /api/v1/partner/clicks

### Назначение

Личный список кликов текущего affiliate.

### Роли

- `affiliate`

### Query params

| Param | Type | Required | Description |
|---|---|---|---|
| `limit` | `number` | Нет | Pagination limit, default `20`. |
| `offset` | `number` | Нет | Pagination offset, default `0`. |

### Path params

Нет.

### Body

Нет.

### Response

- `200 OK`
- Возвращает массив clicks.
- Meta подтверждена:

```json
{
  "total": 0,
  "limit": 20,
  "offset": 0
}
```

По frontend типам подтверждены поля item:

```json
{
  "clickId": "string",
  "offerId": "uuid",
  "sub1": null,
  "device": "mobile",
  "createdAt": "2026-05-25T00:00:00.000Z"
}
```

### Errors

| Code | Причина | Когда возникает |
|---|---|---|
| `401` | Not authenticated | Нет токена. |
| `403` | User is not affiliate | Неверная роль. |
| `403` + `QUESTIONNAIRE_REQUIRED` | Questionnaire required | Анкета не завершена. |
| `400` + `VALIDATION_ERROR` | Invalid pagination | Некорректный `limit` / `offset`. |

### Used by frontend

| Frontend file / page | Как использует |
|---|---|
| `frontend/src/app/partner/clicks/page.tsx` | Таблица partner clicks. |
| `frontend/src/lib/partner.ts` | `fetchPartnerClicks()`. |

### Backend files

| Файл | Назначение |
|---|---|
| `backend/src/routes/partner.routes.js` | Route `/clicks`. |
| `backend/src/validators/stats.js` | `validatePartnerClicksQuery`. |
| `backend/src/services/partner.service.js` | `listPartnerClicks()`. |

### Tests

| Test file | Что проверяет |
|---|---|
| TODO: добавить/уточнить tests. |

## GET /api/v1/partner/conversions

### Назначение

Личный список conversion’ов текущего affiliate.

### Роли

- `affiliate`

### Query params

| Param | Type | Required | Description |
|---|---|---|---|
| `limit` | `number` | Нет | Pagination limit. |
| `offset` | `number` | Нет | Pagination offset. |
| `status` | `string` | Нет | Фильтр по статусу. |

### Path params

Нет.

### Body

Нет.

### Response

По frontend типам подтверждены поля item:

```json
{
  "clickId": "string",
  "status": "approved",
  "payoutRub": 100,
  "createdAt": "2026-05-25T00:00:00.000Z"
}
```

### Errors

| Code | Причина | Когда возникает |
|---|---|---|
| `401` | Not authenticated | Нет токена. |
| `403` | User is not affiliate | Неверная роль. |
| `403` + `QUESTIONNAIRE_REQUIRED` | Questionnaire required | Анкета не завершена. |
| `400` + `VALIDATION_ERROR` | Invalid filters | Некорректный статус или pagination. |

### Used by frontend

| Frontend file / page | Как использует |
|---|---|
| `frontend/src/app/partner/conversions/page.tsx` | Таблица partner conversions. |
| `frontend/src/lib/partner.ts` | `fetchPartnerConversions()`. |

### Backend files

| Файл | Назначение |
|---|---|
| `backend/src/routes/partner.routes.js` | Route `/conversions`. |
| `backend/src/validators/stats.js` | `validatePartnerConversionsQuery`. |
| `backend/src/services/partner.service.js` | `listPartnerConversions()`. |

### Tests

| Test file | Что проверяет |
|---|---|
| TODO: добавить/уточнить tests. |

## GET /api/v1/partner/stats

### Назначение

Dashboard summary для партнёра.

### Роли

- `affiliate`

### Query params

Нет.

### Path params

Нет.

### Body

Нет.

### Response

`TODO: уточнить полную схему.` По UI и типам stats участвуют клики, conversion counts, revenue/payout/profit.

### Errors

| Code | Причина | Когда возникает |
|---|---|---|
| `401` | Not authenticated | Нет токена. |
| `403` | User is not affiliate | Неверная роль. |
| `403` + `QUESTIONNAIRE_REQUIRED` | Questionnaire required | Анкета не завершена. |

### Used by frontend

| Frontend file / page | Как использует |
|---|---|
| `frontend/src/app/partner/page.tsx` | Summary cards. |
| `frontend/src/app/partner/stats/page.tsx` | Отдельная stats page. |

### Backend files

| Файл | Назначение |
|---|---|
| `backend/src/routes/partner.routes.js` | Route `/stats`. |
| `backend/src/services/partner.service.js` | `getPartnerStatsSummary()`. |

### Tests

| Test file | Что проверяет |
|---|---|
| `backend/tests/integration/critical-path.test.js` | Базовый partner journey после login. |

## Связанные разделы

- [Affiliates domain](../domains/affiliates.md)
- [Offers domain](../domains/offers.md)
- [Offer access domain](../domains/offer-access.md)
- [Tracking clicks domain](../domains/tracking-clicks.md)
- [Postbacks and conversions domain](../domains/postbacks-conversions.md)
- [Stats domain](../domains/stats.md)
