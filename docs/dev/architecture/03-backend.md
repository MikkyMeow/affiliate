# Backend architecture

Статус: draft

## Назначение

Этот документ описывает текущий backend проекта: где объявлены routes, где лежат validators, services и models, как устроены auth и роли, где проходит tracking/postback flow и как работают очереди и rollup jobs.

## Технологии

Подтверждённые технологии по `backend/package.json` и коду:

- Node.js
- Express
- JavaScript ES modules
- PostgreSQL client `pg`
- `node-pg-migrate` для миграций
- Redis
- BullMQ
- `jsonwebtoken` для access token
- `bcryptjs` для паролей
- `express-rate-limit` и `rate-limit-redis`
- `prom-client` для метрик
- Vitest
- Supertest

Важно:

- backend в текущем проекте не Fastify, а Express;
- TypeScript на backend не используется;
- отдельная внешняя validation library не подтверждена, используются собственные validator functions в `backend/src/validators`.

## Где лежит backend

| Путь | Назначение |
|---|---|
| `backend/src` | Основной backend source |
| `backend/src/index.js` | HTTP bootstrap |
| `backend/src/app.js` | Express app, middleware и подключение route groups |
| `backend/src/routes` | HTTP routes |
| `backend/src/validators` | Validation layer |
| `backend/src/services` | Business logic |
| `backend/src/models` | Data access и SQL |
| `backend/src/middleware` | Auth, роли, error handling, rate limit, request logging |
| `backend/src/lib` | Redis, queue, metrics, helpers |
| `backend/src/queue` | Queue names и worker config |
| `backend/src/workers` | BullMQ job handlers и worker bootstrap |
| `backend/src/scripts` | CLI scripts |
| `backend/src/seed` | Seed/bootstrap data |
| `backend/src/db.js` | PostgreSQL pool и startup migration hook |
| `backend/migrations` | Migration files |
| `backend/tests` | Integration tests, fixtures, test setup |

## Основная структура backend

```txt
routes
  -> validators
  -> services
  -> models
  -> db
```

Общий pattern проекта:

- route принимает request и отвечает за HTTP wiring;
- validator нормализует и проверяет body/query/params;
- service реализует доменные правила;
- model содержит SQL и преобразование строк БД;
- `db.js` даёт `pg.Pool`.

Реализация не абсолютно строгая. Некоторые route handlers, особенно в auth, частично обращаются к models напрямую. Но для основных доменов tracking, stats, advertisers, questionnaires, adjustments и offers service layer выражен явно.

## Routes

Все route groups подключаются из `backend/src/app.js` под префиксом `/api/v1`, кроме tracking endpoint, который висит на `/track`.

| Route group | Path in project | Назначение |
|---|---|---|
| Auth | `backend/src/routes/auth.js` | register, login, refresh, logout, me, change-password |
| Advertisers base | `backend/src/routes/advertisers.js` | admin/system операции над advertisers |
| Affiliates | `backend/src/routes/affiliates.js` | admin/system операции над affiliates |
| Offers | `backend/src/routes/offers.routes.js` | офферы |
| Clicks | `backend/src/routes/clicks.routes.js` | click views/listing |
| Conversions | `backend/src/routes/conversions.routes.js` | conversions views/listing |
| Stats | `backend/src/routes/stats.routes.js` | admin summary, breakdowns, daily summary |
| Partner | `backend/src/routes/partner.routes.js` | partner cabinet API |
| Users | `backend/src/routes/users.routes.js` | user management/profile-related operations |
| Me questionnaire | `backend/src/routes/me-questionnaire.routes.js` | questionnaire status/answers для текущего пользователя |
| Advertiser self | `backend/src/routes/advertiser-self.routes.js` | advertiser cabinet self endpoints |
| Advertiser offers | `backend/src/routes/advertiser-offers.routes.js` | advertiser offer pages |
| Advertiser stats | `backend/src/routes/advertiser-stats.routes.js` | advertiser stats |
| Advertiser postbacks | `backend/src/routes/advertiser-postbacks.routes.js` | advertiser postback logs |
| Advertiser finance | `backend/src/routes/advertiser-finance.routes.js` | advertiser finance data |
| Admin stats | `backend/src/routes/admin-stats.routes.js` | admin dashboard/statistics |
| Admin offer requests | `backend/src/routes/admin-offer-requests.routes.js` | offer requests moderation |
| Admin offer access | `backend/src/routes/admin-offer-access.routes.js` | allowlist/access management |
| Admin offer goals | `backend/src/routes/admin-offer-goals.routes.js` | goal CRUD / management |
| Admin offer geo targeting | `backend/src/routes/admin-offer-geo-targeting.routes.js` | geo rules |
| Admin managers | `backend/src/routes/admin-managers.routes.js` | manager management |
| Admin adjustments | `backend/src/routes/admin-adjustments.routes.js` | manual adjustments |
| Admin postback logs | `backend/src/routes/admin-postback-logs.routes.js` | postback log review |
| Admin questionnaires | `backend/src/routes/admin-questionnaires.routes.js` | questionnaire management |
| Admin audit logs | `backend/src/routes/admin-audit-logs.routes.js` | audit log browsing |
| Tracking | `backend/src/routes/tracking.routes.js` | `/track/click`, postback handling, fallback redirect |

