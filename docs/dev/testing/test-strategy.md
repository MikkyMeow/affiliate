# Test Strategy

Статус: draft

## Назначение

Документ описывает текущую стратегию тестирования CPA tracking platform: какие тесты уже есть в проекте, какие слои пока отсутствуют, какие домены критичны для merge/deploy и в каком порядке расширять покрытие.

## Где находится

| Файл / путь | Назначение |
|---|---|
| `backend/tests/integration/` | Основной текущий слой backend integration/API tests |
| `backend/tests/helpers/factories.js` | Тестовые фабрики для пользователей, офферов, целей, доступа и GEO |
| `backend/tests/helpers/postback.js` | Helper для подписи postback-запросов |
| `backend/tests/setup/test-env.js` | Глобальный setup Vitest |
| `backend/tests/setup/test-db.js` | Создание test DB и очистка таблиц |
| `backend/vitest.config.js` | Конфигурация test runner |
| `backend/src/seed/` | Скрипты и данные seed/demo набора для backend |
| `frontend/src/` | Frontend-код есть, но frontend tests не найдены |
| `docs/dev/testing/` | Dev-документация по тестированию |

## Текущий статус

В проекте подтверждён один полноценный автоматизированный слой: backend integration/API tests на `Vitest` + `supertest`.

Что уже есть:

- backend test runner: `vitest`;
- API/integration tests против реального `express` app через `createApp()`;
- автоматическое создание test database;
- применение миграций перед suite;
- очистка БД перед каждым тестом через `TRUNCATE ... RESTART IDENTITY CASCADE`;
- factories для пользователей, партнёров, рекламодателей, офферов, целей, ставок, доступа и GEO;
- отдельный seed/demo слой для локальной разработки.

Что не найдено:

- unit tests для pure helpers/validators/calculators;
- frontend component tests;
- Playwright;
- Cypress;
- e2e UI tests;
- staging smoke automation;
- подтверждённые GitHub Actions / CI gates для тестов.

## Test pyramid

Текущая рекомендуемая пирамида для этого проекта:

Unit tests  
-> Integration/API tests  
-> E2E tests  
-> Staging smoke checks

Расшифровка по текущему состоянию:

- `Unit tests`: нужны для валидаторов, калькуляторов, status transitions и прочих изолированных функций, но в репозитории не подтверждены.
- `Integration/API tests`: это текущий основной защитный слой. Он уже покрывает регистрацию, логин, роли, offer visibility, goal-aware postbacks, advertiser stats/finance, adjustments, questionnaires, audit logs и часть admin dashboard/reporting.
- `E2E tests`: пока отсутствуют. Их нужно добавлять как следующий слой поверх существующего API.
- `Staging smoke checks`: отдельной автоматизации не найдено. Сейчас это стратегия на будущее, а не подтверждённый слой.

## Test categories

### Unit tests

В проекте пока не подтверждены.

Когда их добавлять в первую очередь:

- `backend/src/validators/*.js`;
- pure helpers в `backend/src/lib/`;
- расчёты в `backend/src/services/offer-goals.service.js`;
- агрегирующие и derived-metric функции в stats-сервисах;
- status transition helpers для conversion lifecycle;
- normalization/parsing helpers для adjustments/postbacks.

Что тестировать изолированно:

- validators;
- pure domain helpers;
- calculators;
- status transitions;
- normalization/parsing logic;
- date/filter coercion.

### Backend integration tests

Это текущий основной слой проекта.

Что реально тестируется сейчас:

- API endpoints через HTTP-запросы `supertest`;
- auth/login/register/me/profile;
- role access control;
- database writes/reads;
- migrations и schema assertions;
- tracking redirect/click creation;
- goal-aware postback/conversion flows;
- admin reporting/statistics;
- advertiser self-service APIs;
- questionnaires;
- manual adjustments;
- audit log.

### API tests

Отдельного слоя, отделённого от integration tests, не найдено. По сути текущие integration tests одновременно являются API tests, потому что:

- поднимают `createApp()` из `backend/src/app.js`;
- делают HTTP-запросы;
- проверяют status code, response body и side effects в БД.

### Frontend component tests

Не найдены.

Есть frontend-код в `frontend/src/`, но в `frontend/package.json` нет test scripts, а среди файлов проекта не найдено `*.test.tsx`, `*.spec.tsx`, `testing-library`, `vitest` для frontend или `jest`.

TODO: добавить frontend component tests для критичных form/page flows, если UI начнёт чаще ломаться на регрессиях.

### E2E tests

Не подтверждены.

Playwright и Cypress в проекте не найдены. Документ с будущей стратегией описан в [e2e-tests.md](/home/artur/projects/affiliate/docs/dev/testing/e2e-tests.md).

### Smoke tests

Автоматизированный smoke layer не найден, но для staging/release критичны:

- `GET /health`;
- `POST /api/v1/auth/login`;
- открытие dashboard для роли;
- `GET /track` redirect flow;
- postback, создающий conversion;
- базовая проверка stats/finance на не-пустом тестовом наборе.

