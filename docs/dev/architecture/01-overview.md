# Обзор архитектуры

Статус: draft

## Назначение

Этот документ даёт верхнеуровневую карту проекта: из каких частей состоит система, как связаны frontend, backend, database и async processing, и где в коде искать нужный слой.

## Общая схема

```txt
User browser
  -> Next.js frontend (`frontend/`)
  -> Backend API (`backend/src/app.js`, prefix `/api/v1`)
  -> PostgreSQL (`backend/src/db.js`)

Tracking link
  -> Tracking endpoint (`/track/click`)
  -> Click validation + offer/access/GEO logic
  -> Click storage (`backend/src/models/clicks.model.js`)
  -> Redirect

Advertiser postback
  -> Postback endpoint (`backend/src/routes/tracking.routes.js`)
  -> Postback validation
  -> Conversion storage (`backend/src/models/conversions.model.js`)
  -> Postback log (`backend/src/models/postback-logs.model.js`)
  -> Async rollup / stats update
```

Текущая реализация частично отличается от ожидаемой архитектуры из задания:

- frontend действительно на Next.js;
- database действительно PostgreSQL;
- Redis и BullMQ действительно используются;
- deploy через Docker Compose и Nginx ожидается по структуре `docs/dev/infra`, `.env` и `services/nginx`, но этот документ опирается в основном на runtime-код `frontend/` и `backend/`;
- backend в текущем коде построен на `Express`, а не на `Fastify`.

## Основные части системы

| Часть | Технология | Назначение | Где искать |
|---|---|---|---|
| Frontend | Next.js 16, React 19, TypeScript | Кабинеты admin/manager, affiliate, advertiser и публичная landing page | `frontend/`, `frontend/src/app`, `frontend/src/components`, `frontend/src/lib` |
| Backend API | Node.js, Express, ES modules | HTTP API, tracking, postback handling, auth, бизнес-логика | `backend/src/app.js`, `backend/src/routes`, `backend/src/services` |
| Database | PostgreSQL, `pg` | Хранение пользователей, офферов, кликов, конверсий, статистики и аудита | `backend/src/db.js`, `backend/src/models`, `backend/migrations` |
| Redis | Redis | Rate limit storage, queue backend, readiness dependency | `backend/src/lib/redis.js`, `backend/src/lib/redis.config.js`, `backend/src/middleware/rateLimit.js` |
| Queue | BullMQ | Async jobs для click/conversion events и stats rollup | `backend/src/lib/queue.js`, `backend/src/queue`, `backend/src/workers` |
| Nginx | TODO: уточнить по runtime-конфигу | Reverse proxy и внешняя маршрутизация | `services/nginx`, `docs/dev/infra/nginx.md` |
| Docker Compose | TODO: уточнить по compose файлам | Локальный/staging запуск | `docs/dev/infra/docker-compose.md`, `.env`, `README.md` |

## Главные домены

### Auth

Аутентификация по JWT access token + refresh token cookie, регистрация и refresh сессии.

Где искать:

- `backend/src/routes/auth.js`
- `backend/src/middleware/auth.js`
- `backend/src/models/refreshTokenModel.js`
- `backend/src/services/auth`
- `frontend/src/context/AuthContext.tsx`

### Users

Базовая сущность пользователя, роль, профиль, смена пароля и персональные поля.

Где искать:

- `backend/src/models/userModel.js`
- `backend/src/services/users.service.js`
- `backend/src/services/profile.service.js`
- `backend/src/routes/users.routes.js`

### Affiliates

Партнёры, их кабинет, привязка к user, профиль и офферная доступность.

Где искать:

- `backend/src/models/affiliateModel.js`
- `backend/src/services/affiliates.service.js`
- `backend/src/routes/affiliates.js`
- `frontend/src/app/partner`

### Advertisers

Рекламодатели, их кабинет, профиль, офферы, postback logs и finance views.

Где искать:

- `backend/src/models/advertiserModel.js`
- `backend/src/services/advertisers.service.js`
- `backend/src/services/advertisers`
- `backend/src/routes/advertisers.js`
- `backend/src/routes/advertiser-*.routes.js`
- `frontend/src/app/advertiser`

### Managers

Роль manager в admin area, назначение ответственных менеджеров и часть операций админки.

Где искать:

- `backend/src/services/managers.service.js`
- `backend/src/routes/admin-managers.routes.js`
- `backend/migrations/1737000000000_add_manager_role_to_users.js`
- `backend/migrations/1737100000000_add_responsible_manager_links.js`

### Offers

Офферы, их карточки, параметры, visibility и advertiser ownership.

Где искать:

- `backend/src/models/offers.model.js`
- `backend/src/services/offers.service.js`
- `backend/src/routes/offers.routes.js`
- `backend/src/routes/advertiser-offers.routes.js`
- `frontend/src/lib/offers.ts`