Как подключаются:

- middleware уровня приложения задаются в `createApp()` внутри `backend/src/app.js`;
- затем вызывается `app.use(...)` для каждой группы;
- route handlers обёрнуты через `asyncHandler(...)`, чтобы ошибки уходили в единый `errorHandler`.

## Validators

Validators лежат в `backend/src/validators`.

Подтверждённые файлы:

- `adjustments.js`
- `advertiserFilters.js`
- `advertiserFinance.js`
- `advertiserOffers.js`
- `advertiserPostbacks.js`
- `advertisers.js`
- `affiliates.js`
- `auditLogs.js`
- `offerAffiliateAccess.js`
- `offerGeoRules.js`
- `offerGoals.js`
- `offerRequests.js`
- `offers.js`
- `postback.js`
- `questionnaires.js`
- `stats.js`
- `tracking.js`
- `users.js`

Как это работает:

- validator function принимает raw request data;
- возвращает либо `dto/filter/pagination`, либо массив `errors`;
- route при наличии ошибок бросает `ApiError(...VALIDATION_ERROR...)`.

Отдельной JSON schema engine в текущем проекте нет.

## Services

Сервисный слой лежит в `backend/src/services`.

Крупные группы:

| Service / file | Domain | Responsibility |
|---|---|---|
| `services/auth/register.service.js` | auth | регистрация пользователя и связанного домена |
| `services/auth/auth-context.service.js` | auth | сбор auth context для `/auth/me` и `/profile` |
| `services/tracking/clicks.service.js` | tracking | click registration, redirect decisions |
| `services/tracking/click-dedup.service.js` | tracking | защита от duplicate clicks |
| `services/postback/conversions.service.js` | postback/conversions | обработка postback и создание conversion |
| `services/stats/rollup.service.js` | stats | пересчёт daily aggregates |
| `services/stats/stats.service.js` | stats | summary/breakdowns/reporting queries orchestration |
| `services/advertisers/advertiser-offers.service.js` | advertiser | advertiser offers use cases |
| `services/advertisers/advertiser-postbacks.service.js` | advertiser | advertiser postback log views |
| `services/advertisers/advertiser-stats.service.js` | advertiser | advertiser stats |
| `services/advertisers/advertiser-finance.service.js` | finance | advertiser finance views |
| `services/adjustments.service.js` | adjustments | manual adjustments workflow |
| `services/questionnaires.service.js` | questionnaires | анкеты и completion rules |
| `services/offer-goals.service.js` | offer goals | goal management |
| `services/offer-geo-rules.service.js` | geo targeting | geo rules management |
| `services/offer-affiliate-access.service.js` | offer access | allow/deny access rules |
| `services/offer-affiliate-hidden.service.js` | offer visibility | hidden offers per affiliate |
| `services/offers.service.js` | offers | offer management |
| `services/partner.service.js` | partner | partner cabinet operations |
| `services/managers.service.js` | managers | password changes and manager-related logic |
| `services/audit.service.js` | audit | audit event creation |

## Models / repositories

Слой data access находится в `backend/src/models`.

Это не ORM в привычном смысле, а прикладные SQL-модули:

- строят raw SQL;
- вызывают `pool.query(...)` или query на транзакционном client;
- нормализуют строки БД в API-friendly shape.

Подтверждённые модели по доменам:

- `userModel.js`, `refreshTokenModel.js`
- `affiliateModel.js`, `advertiserModel.js`
- `offers.model.js`, `offerGoals.model.js`, `offerGeoRules.model.js`
- `offerAffiliateAccess.model.js`, `offerAffiliateHidden.model.js`, `offerRequests.model.js`
- `clicks.model.js`, `clickDedupRegistry.model.js`
- `conversions.model.js`, `conversionStatusHistory.model.js`
- `postback-logs.model.js`
- `daily-stats.model.js`, `stats-aggregator.model.js`
- `manualAdjustmentBatches.model.js`
- `registrationQuestionnaires.model.js`, `registrationQuestionnaireAnswers.model.js`
- `auditEvents.model.js`
- `processed-async-events.model.js`

## Auth and roles

Аутентификация:

- access token подписывается через `jsonwebtoken` в `backend/src/routes/auth.js`;
- refresh token хранится отдельно в таблице `refresh_tokens`;
- cookie helpers лежат в `backend/src/lib/refreshTokenCookie.js`.

Проверка пользователя:

- `backend/src/middleware/auth.js` достаёт Bearer token из `Authorization`;
- payload кладётся в `req.user`.

Проверка ролей:

- `backend/src/middleware/authorizeRole.js` проверяет соответствие `req.user.role`;
- `backend/src/middleware/accessControl.js` задаёт наборы ролей для admin-only и admin-area.