### Seed/demo validation

Seed-скрипт подтверждён в `backend/src/seed/index.js` и `backend/src/seed/bootstrap.js`, но отдельного автоматизированного теста в suite не найдено.

TODO: добавить smoke-проверку seed после запуска demo dataset.

## Critical domains

| Domain | Почему критичен | Минимальное покрытие |
|---|---|---|
| Auth | Без него нельзя безопасно разделять роли | `login`, `register`, `auth/me`, `profile`, forbidden |
| Tracking clicks | Основа платформы | click create, dedupe, redirect, no access, GEO fallback |
| Postbacks/conversions | Деньги и результат | click resolve, goal, status, idempotency |
| Stats | Отчёты и финансы | aggregation, filters, role visibility |
| Adjustments | Ручные изменения данных | CSV validation, apply, stats impact |
| Offers/access/GEO | Доступность трафика | visibility, access, geo fallback |

## Coverage map

| Domain | Existing tests | Coverage status | Gaps |
|---|---|---|---|
| `auth` | `auth-me.test.js`, `register.test.js`, части `critical-path.test.js`, `advertiser-foundation.test.js`, `manager-admin.test.js` | Частично покрыто | TODO: добавить invalid login, refresh/session/logout, password reset для обычных ролей |
| `users` | `auth-me.test.js`, `admin-info-blocks.test.js`, `manager-admin.test.js` | Частично покрыто | TODO: добавить отдельные tests для `/api/v1/profile` update validation и role-specific self-service cases |
| `affiliates` | `critical-path.test.js`, `manager-assignment.test.js`, `admin-info-blocks.test.js` | Частично покрыто | TODO: добавить отдельные list/detail/edit scenarios и pagination/filter coverage |
| `advertisers` | `advertiser-foundation.test.js`, `advertiser-offers.test.js`, `advertiser-security.test.js`, `manager-assignment.test.js`, `admin-info-blocks.test.js` | Хорошее частичное покрытие | TODO: добавить CRUD/filters/admin listing coverage, если такие endpoints критичны |
| `managers` | `manager-admin.test.js`, `manager-assignment.test.js` | Хорошее частичное покрытие | TODO: добавить edge cases around deactivation and cross-role audit visibility |
| `offers` | `offer-visibility-stage7.test.js`, `critical-path.test.js`, `advertiser-offers.test.js` | Хорошее частичное покрытие | TODO: добавить полный admin offer CRUD regression suite |
| `offer-goals` | `offer-goals-stage8.test.js`, `postback-goal-awareness-stage8_1.test.js` | Хорошо покрыто | TODO: добавить unit tests для calculators/limit transitions |
| `offer-access` | `offer-visibility-stage7.test.js`, `critical-path.test.js` | Хорошо покрыто | TODO: добавить more negative/edge request lifecycle cases |
| `geo-targeting` | `critical-path.test.js`, часть `offer-visibility-stage7.test.js` через visibility/access context | Частично покрыто | TODO: добавить отдельный suite для admin GEO rules CRUD и multi-country behaviour |
| `tracking-clicks` | `critical-path.test.js` | Частично покрыто | TODO: добавить отдельный suite для click API/admin click lists, invalid params, source markers |
| `postbacks-conversions` | `critical-path.test.js`, `postback-goal-awareness-stage8_1.test.js`, `conversion-status-stage15.test.js`, `advertiser-postbacks.test.js` | Хорошее частичное покрытие | TODO: добавить unknown click, invalid signature/token, missing click id, richer idempotency matrix |
| `adjustments` | `admin-adjustments-stage14.test.js` | Частично покрыто | TODO: добавить partial failure, large CSV, recalculation verification by date ranges |
| `stats` | `admin-dashboard-stage11.test.js`, `admin-list-filters-stage12.test.js`, `admin-summary-stage13.test.js`, `daily-stats-stage16.test.js`, `advertiser-stats.test.js`, `advertiser-finance.test.js` | Хорошее покрытие admin/advertiser layers | TODO: добавить partner stats coverage, finance summaries for partner/admin if present |
| `questionnaires` | `questionnaires.test.js` | Хорошо покрыто | TODO: добавить more migration/compatibility edge cases if schema evolves |
| `finance` | `advertiser-finance.test.js`, части `admin-summary-stage13.test.js` | Частично покрыто | TODO: добавить partner/admin finance-specific endpoints if they exist |
| `infra/health` | Непосредственных test files не найдено | Не покрыто | TODO: добавить tests для `/health`, `/ready`, Redis optional behaviour |

## Priority roadmap

### Priority 1

Покрывать в первую очередь:

- auth invalid/login/session cases;
- tracking click отдельным suite;
- postback invalid and duplicate matrix;
- conversion lifecycle edge cases;
- offer access / private / on-request negative cases;
- stats role visibility и date filters для всех критичных ролей.

### Priority 2