### Offer goals

Цели оффера, goal-aware postback logic и финансовые поля revenue/payout.

Где искать:

- `backend/src/models/offerGoals.model.js`
- `backend/src/models/offerGoalAffiliateRates.model.js`
- `backend/src/services/offer-goals.service.js`
- `backend/src/routes/admin-offer-goals.routes.js`

### Offer access

Доступ партнёров к офферам, заявки, white/black visibility и access rules.

Где искать:

- `backend/src/models/offerAffiliateAccess.model.js`
- `backend/src/models/offerRequests.model.js`
- `backend/src/models/offerAffiliateHidden.model.js`
- `backend/src/services/offer-affiliate-access.service.js`
- `backend/src/services/offer-requests.service.js`
- `backend/src/services/offer-affiliate-hidden.service.js`

### Geo targeting

Geo rules офферов, определение страны запроса и выбор redirect outcome.

Где искать:

- `backend/src/models/offerGeoRules.model.js`
- `backend/src/services/offer-geo-rules.service.js`
- `backend/src/lib/detectRequestCountry.js`
- `backend/src/lib/resolveOfferGeoAccess.js`

### Tracking clicks

Приём tracking URL, антидубль, определение device/country, запись click и redirect.

Где искать:

- `backend/src/routes/tracking.routes.js`
- `backend/src/services/tracking`
- `backend/src/models/clicks.model.js`
- `backend/src/models/clickDedupRegistry.model.js`

### Postbacks

Приём advertiser postback, валидация, логирование и связка с conversion pipeline.

Где искать:

- `backend/src/routes/tracking.routes.js`
- `backend/src/services/postback/conversions.service.js`
- `backend/src/models/postback-logs.model.js`

### Conversions

Конверсии, статусы, duplicate checks, goal snapshots и ручные корректировки.

Где искать:

- `backend/src/models/conversions.model.js`
- `backend/src/services/conversions.service.js`
- `backend/src/services/postback/conversions.service.js`
- `backend/src/routes/conversions.routes.js`

### Adjustments

Ручные корректировки click/conversion данных, adjustment batches и audit trail.

Где искать:

- `backend/src/models/manualAdjustmentBatches.model.js`
- `backend/src/services/adjustments.service.js`
- `backend/src/routes/admin-adjustments.routes.js`

### Stats

Дневные агрегаты, admin summary, advertiser stats, partner stats и rollup jobs.

Где искать:

- `backend/src/models/daily-stats.model.js`
- `backend/src/models/stats-aggregator.model.js`
- `backend/src/services/stats`
- `backend/src/routes/stats.routes.js`
- `backend/src/routes/admin-stats.routes.js`
- `backend/src/routes/advertiser-stats.routes.js`

### Questionnaires

Анкеты для ролей affiliate/advertiser, блокировка кабинета до completion и админское управление.

Где искать:

- `backend/src/models/registrationQuestionnaires.model.js`
- `backend/src/models/registrationQuestionnaireAnswers.model.js`
- `backend/src/services/questionnaires.service.js`
- `backend/src/middleware/requireQuestionnaireCompletion.js`
- `frontend/src/components/questionnaires/UserQuestionnairePage.tsx`

### Audit

Audit events по административным и доменным действиям.

Где искать:

- `backend/src/models/auditEvents.model.js`
- `backend/src/services/audit.service.js`
- `backend/src/routes/admin-audit-logs.routes.js`

### Finance

Финансовые поля конверсий и advertiser finance представления.

Где искать:

- `backend/src/services/advertisers/advertiser-finance.service.js`
- `backend/src/routes/advertiser-finance.routes.js`
- `backend/src/models/conversions.model.js`
- `backend/src/models/offerGoalAffiliateRates.model.js`

## Основной backend flow

```txt
HTTP request
  -> route
  -> validation
  -> service
  -> model
  -> database
  -> response
```

В текущем проекте этот flow реализован так:

- route находится в `backend/src/routes` и принимает HTTP-запрос;
- validation вынесена в `backend/src/validators`;
- service в `backend/src/services` реализует бизнес-правила;
- model в `backend/src/models` содержит SQL и преобразование row -> domain object;
- database connection создаётся в `backend/src/db.js`;
- response формируется через `sendSuccess(...)` и единый error handler.

Исключения есть, но общий pattern именно такой. Например, `auth.js` частично обращается к models напрямую, но даже там ключевые куски доменной логики вынесены в `services/auth`, `services/affiliates.service.js` и `services/advertisers.service.js`.

## Основной frontend flow

```txt
app page
  -> page component
  -> shared/components
  -> lib/api clients
  -> backend
  -> auth context / state
```

В текущем проекте:

- страницы лежат в `frontend/src/app`;
- section layouts для ролей лежат рядом с route tree: `dashboard/layout.tsx`, `partner/layout.tsx`, `advertiser/layout.tsx`;
- общие компоненты лежат в `frontend/src/components`;
- API-клиенты и helpers лежат в `frontend/src/lib`;
- auth/session state живёт в `frontend/src/context/AuthContext.tsx`;
- role-based redirects и page guards реализованы в layout'ах и в `frontend/src/components/AppNavbar.tsx`.

## Основные runtime-потоки

### Обычный API-запрос

```txt
Frontend action
  -> API client
  -> Backend route
  -> Service
  -> Database
  -> Response
  -> UI update
```

На frontend вызов обычно идёт через `apiFetch` из `frontend/src/lib/api.ts`. На backend запрос попадает в `backend/src/routes/...`, проходит `authenticate` и validator, затем service обращается к model, а UI обновляется после получения JSON envelope.

### Tracking click

```txt
User opens tracking URL
  -> tracking endpoint
  -> click validation
  -> offer/access/GEO checks
  -> click creation
  -> redirect
```

Реальная точка входа: `/track/click` в `backend/src/routes/tracking.routes.js`. Дальше используются `validateTrackingQuery`, `detectRequestCountry`, `detectDevice`, `services/tracking/clicks.service.js`, дедупликация кликов и вычисление redirect URL.

### Postback

```txt
Advertiser sends postback
  -> postback endpoint
  -> validate params
  -> resolve click / offer / goal
  -> create or update conversion
  -> stats / async events
```

Postback сейчас обрабатывается тем же `tracking.routes.js`. Сервис `services/postback/conversions.service.js` валидирует связь click/offer/goal, работает с `conversions`, пишет `postback_logs` и инициирует дальнейшие async updates.

### Async event

```txt
Domain event
  -> queue
  -> worker
  -> side effect / stats / logs
```

Очередь создаётся в `backend/src/lib/queue.js`. Worker jobs регистрируются в `backend/src/workers/registerJobs.js`; подтверждённые типы событий: `click_created`, `conversion_created`, `stats.rollup`.

### Daily stats rollup

```txt
Raw clicks/conversions
  -> aggregation job
  -> daily stats table
  -> dashboard/reporting
```

Rollup логика находится в `backend/src/services/stats/rollup.service.js`. Она запускается либо отдельным script `backend/src/scripts/run-daily-rollup.js`, либо worker job. Итог хранится в `daily_stats` и читается через `backend/src/models/daily-stats.model.js`.

## Где бизнес-логика

Основная бизнес-логика лежит в `backend/src/services`.

Ключевые папки и файлы:

- `backend/src/services/tracking` для click ingestion, dedupe и redirect logic;
- `backend/src/services/postback` для postback/conversion pipeline;
- `backend/src/services/stats` для rollup и stats summary;
- `backend/src/services/advertisers` для advertiser cabinet use cases;
- `backend/src/services/auth` для auth context и регистрации;
- плоские сервисы `adjustments.service.js`, `offer-goals.service.js`, `questionnaires.service.js`, `users.service.js` для остальных доменов.

## Где просто SQL / data access

Слой доступа к данным расположен в `backend/src/models`.

Это не ORM-entities, а прикладные модели с raw SQL через `pg`. Типичный паттерн:

- модель строит SQL;
- вызывает `pool.query(...)` или client query;
- нормализует row в объект ответа;
- service выше использует эту модель как data access layer.

## Где валидация

Валидация входных данных сосредоточена в `backend/src/validators`.

Подтверждённые группы:

- `tracking.js`
- `postback.js`
- `stats.js`
- `offers.js`
- `offerGoals.js`
- `offerGeoRules.js`
- `offerAffiliateAccess.js`
- `advertiserPostbacks.js`
- `users.js`

В проекте используется собственный набор validator functions, а не отдельная внешняя schema library вроде Zod или Joi.

## Где права доступа

Проверки ролей и доступов распределены по middleware и role helpers:

- `backend/src/middleware/auth.js` проверяет JWT;
- `backend/src/middleware/authorizeRole.js` проверяет принадлежность к роли;
- `backend/src/middleware/accessControl.js` определяет admin-only и admin-area rules;
- `backend/src/middleware/requireQuestionnaireCompletion.js` ограничивает advertiser/affiliate разделы;
- frontend role redirects находятся в `frontend/src/lib/auth/routes.ts`, `frontend/src/lib/auth/roles.ts`, layout'ах и `AppNavbar.tsx`.

Ownership/access rules внутри доменов дополнительно проверяются в service layer, например в advertiser context и offer access логике.

## Что читать дальше

- [Frontend](./02-frontend.md)
- [Backend](./03-backend.md)
- [Database](./04-database.md)
