# Доступы к офферам

Статус: draft

## Назначение

Домен управляет visibility/access для affiliate: `public`, `on_request`, `private`, ручные allow/reject/exclude записи, скрытие offer, access requests и итоговый restricted/full/none view.

## Основные пользовательские сценарии

- affiliate видит public offers сразу;
- affiliate видит `on_request` offers как restricted и отправляет request;
- admin/manager approve/reject request;
- admin/manager вручную grant/revoke access;
- admin/manager скрывает offer от конкретного affiliate;
- tracking разрешает/запрещает click в зависимости от access state.

## Frontend files

| Файл / папка | Назначение |
|---|---|
| `frontend/src/app/dashboard/offers/[id]/edit/page.tsx` | access list, hidden affiliates, pending requests, approve/reject |
| `frontend/src/app/partner/offers/[offerId]/page.tsx` | restricted/full offer detail и request access |
| `frontend/src/lib/offers.ts` | admin access/hidden/request API client |
| `frontend/src/lib/partnerOffers.ts` | partner request access API client |

## Backend routes

| Route / файл | Назначение | Роли |
|---|---|---|
| `GET /api/v1/admin/offers/:offerId/access` (`backend/src/routes/admin-offer-access.routes.js`) | список access records | `admin`, `manager` |
| `POST /api/v1/admin/offers/:offerId/access` (`backend/src/routes/admin-offer-access.routes.js`) | grant access | `admin`, `manager` |
| `DELETE /api/v1/admin/offers/:offerId/access/:affiliateId` (`backend/src/routes/admin-offer-access.routes.js`) | revoke access | `admin`, `manager` |
| `GET /api/v1/admin/offers/:offerId/requests` (`backend/src/routes/admin-offer-access.routes.js`) | pending requests for offer | `admin`, `manager` |
| `POST /api/v1/admin/offers/:offerId/requests/:requestId/decision` (`backend/src/routes/admin-offer-access.routes.js`) | approve/reject request | `admin`, `manager` |
| `POST /api/v1/admin/offers/:offerId/hidden-affiliates` (`backend/src/routes/admin-offer-access.routes.js`) | hide offer from affiliate | `admin`, `manager` |
| `DELETE /api/v1/admin/offers/:offerId/hidden-affiliates/:affiliateId` (`backend/src/routes/admin-offer-access.routes.js`) | unhide | `admin`, `manager` |
| `POST /api/v1/partner/offers/:id/request` (`backend/src/routes/partner.routes.js`) | affiliate requests access | `affiliate` |

## Validators

| Файл / схема | Что валидирует |
|---|---|
| `backend/src/validators/offerAffiliateAccess.js#validateOfferAccessGrantPayload` | grant access |
| `backend/src/validators/offerAffiliateAccess.js#validateManualAccessPayload` | manual access set payload |
| `backend/src/validators/offerAffiliateAccess.js#validateOfferHidePayload` | hide payload |
| `backend/src/validators/offerRequests.js#validateOfferRequestPayload` | partner request message |
| `backend/src/validators/offerRequests.js#validateOfferRequestDecisionPayload` | admin approve/reject |
| `backend/src/validators/offers.js#validateUuid` | offerId/requestId/affiliateId |

## Services

| Service / файл | Ответственность |
|---|---|
| `backend/src/services/offer-affiliate-access.service.js` | grant/revoke/manual access, sync с pending requests |
| `backend/src/services/offer-affiliate-hidden.service.js` | hide/unhide affiliates for offer |
| `backend/src/services/offer-requests.service.js` | create request, list pending, review |
| `backend/src/services/offer-visibility.service.js` | вычисление combined visibility state |
| `backend/src/services/offers/affiliate-visibility.js` | превращение state в `none/restricted/full` |

## Models / repositories

| Model / repository / файл | Ответственность |
|---|---|
| `backend/src/models/offerAffiliateAccess.model.js` | upsert/delete/list access records |
| `backend/src/models/offerAffiliateHidden.model.js` | hidden affiliates storage |
| `backend/src/models/offerRequests.model.js` | pending/approved/rejected request records |
| `backend/src/models/offers.model.js` | visibility mode on offer |

## Database tables

| Таблица | Назначение | Важные связи |
|---|---|---|
| `offers` | хранит `visibility_mode` | `public`, `on_request`, `private` |
| `offer_affiliate_access` | allow/rejected/excluded records | `offer_id + affiliate_id unique`, `source` |
| `offer_affiliate_hidden` | скрытие offer от affiliate | `offer_id + affiliate_id unique`, `reason` |
| `offer_requests` | запросы доступа | `status`, `reviewed_by`, `reviewed_at`, pending unique |
| `audit_events` | аудит ручного доступа/hidden/request review | entity `offer_access` / `offer` |

## Main data flow

```txt
Partner opens offer list/detail
  -> partner.service
  -> offer-visibility.service
  -> offer_affiliate_access + offer_affiliate_hidden + offer_requests + offer.visibility_mode
  -> affiliate-visibility.js
  -> full / restricted / hidden response

Partner requests access
  -> POST /partner/offers/:id/request
  -> validateOfferRequestPayload
  -> offer-requests.service
  -> offer_requests table

Admin reviews request
  -> POST /admin/offers/:offerId/requests/:requestId/decision
  -> validate decision
  -> reviewOfferRequest
  -> update offer_requests
  -> optional access record update
```

## Permissions / roles

- affiliate может только запрашивать доступ к `on_request` offers.
- admin/manager управляют request review, access list и hidden list.
- `private` offer без `allowed` access полностью скрыт от affiliate.
- `on_request` offer без `allowed` access видим как restricted, если affiliate не hidden/rejected/excluded.
- tracking использует то же access state и блокирует click при отсутствии full access.

## Edge cases

- repeated access request -> pending unique index и 409;
- partner rejected -> denyReason `rejected`, повторный request запрещён;
- allow and hidden conflict -> hidden выигрывает, offer не доступен;
- private offer not visible -> partner detail 404;
- visible but tracking unavailable -> типично для `on_request` restricted view;
- stale access after offer visibility change частично нивелируется service-level checks, но существующие manual records остаются. TODO: уточнить, нужен ли batch cleanup;
- revoke access после approve request не удаляет history request, только текущее access state.

## Known limitations

- Нет отдельного allow-list/deny-list UI вне offer edit page.
- Домен использует комбинацию `offer_affiliate_access` и `offer_affiliate_hidden`; нужно учитывать обе таблицы при отладке.
- Поведение `excluded` vs `rejected` различается по denyReason, но требует чтения visibility service.

## Tests

| Тест | Что проверяет |
|---|---|
| `backend/tests/integration/offer-visibility-stage7.test.js` | public/on_request/private visibility, request flow, grant/revoke, hidden |
| `backend/tests/integration/critical-path.test.js` | tracking denial without access |

## Связанные разделы

- [Offers](./offers.md)
- [Affiliates](./affiliates.md)
- [Tracking Clicks](./tracking-clicks.md)
