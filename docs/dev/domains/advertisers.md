# Рекламодатели

Статус: draft

## Назначение

Домен описывает advertiser profile/entity, admin CRUD, advertiser cabinet, manager assignment, доступ к собственным offers/postbacks/stats/finance и связь advertiser с user.

## Основные пользовательские сценарии

- администратор создаёт advertiser и связанный user с временным паролем;
- администратор редактирует advertiser, internal note и manager assignment;
- администратор сбрасывает пароль advertiser user;
- advertiser логинится и смотрит профиль, свои offers, postbacks, stats и finance;
- advertiser заполняет обязательную анкету перед доступом к большинству advertiser routes.

## Frontend files

| Файл / папка | Назначение |
|---|---|
| `frontend/src/app/dashboard/advertisers/page.tsx` | admin/manager список advertisers |
| `frontend/src/app/dashboard/advertisers/create/page.tsx` | создание advertiser |
| `frontend/src/app/dashboard/advertisers/[id]/edit/page.tsx` | редактирование advertiser, manager, internal note, password reset |
| `frontend/src/app/advertiser/page.tsx` | advertiser dashboard |
| `frontend/src/app/advertiser/profile/page.tsx` | advertiser profile + telegram + change password |
| `frontend/src/app/advertiser/offers/page.tsx` | advertiser offer list |
| `frontend/src/app/advertiser/offers/[offerId]/page.tsx` | advertiser offer detail |
| `frontend/src/app/advertiser/postbacks/page.tsx` | advertiser postback log list |
| `frontend/src/app/advertiser/postbacks/[postbackId]/page.tsx` | advertiser postback log detail |
| `frontend/src/app/advertiser/stats/page.tsx` | advertiser stats summary/breakdowns |
| `frontend/src/app/advertiser/finance/page.tsx` | advertiser finance summary/breakdowns |
| `frontend/src/app/advertiser/questionnaire/page.tsx` | advertiser questionnaire |
| `frontend/src/lib/advertiser.api.ts` | API client для advertiser profile/offers/postbacks/stats/finance |

## Backend routes

| Route / файл | Назначение | Роли |
|---|---|---|
| `POST /api/v1/advertisers` (`backend/src/routes/advertisers.js`) | создать advertiser + user + temporary password | `admin` |
| `GET /api/v1/advertisers` (`backend/src/routes/advertisers.js`) | список advertisers | `admin`, `manager` |
| `GET /api/v1/advertisers/:id` (`backend/src/routes/advertisers.js`) | detail advertiser | `admin`, `manager` |
| `PATCH /api/v1/advertisers/:id` (`backend/src/routes/advertisers.js`) | update advertiser | `admin`, `manager` |
| `PATCH /api/v1/advertisers/:id/manager` (`backend/src/routes/advertisers.js`) | назначить manager | `admin`, `manager` |
| `PATCH /api/v1/advertisers/:id/internal-note` (`backend/src/routes/advertisers.js`) | update internal note | `admin`, `manager` |
| `POST /api/v1/advertisers/:id/reset-password` (`backend/src/routes/advertisers.js`) | сбросить пароль advertiser user | `admin` |
| `GET /api/v1/advertiser/profile` (`backend/src/routes/advertiser-self.routes.js`) | профиль текущего advertiser | `advertiser` |
| `PATCH /api/v1/advertiser/profile` (`backend/src/routes/advertiser-self.routes.js`) | update telegram/timezone | `advertiser` |
| `GET /api/v1/advertiser/offers` (`backend/src/routes/advertiser-offers.routes.js`) | список офферов advertiser | `advertiser` |
| `GET /api/v1/advertiser/offers/:offerId` (`backend/src/routes/advertiser-offers.routes.js`) | detail оффера advertiser | `advertiser` |
| `GET /api/v1/advertiser/postbacks` (`backend/src/routes/advertiser-postbacks.routes.js`) | список postback logs advertiser | `advertiser` |
| `GET /api/v1/advertiser/postbacks/:postbackId` (`backend/src/routes/advertiser-postbacks.routes.js`) | detail postback log | `advertiser` |
| `GET /api/v1/advertiser/stats/summary|breakdowns|offers/:offerId` (`backend/src/routes/advertiser-stats.routes.js`) | advertiser analytics | `advertiser` |
| `GET /api/v1/advertiser/finance/summary|breakdowns` (`backend/src/routes/advertiser-finance.routes.js`) | advertiser finance analytics | `advertiser` |

## Validators

| Файл / схема | Что валидирует |
|---|---|
| `backend/src/validators/advertisers.js#validateCreateAdvertiserDto` | создание advertiser |
| `backend/src/validators/advertisers.js#validateUpdateAdvertiserDto` | update advertiser |
| `backend/src/validators/advertisers.js#validateAssignAdvertiserManagerDto` | manager assignment |
| `backend/src/validators/advertisers.js#validateAdvertiserListFilters` | admin list filters |
| `backend/src/validators/advertisers.js#validateUpdateAdvertiserInternalNoteDto` | internal note |
| `backend/src/validators/advertiserOffers.js` | filters advertiser offers |
| `backend/src/validators/advertiserPostbacks.js` | filters advertiser postbacks |
| `backend/src/validators/advertiserFinance.js` | finance filters |
| `backend/src/validators/stats.js#validateAdvertiserStatsFilters` | advertiser stats filters |
| `backend/src/validators/stats.js#validateAdvertiserOfferStatsFilters` | offer-specific advertiser stats |

