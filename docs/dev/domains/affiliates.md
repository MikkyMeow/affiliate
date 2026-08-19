# Партнёры

Статус: draft

## Назначение

Домен описывает affiliate profile/entity, его связь с `users`, статусы, manager assignment, анкету, partner profile и участие в offer/click/conversion/stat flows.

## Основные пользовательские сценарии

- администратор создаёт affiliate вручную;
- администратор редактирует affiliate и внутреннюю заметку;
- admin/manager назначает ответственного manager на affiliate;
- администратор создаёт user для уже существующего affiliate;
- affiliate логинится в partner cabinet, смотрит профиль, офферы, клики, конверсии и статистику;
- tracking/postback разрешают affiliate по `affiliateId` и статусу.

## Frontend files

| Файл / папка | Назначение |
|---|---|
| `frontend/src/app/dashboard/affiliates/page.tsx` | admin/manager список партнёров |
| `frontend/src/app/dashboard/affiliates/create/page.tsx` | создание affiliate |
| `frontend/src/app/dashboard/affiliates/[id]/edit/page.tsx` | редактирование affiliate, internal note, manager, просмотр questionnaire answers |
| `frontend/src/app/partner/page.tsx` | affiliate dashboard |
| `frontend/src/app/partner/profile/page.tsx` | профиль affiliate |
| `frontend/src/app/partner/offers/[offerId]/page.tsx` | детальная карточка оффера для affiliate |
| `frontend/src/app/partner/clicks/page.tsx` | клики affiliate |
| `frontend/src/app/partner/conversions/page.tsx` | конверсии affiliate |
| `frontend/src/app/partner/stats/page.tsx` | статистика affiliate |
| `frontend/src/app/partner/questionnaire/page.tsx` | анкета affiliate |
| `frontend/src/lib/partner.ts` | клиент для `/partner/profile`, `/partner/clicks`, `/partner/conversions`, `/partner/stats` |
| `frontend/src/lib/partnerOffers.ts` | клиент для `/partner/offers`, request access |

## Backend routes

| Route / файл | Назначение | Роли |
|---|---|---|
| `POST /api/v1/affiliates` (`backend/src/routes/affiliates.js`) | создать affiliate | `admin`, `manager` |
| `GET /api/v1/affiliates` (`backend/src/routes/affiliates.js`) | список affiliates | `admin`, `manager` |
| `GET /api/v1/affiliates/:id` (`backend/src/routes/affiliates.js`) | detail affiliate | `admin`, `manager` |
| `PATCH /api/v1/affiliates/:id` (`backend/src/routes/affiliates.js`) | обновить affiliate | `admin`, `manager` |
| `PATCH /api/v1/affiliates/:id/manager` (`backend/src/routes/affiliates.js`) | назначить/unassign manager | `admin`, `manager` |
| `PATCH /api/v1/affiliates/:id/internal-note` (`backend/src/routes/affiliates.js`) | обновить internal note | `admin`, `manager` |
| `GET /api/v1/partner/profile` (`backend/src/routes/partner.routes.js`) | профиль текущего affiliate | `affiliate` |
| `PATCH /api/v1/partner/profile` (`backend/src/routes/partner.routes.js`) | обновить telegram/timezone affiliate | `affiliate` |
| `GET /api/v1/partner/clicks` (`backend/src/routes/partner.routes.js`) | список кликов affiliate | `affiliate` |
| `GET /api/v1/partner/conversions` (`backend/src/routes/partner.routes.js`) | список конверсий affiliate | `affiliate` |
| `GET /api/v1/partner/stats` (`backend/src/routes/partner.routes.js`) | summary stats affiliate | `affiliate` |

## Validators

| Файл / схема | Что валидирует |
|---|---|
| `backend/src/validators/affiliates.js#validateCreateAffiliateDto` | создание affiliate |
| `backend/src/validators/affiliates.js#validateUpdateAffiliateDto` | редактирование affiliate |
| `backend/src/validators/affiliates.js#validateAssignAffiliateManagerDto` | manager assignment |
| `backend/src/validators/affiliates.js#validateAffiliateListFilters` | фильтры списка affiliates |
| `backend/src/validators/affiliates.js#validateUpdateAffiliateInternalNoteDto` | internal note |
| `backend/src/validators/users.js#validateCreateAffiliateUserDto` | создание user для affiliate |
| `backend/src/validators/stats.js#validatePartnerClicksQuery` | пагинация partner clicks |
| `backend/src/validators/stats.js#validatePartnerConversionsQuery` | фильтры partner conversions |

## Services