Подтверждённые роли:

- `admin`
- `manager`
- `affiliate`
- `advertiser`

Защита endpoint'ов:

- admin area routes обычно делают `router.use(authenticate)` + `authorizeAdminArea`;
- advertiser routes делают `authenticate` + `authorizeRole('advertiser')`;
- questionnaire-sensitive routes дополнительно используют `requireQuestionnaireCompletion()`.

Ownership/access rules:

- часть правил решается в route middleware;
- часть живёт в service layer, например через `resolveAdvertiserIdFromUser(...)` и offer access services.

## Tracking endpoints

Основной tracking route group:

- `backend/src/routes/tracking.routes.js`

Подтверждённые задачи этого файла:

- `/track/click` принимает click request;
- валидирует tracking query через `validateTrackingQuery`;
- определяет IP, GEO и device;
- вызывает `registerClick(...)`;
- отрабатывает fallback redirect и dedupe metrics;
- принимает postback payload;
- валидирует его через `validatePostbackParams`;
- вызывает `registerConversion(...)`;
- логирует validation failures через `logPostbackValidationFailure(...)`.

Подробный flow лучше читать в отдельных data-flow документах:

- `docs/dev/data-flow/click-flow.md`
- `docs/dev/data-flow/postback-flow.md`
- `docs/dev/data-flow/conversion-flow.md`

## Async jobs / queues

Очередь:

- создаётся в `backend/src/lib/queue.js` через `new Queue(...)`;
- имя и default options идут из `backend/src/queue/config.js`;
- queue может быть выключена через env или в тестах.

Регистрация jobs:

- `backend/src/queue/index.js`
- `backend/src/workers/registerJobs.js`

Подтверждённые типы jobs:

- `POSTBACK_EVENT`
- `ROLLUP`
- domain payloads `conversion_created`
- domain payloads `click_created`

Что делают workers:

- резервируют `processed_async_events`, чтобы не обработать один event дважды;
- запускают `updateConversionRollup(...)` или `updateClickRollup(...)`;
- запускают `runDailyStatsRollup(...)` для batch rollup;
- пишут structured logs и prometheus counters.

## Error handling

Единый обработчик ошибок:

- `backend/src/middleware/errorHandler.js`

Служебные элементы:

- `backend/src/utils/apiError.js`
- `backend/src/utils/response.js`
- `backend/src/utils/asyncHandler.js`

Практический pattern:

- validation errors бросаются как `ApiError(..., 400, ...)`;
- auth errors бросаются middleware `auth.js`;
- forbidden errors бросаются `authorizeRole.js`;
- route handler оборачивается в `asyncHandler(...)`;
- `sendSuccess(...)` возвращает успешный envelope.

Подробный формат response/errors уже вынесен в:

- `docs/dev/architecture/06-api-response-format.md`
- `docs/dev/architecture/07-error-handling.md`

## Logging / audit

Подтверждённые слои логирования:

- `backend/src/middleware/requestLogger.js`
- `backend/src/lib/structuredLogger.js`
- `backend/src/lib/metrics.js`

Audit:

- storage: `backend/src/models/auditEvents.model.js`
- orchestration: `backend/src/services/audit.service.js`
- review endpoints: `backend/src/routes/admin-audit-logs.routes.js`

Точно подтверждено, что tracking и worker flows пишут structured logs. Для полного перечня audited actions нужен отдельный domain walkthrough.

## Как добавить новый API endpoint

1. Найти нужную route group в `backend/src/routes`, либо создать новую и подключить её в `backend/src/app.js`.
2. Добавить route handler и обернуть async route через `asyncHandler(...)`.
3. Добавить validation function в `backend/src/validators`.
4. Добавить или расширить service method в `backend/src/services`.
5. Добавить model method с SQL в `backend/src/models`.
6. Подключить `authenticate`, `authorizeRole(...)` или другой access middleware по необходимости.
7. Добавить integration tests в `backend/tests/integration`.
8. Обновить dev API docs.

## Где бизнес-логика, а где SQL

Разделение слоёв в текущем проекте такое:

- business rules должны жить в `backend/src/services`;
- SQL и row mapping должны жить в `backend/src/models`;
- route должен заниматься HTTP wiring, а не длинным доменным сценарием;
- validation должна проверять форму входа, а не реализовывать бизнес-процесс.

Проект не везде идеален в этом отношении, но именно этот target pattern уже прослеживается в tracking, stats, advertisers и questionnaires.

## Known backend TODO

- TODO: уточнить полный перечень jobs и job names в `backend/src/queue/index.js` относительно domain docs.
- TODO: уточнить, какие route groups используются только админкой, а какие ещё дергаются внутренними сервисами.
- TODO: уточнить, есть ли runtime usage у каталога `services/` в корне проекта вне `backend/`.
- TODO: уточнить, планируется ли миграция backend с Express на Fastify, так как текущий код уже закреплён на Express.