- adjustments partial failure/recalc cases;
- questionnaires compatibility/regression cases;
- advertiser/partner dashboards;
- finance summaries beyond advertiser layer, если используются в UI как release-critical.

### Priority 3

- Playwright e2e smoke;
- visual/regression checks;
- staging smoke automation;
- frontend component tests для сложных форм и табличных экранов.

## Merge / deploy gates

Желаемые правила для проекта:

- `backend` tests проходят полностью;
- migrations успешно применяются на test DB;
- critical API tests по auth/tracking/postback/stats проходят;
- seed/demo dataset не ломается после миграций;
- e2e smoke проходят перед staging release, когда появится Playwright.

Текущий факт:

`TODO: уточнить CI gates / GitHub Actions.`

## Команды

| Command | Что запускает | Где выполнять |
|---|---|---|
| `npm test -w backend` | Backend test suite через `backend/package.json -> NODE_ENV=test vitest run` | Корень репозитория |
| `npm run test:watch -w backend` | Backend tests в watch-режиме | Корень репозитория |
| `npm run test:integration -w backend` | Backend integration suite с `--reporter=dot` | Корень репозитория |
| `npm run seed -w backend` | Seed/demo dataset для backend | Корень репозитория |
| `npm run migrate:up -w backend` | Ручной запуск миграций backend | Корень репозитория |

## Как это работает

Текущая стратегия опирается на реалистичные integration tests, а не на изолированные mocks.

Ключевая механика:

- Vitest загружает `backend/tests/setup/test-env.js`.
- `test-env.js` выставляет `NODE_ENV=test`, отключает очередь, Redis requirement и rate limiting.
- Перед suite вызывается `ensureTestDatabase()`, затем `ensureDatabaseSetup()`, затем `resetDatabase()`.
- `ensureDatabaseSetup()` из `backend/src/db.js` вызывает `applyMigrations()`.
- Перед каждым test case вызывается `resetDatabase()`, который делает `TRUNCATE` всех таблиц `public`, кроме `pgmigrations`.
- Каждый test обычно создаёт свои данные через factories или прямые model helpers, логинится через API и проверяет ответ плюс состояние БД.

Практический вывод: основная стоимость регрессий сейчас ложится на backend suite, поэтому merge нельзя считать безопасным без его прохождения.

## Как добавить / расширить

1. Определить, какой это слой: unit, integration/API или будущий e2e.
2. Если поведение связано с ролями, БД, redirect, postback или отчётами, начинать с integration test.
3. Переиспользовать существующие helpers из `backend/tests/helpers/`.
4. Создавать данные локально внутри теста, а не зависеть от глобального seed.
5. Для новых критичных UI flows готовить одновременно API tests и TODO на будущий Playwright smoke.
6. Если домен пока покрыт только интеграционно, но внутри есть сложные чистые функции, добавить TODO на unit layer.
7. Обновить coverage map в этой документации, если появился новый подтверждённый слой.

## Частые ошибки

| Ошибка | Причина | Как исправить |
|---|---|---|
| Тесты проходят локально по одному, но ломаются пачкой | Общие данные конфликтуют или тест добавляет неуникальные значения | Использовать factories и уникальные значения через random UUID/hex |
| Тесты медленные и хрупкие | Логика проверяется только через тяжёлый integration слой | Вынести pure-часть в unit tests, когда такие тесты начнут добавляться |
| Документация обещает Playwright/e2e, но в проекте его нет | Неподтверждённый слой описан как существующий | Явно помечать такие места `TODO` |
| Merge блокируется поздно | Нет явных gate rules | Зафиксировать CI policy после появления GitHub Actions/CI |

## Definition of Done

- Есть понятное разделение между unit, integration/API, e2e и smoke.
- Разработчик понимает, что текущий рабочий слой проекта это backend integration tests.
- Критичные домены перечислены и привязаны к минимальному покрытию.
- Есть coverage map по фактически найденным test files.
- Отмечены отсутствующие слои: frontend tests, Playwright, Cypress, staging smoke.
- Есть roadmap, что покрывать дальше.
- Неподтверждённые CI/deploy детали отмечены как `TODO`.

## Known limitations

- Unit test layer отсутствует.
- Frontend tests отсутствуют.
- E2E layer отсутствует.
- Нет подтверждённой CI-конфигурации для test gates.
- Нет автоматизированных smoke checks после deploy.
- `infra/health` endpoints не имеют подтверждённых тестов.

## Связанные разделы

- [integration-tests.md](/home/artur/projects/affiliate/docs/dev/testing/integration-tests.md)
- [e2e-tests.md](/home/artur/projects/affiliate/docs/dev/testing/e2e-tests.md)
- [seed-data.md](/home/artur/projects/affiliate/docs/dev/testing/seed-data.md)
- [deploy-staging.md](/home/artur/projects/affiliate/docs/dev/infra/deploy-staging.md)
- [database-migrations.md](/home/artur/projects/affiliate/docs/dev/infra/database-migrations.md)