| Service / файл | Ответственность |
|---|---|
| `backend/src/services/affiliates.service.js` | affiliate CRUD, manager assignment, questionnaire answers attach |
| `backend/src/services/users.service.js` | создание user и link к affiliate |
| `backend/src/services/partner.service.js` | partner-facing profile/offers/clicks/conversions/stats |
| `backend/src/services/profile.service.js` | self-update telegram/timezone |
| `backend/src/services/tracking/cache-invalidation.service.js` | инвалидация affiliate lookup cache после изменений |

## Models / repositories

| Model / repository / файл | Ответственность |
|---|---|
| `backend/src/models/affiliateModel.js` | CRUD/select/filter по affiliates |
| `backend/src/models/userModel.js` | user linkage для affiliate |
| `backend/src/models/offers.model.js` | partner offer selection через связанный visibility service |
| `backend/src/models/clicks.model.js` | partner clicks/admin clicks |
| `backend/src/models/conversions.model.js` | partner conversions |

## Database tables

| Таблица | Назначение | Важные связи |
|---|---|---|
| `affiliates` | основная affiliate entity | `user_id`, `manager_user_id`, `status`, `telegram`, `internal_note`, `public_id_number` |
| `users` | учётная запись affiliate | `users.role = 'affiliate'` |
| `offer_affiliate_access` | явные allow/reject/exclude правила по офферам | `affiliate_id -> affiliates.id` |
| `offer_affiliate_hidden` | скрытие оффера от affiliate | `offer_id + affiliate_id unique` |
| `offer_requests` | запросы доступа affiliate к офферам | `affiliate_id -> affiliates.id` |
| `clicks` | клики affiliate | `affiliate_id`, `source`, `goal_id` |
| `conversions` | конверсии affiliate | `affiliate_id`, `status`, payout/revenue snapshot |
| `daily_stats` | агрегаты по affiliate | `affiliate_id`, `offer_id`, `goal_id`, `advertiser_id`, `timezone` |
| `registration_questionnaire_answers` | ответы affiliate questionnaire | `user_id + target_role unique` |

## Main data flow

```txt
Admin affiliate management UI
  -> /api/v1/affiliates
  -> affiliate validators
  -> affiliates.service
  -> affiliateModel
  -> affiliates table

Partner cabinet
  -> /api/v1/partner/profile|offers|clicks|conversions|stats
  -> authenticate + authorizeRole('affiliate')
  -> requireQuestionnaireCompletion for most partner routes
  -> partner.service
  -> clicks/conversions/offers/daily_stats tables
```

## Permissions / roles

- admin и manager видят affiliate admin CRUD.
- manager может назначать manager на affiliate, но не управляет manager users.
- affiliate видит только собственный profile/data через `req.user.userId` и `req.user.affiliateId`.
- В `partner.routes.js` есть дополнительная проверка: если в JWT нет `affiliateId`, возвращается `AFFILIATE_NOT_LINKED`.
- Доступ affiliate к офферам/трекингу ограничивается `offer-visibility.service.js` и `affiliate-visibility.js`.

## Edge cases

- affiliate не найден -> 404;
- affiliate не связан с user -> self-profile/auth flows ломаются с 404;
- affiliate disabled/inactive -> tracking route возвращает conflict на клик;
- affiliate без заполненной анкеты -> `QUESTIONNAIRE_REQUIRED` на routes после `router.use(requireQuestionnaireCompletion())`;
- partner не видит private offer без access record;
- partner имеет индивидуальные ставки через `offer_goal_affiliate_rates`;
- manager assignment с non-manager user -> 422;
- duplicate affiliate email -> 409.

## Known limitations

- Отдельного advertiser-like finance UI для affiliate нет; финансовые показатели выводятся через stats/conversions. TODO: уточнить, нужен ли отдельный affiliate finance домен.
- Partner-facing routes дают summary/list data, но отдельного affiliate detail API для чужих записей нет и не должно быть.
- Нет явного soft-delete, только `status`.

## Tests

| Тест | Что проверяет |
|---|---|
| `backend/tests/integration/manager-assignment.test.js` | manager assignment, visible manager in affiliate detail/profile/auth context |
| `backend/tests/integration/auth-me.test.js` | affiliate linkage в auth context |
| `backend/tests/integration/offer-visibility-stage7.test.js` | partner visibility/access/request flow |
| `backend/tests/integration/offer-goals-stage8.test.js` | affiliate-specific goal rates в partner offer responses |
| `backend/tests/integration/critical-path.test.js` | базовый click/conversion flow с affiliate |
| `backend/tests/integration/questionnaires.test.js` | affiliate questionnaire completion |

## Связанные разделы

- [Users](./users.md)
- [Offer Access](./offer-access.md)
- [Tracking Clicks](./tracking-clicks.md)
- [Postbacks and Conversions](./postbacks-conversions.md)
- [Stats](./stats.md)
