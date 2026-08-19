# Dev-документация

Статус: draft

## Назначение

Это внутренняя документация для разработчиков CPA tracking platform. Она описывает реальную структуру текущего проекта: где находятся frontend и backend, как проходят основные runtime-потоки, где искать бизнес-логику, доступ к данным, миграции, роли и технические интеграции.

## Быстрый старт для разработчика

Сначала стоит прочитать:

1. [Обзор архитектуры](./architecture/01-overview.md)
2. [Frontend](./architecture/02-frontend.md)
3. [Backend](./architecture/03-backend.md)
4. [Database](./architecture/04-database.md)

## Карта документации

### Architecture

- [Обзор архитектуры](./architecture/01-overview.md)
- [Frontend architecture](./architecture/02-frontend.md)
- [Backend architecture](./architecture/03-backend.md)
- [Database architecture](./architecture/04-database.md)
- [Auth and Roles](./architecture/05-auth-and-roles.md)
- [API Response Format](./architecture/06-api-response-format.md)
- [Error Handling](./architecture/07-error-handling.md)
- [Validation](./architecture/08-validation.md)
- [Audit Events](./architecture/09-audit-events.md)

### Domains

- [Auth](./domains/auth.md)
- [Users](./domains/users.md)
- [Affiliates](./domains/affiliates.md)
- [Advertisers](./domains/advertisers.md)
- [Managers](./domains/managers.md)
- [Offers](./domains/offers.md)
- [Offer Goals](./domains/offer-goals.md)
- [Offer Access](./domains/offer-access.md)
- [Geo Targeting](./domains/geo-targeting.md)
- [Tracking Clicks](./domains/tracking-clicks.md)
- [Postbacks and Conversions](./domains/postbacks-conversions.md)
- [Adjustments](./domains/adjustments.md)
- [Stats](./domains/stats.md)
- [Questionnaires](./domains/questionnaires.md)
- [Finance](./domains/finance.md)

### Data flow

- [Click Flow](./data-flow/click-flow.md)
- [Postback Flow](./data-flow/postback-flow.md)
- [Conversion Flow](./data-flow/conversion-flow.md)
- [Stats Rollup Flow](./data-flow/stats-rollup-flow.md)
- [Manual Adjustment Flow](./data-flow/manual-adjustment-flow.md)
- [Registration Flow](./data-flow/registration-flow.md)

### API

- [Auth](./api/auth.md)
- [Admin](./api/admin.md)
- [Partner](./api/partner.md)
- [Advertiser](./api/advertiser.md)
- [Tracking](./api/tracking.md)

### Infra

- [Environment Variables](./infra/env.md)
- [Docker Compose](./infra/docker-compose.md)
- [Nginx](./infra/nginx.md)
- [Database Migrations](./infra/database-migrations.md)
- [Redis](./infra/redis.md)
- [Queues](./infra/queues.md)
- [Metrics](./infra/metrics.md)
- [Deploy Staging](./infra/deploy-staging.md)

### Testing

- [Test Strategy](./testing/test-strategy.md)
- [Integration Tests](./testing/integration-tests.md)
- [E2E Tests](./testing/e2e-tests.md)
- [Seed Data](./testing/seed-data.md)

### Maintenance

- [How to Add Role](./maintenance/how-to-add-role.md)
- [How to Add Page](./maintenance/how-to-add-page.md)
- [How to Add API Route](./maintenance/how-to-add-api-route.md)
- [How to Add Migration](./maintenance/how-to-add-migration.md)
- [How to Debug Tracking](./maintenance/how-to-debug-tracking.md)
- [How to Debug Postbacks](./maintenance/how-to-debug-postbacks.md)

## Карта проекта

| Путь | Назначение |
|---|---|
| `frontend/` | Отдельный workspace с Next.js frontend |
| `frontend/src/app` | App Router страницы, layout'ы и route sections для admin, partner и advertiser |
| `frontend/src/components` | Общие UI-компоненты, shell, navbar, таблицы логов, toast и questionnaire UI |
| `frontend/src/context` | Глобальный auth/session state |
| `frontend/src/hooks` | Локальные frontend hooks |
| `frontend/src/lib` | API-клиенты, role helpers, env helpers, stats/tracking helpers |
| `backend/` | Отдельный workspace с Node.js backend |
| `backend/src/routes` | HTTP routes и группировка endpoint'ов |
| `backend/src/validators` | Валидация query/body/params |
| `backend/src/services` | Бизнес-логика по доменам |
| `backend/src/models` | SQL и data access поверх PostgreSQL |
| `backend/src/middleware` | Auth, роли, rate limit, error handler, request logging |
| `backend/migrations` | SQL schema evolution через `node-pg-migrate` |
| `backend/src/workers` | Регистрация job handlers для BullMQ worker |
| `backend/src/queue` | Конфигурация async queue и names job'ов |
| `backend/src/scripts` | Служебные CLI scripts, включая daily stats rollup |
| `backend/src/seed` | Начальный seed/bootstrap данных |
| `backend/tests` | Integration tests, test helpers и test DB setup |
| `docs/dev` | Внутренняя документация для разработчиков |
| `docs/user` | Пользовательская документация, не относится к dev overview |
| `services/` | TODO: уточнить статус. В текущем runtime не используется `backend/src/index.js` и `frontend/` завязка на этот каталог не найдена |

## Основные runtime-потоки

- Обычный API-запрос
  Frontend вызывает `/api/v1/...` через `frontend/src/lib/api.ts`. Дальше запрос попадает в route из `backend/src/routes`, проходит middleware и validator, затем service вызывает model и возвращает `sendSuccess(...)`.

- Tracking click
  Переход идёт на `/track/click`. Route в `backend/src/routes/tracking.routes.js` валидирует query, определяет IP, GEO и device, затем `services/tracking/clicks.service.js` создаёт click, выполняет access/GEO checks и отдаёт redirect.

- Postback
  Advertiser отправляет postback в tracking backend. `tracking.routes.js` валидирует payload через `validators/postback.js`, сервис `services/postback/conversions.service.js` ищет click/offer/goal, создаёт или обновляет conversion и пишет postback log.

- Async event
  После click/conversion backend может публиковать job в BullMQ. Worker в `backend/src/workers/registerJobs.js` обрабатывает события `click_created`, `conversion_created` и rollup jobs, обновляя агрегаты и технические логи.

- Daily stats rollup
  Агрегация daily stats выполняется либо worker job `ASYNC_JOB_NAMES.ROLLUP`, либо CLI script `backend/src/scripts/run-daily-rollup.js`. Источником служат raw clicks/conversions, результат записывается в `daily_stats`.

## Правила ведения dev-документации

- Описывать реальные файлы и реальные потоки.
- Не писать догадки как факты.
- Если информация не проверена, ставить `TODO: уточнить`.
- Для сложной логики добавлять data-flow документ.
- При изменении архитектуры обновлять соответствующий `.md`.