## Services

| Service / файл | Ответственность |
|---|---|
| `backend/src/services/advertisers.service.js` | advertiser admin CRUD, temp password, manager assignment |
| `backend/src/services/advertisers/advertiser-profile.service.js` | advertiser self profile lookup |
| `backend/src/services/advertisers/advertiser-offers.service.js` | list/detail офферов advertiser |
| `backend/src/services/advertisers/advertiser-postbacks.service.js` | list/detail postback logs advertiser |
| `backend/src/services/advertisers/advertiser-stats.service.js` | advertiser stats summary/breakdowns |
| `backend/src/services/advertisers/advertiser-finance.service.js` | advertiser finance summary/breakdowns |
| `backend/src/services/advertisers/advertiser-context.service.js` | resolveAdvertiserIdFromUser, offer ownership checks |
| `backend/src/services/profile.service.js` | telegram/timezone self-update |

## Models / repositories

| Model / repository / файл | Ответственность |
|---|---|
| `backend/src/models/advertiserModel.js` | CRUD/select/filter advertisers |
| `backend/src/models/userModel.js` | advertiser-linked user |
| `backend/src/models/offers.model.js` | offers by advertiser |
| `backend/src/models/postback-logs.model.js` | advertiser-facing postback log data |
| `backend/src/models/stats-aggregator.model.js` | advertiser stats/finance aggregates |

## Database tables

| Таблица | Назначение | Важные связи |
|---|---|---|
| `advertisers` | advertiser entity | `user_id`, `manager_user_id`, `status`, `telegram`, `internal_note`, `public_id_number` |
| `users` | advertiser login account | `role='advertiser'` |
| `offers` | offers конкретного advertiser | `advertiser_id -> advertisers.id` |
| `postback_logs` | журнал postback-ов | `offer_id -> offers.id`, advertiser определяется через offer |
| `conversions` | conversion snapshots advertiser | `offer_id`, `goal_id`, payout/revenue |
| `daily_stats` | advertiser rollups | `advertiser_id` |
| `registration_questionnaire_answers` | ответы advertiser questionnaire | `user_id + target_role unique` |
| `audit_events` | аудит create/update/reset password/manager changes | actor/context |

## Main data flow

```txt
Admin create advertiser
  -> POST /api/v1/advertisers
  -> validateCreateAdvertiserDto
  -> advertisers.service.createAdvertiser
  -> userModel.createUser(role='advertiser')
  -> advertiserModel.createAdvertiser
  -> audit_events
  -> temporaryPassword in response

Advertiser cabinet
  -> authenticate + authorizeRole('advertiser')
  -> requireQuestionnaireCompletion on offers/postbacks/stats/finance
  -> advertiser-* services
  -> offers/postback_logs/stats_aggregator data
```

## Permissions / roles

- `admin` создаёт advertiser и сбрасывает пароль.
- `admin` и `manager` видят admin CRUD/list/detail advertisers.
- `advertiser` видит только собственные данные через `resolveAdvertiserIdFromUser`.
- Cross-role access на advertiser self routes запрещён; это подтверждено integration tests.
- Ownership на offer/postback/stats/finance проверяется через advertiser context service и `offer.advertiser_id`.

## Edge cases

- advertiser не связан с user -> profile/auth context возвращает 404;
- advertiser inactive -> в кабинет логин возможен, но продуктовые ограничения зависят от конкретного домена. TODO: уточнить, есть ли runtime-block на `status=inactive` для self routes;
- advertiser не видит чужой offer/postback -> 404 по ownership check;
- reset password для advertiser без `user_id` -> `CONFLICT`;
- postback от неизвестного advertiser напрямую не хранится как advertiser сущность: ownership идёт через `offer_id`; неизвестный token/offer обрабатывается postback доменом;
- advertiser без анкеты -> `QUESTIONNAIRE_REQUIRED` на offers/postbacks/stats/finance.

## Known limitations

- Advertiser cabinet read-only для offers/postbacks/stats/finance; edit/postback configuration выполняется не из advertiser self routes.
- Нет отдельного advertiser UI для управления goal/access/geo.
- Runtime-блокировка по `advertisers.status` в self routes кодом явно не подтверждена. TODO: уточнить бизнес-ожидание.

## Tests

| Тест | Что проверяет |
|---|---|
| `backend/tests/integration/advertiser-foundation.test.js` | advertiser auth, `/auth/me`, `/advertiser/profile` |
| `backend/tests/integration/advertiser-security.test.js` | запрет доступа advertiser к admin routes |
| `backend/tests/integration/advertiser-offers.test.js` | advertiser offers list/detail |
| `backend/tests/integration/advertiser-postbacks.test.js` | advertiser postback logs |
| `backend/tests/integration/advertiser-stats.test.js` | advertiser stats |
| `backend/tests/integration/advertiser-finance.test.js` | advertiser finance |
| `backend/tests/integration/manager-assignment.test.js` | manager assignment advertiser |
| `backend/tests/integration/questionnaires.test.js` | advertiser questionnaire |

## Связанные разделы

- [Users](./users.md)
- [Offers](./offers.md)
- [Postbacks and Conversions](./postbacks-conversions.md)
- [Stats](./stats.md)
- [Finance](./finance.md)
