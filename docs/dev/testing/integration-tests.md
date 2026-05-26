# Integration Tests

Статус: draft

## Назначение

Документ описывает текущий backend integration/API слой: чем он запускается, где лежат тесты, как поднимается test app, как создаётся и очищается test database, какие helpers и factories уже есть и как добавлять новый тест на API endpoint без выдуманных абстракций.

## Где находится

| Файл / путь | Назначение |
|---|---|
| `backend/vitest.config.js` | Конфигурация `vitest` для backend tests |
| `backend/tests/setup/test-env.js` | Глобальный test setup/hook lifecycle |
| `backend/tests/setup/test-db.js` | Создание test DB и очистка таблиц |
| `backend/tests/helpers/factories.js` | Основные factories для доменных сущностей |
| `backend/tests/helpers/postback.js` | Подпись postback-запросов |
| `backend/tests/integration/*.test.js` | Текущие integration/API tests |
| `backend/src/app.js` | `createApp()` для тестов и runtime |
| `.env.test` | Переменные окружения test режима |
| `backend/src/db.js` | Подключение к БД и вызов миграций |
| `backend/src/migrate.js` | Применение миграций через `node-pg-migrate` |

## Текущий статус

Подтверждён рабочий backend integration слой на `Vitest` + `supertest`.

Что реализовано:

- все найденные test files находятся в `backend/tests/integration/`;
- app поднимается через `createApp()` из `backend/src/app.js`;
- runner работает в `node` environment;
- suite запускается последовательно, без параллелизма;
- test DB создаётся автоматически, если её нет;
- миграции применяются перед suite;
- перед каждым тестом база очищается;
- factories покрывают ключевые сущности auth/offers/goals/access/GEO.

Что не найдено:

- отдельные unit tests;
- отдельный frontend integration слой;
- factories для seed UI flows вне backend;
- transaction-based rollback isolation;
- подтверждённый отдельный `TEST_DATABASE_URL` env.

## Test runner

Текущий runner: `Vitest`.

Подтверждение:

- `backend/package.json` содержит `test`, `test:watch`, `test:integration`;
- `backend/vitest.config.js` импортирует `defineConfig` из `vitest/config`;
- `backend/tests/setup/test-env.js` использует `beforeAll`, `beforeEach`, `afterAll` из `vitest`.

Конфигурация runner из `backend/vitest.config.js`:

- `globals: true`;
- `environment: 'node'`;
- `setupFiles: ['tests/setup/test-env.js']`;
- `testTimeout: 30000`;
- `hookTimeout: 30000`;
- `fileParallelism: false`;
- `maxWorkers: 1`;
- `minWorkers: 1`;
- `sequence.concurrent: false`.

Практический вывод: suite намеренно выполняется последовательно, чтобы уменьшить конфликты вокруг общей test DB.

## Commands

| Command | Что запускает | Notes |
|---|---|---|
| `npm test -w backend` | Полный backend suite через `NODE_ENV=test vitest run` | Основная подтверждённая команда |
| `npm run test:watch -w backend` | Backend tests в watch-режиме | Удобно при локальной разработке |
| `npm run test:integration -w backend` | Backend integration suite с `--reporter=dot` | По сути тот же слой, но другой reporter |
| `npm run migrate:up -w backend` | Миграции backend вручную | Нужна вне runner для ручной подготовки |
| `npm run seed -w backend` | Seed/demo dataset | Не является частью test suite |

## Test files

| Test file | Domain | Что проверяет |
|---|---|---|
| `backend/tests/integration/auth-me.test.js` | auth | `GET /api/v1/auth/me`, linkage ролей, auth required |
| `backend/tests/integration/register.test.js` | auth/register | регистрация affiliate/advertiser, duplicate email, validation |
| `backend/tests/integration/critical-path.test.js` | auth/offers/tracking/postback | login, profile, offer visibility, request flow, click redirect, dedupe, postback |
| `backend/tests/integration/offer-visibility-stage7.test.js` | offers/access | visibility modes, request access, private/public/on-request rules, admin grant/revoke |
| `backend/tests/integration/offer-goals-stage8.test.js` | offer-goals | goal schema, goal CRUD rules, rates, limits, audit |
| `backend/tests/integration/postback-goal-awareness-stage8_1.test.js` | postbacks/conversions | goal-aware postbacks, duplicate handling, offer visibility impact |
| `backend/tests/integration/admin-dashboard-stage11.test.js` | stats/dashboard | admin dashboard aggregates by hour |
| `backend/tests/integration/admin-list-filters-stage12.test.js` | stats/lists | clicks/conversions lists, filters, pagination, validation |
| `backend/tests/integration/admin-summary-stage13.test.js` | stats/summary | totals, grouped summaries, filters, zero metrics |
| `backend/tests/integration/admin-adjustments-stage14.test.js` | adjustments | preview/apply CSV, manual clicks/conversions, audit, stats impact |
| `backend/tests/integration/conversion-status-stage15.test.js` | conversions/status | status history, transitions, filters, manual conversions |
| `backend/tests/integration/daily-stats-stage16.test.js` | daily stats | rollup schema, recalculation, stored stats, derived metrics |
| `backend/tests/integration/audit-log-stage18.test.js` | audit-log | schema, read API, filters, redaction |
| `backend/tests/integration/advertiser-foundation.test.js` | advertiser/auth | advertiser linkage, login, profile, smoke flow |
| `backend/tests/integration/advertiser-offers.test.js` | advertiser/offers | advertiser offer list/detail, filters, role protection |
| `backend/tests/integration/advertiser-postbacks.test.js` | advertiser/postbacks | advertiser postback log list/detail, filters, auth/role rules |
| `backend/tests/integration/advertiser-stats.test.js` | advertiser/stats | advertiser summary/breakdowns, date filters, role restrictions |
| `backend/tests/integration/advertiser-finance.test.js` | advertiser/finance | advertiser finance summary/breakdowns, filters, zero states |
| `backend/tests/integration/advertiser-security.test.js` | advertiser/security | cross-role forbidden access |
| `backend/tests/integration/manager-admin.test.js` | managers | create/list/update/reset/delete manager, password flows |
| `backend/tests/integration/manager-assignment.test.js` | managers/assignments | assignment to affiliate/advertiser, filters, audit |
| `backend/tests/integration/admin-info-blocks.test.js` | profiles/info blocks | telegram/internal note/password reset/admin detail data |
| `backend/tests/integration/public-ids.test.js` | infra/public ids | schema, API exposure, UUID/public ID routing compatibility |
| `backend/tests/integration/questionnaires.test.js` | questionnaires | questionnaire CRUD, submit/update answers, gating, audit |

## Test database

Текущий test DB setup подтверждён.

Что используется:

- PostgreSQL;
- настройки берутся из `.env.test`;
- основной URL: `postgres://affiliate:affiliate@localhost:55432/affiliate_test`;
- переменные: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DATABASE_URL`.

Как это работает:

1. `backend/tests/setup/test-env.js` загружает `../../src/config/load-env.js`.
2. `load-env.js` при `NODE_ENV=test` берёт `.env.test`.
3. `beforeAll()` вызывает `ensureTestDatabase()`.
4. `ensureTestDatabase()` из `backend/tests/setup/test-db.js` подключается к admin DB (`TEST_DB_ADMIN_DB`, либо `postgres`, либо `template1`) и создаёт target DB, если её нет.
5. Затем `ensureDatabaseSetup()` из `backend/src/db.js` вызывает `applyMigrations()`.
6. `applyMigrations()` из `backend/src/migrate.js` запускает `node-pg-migrate` в каталог `backend/migrations`.
7. После миграций вызывается `resetDatabase()`.
8. Перед каждым test case `beforeEach()` снова вызывает `resetDatabase()`.

Как очищаются данные:

- запросом к `pg_tables` выбираются все таблицы схемы `public`, кроме `pgmigrations`;
- затем выполняется `TRUNCATE ... RESTART IDENTITY CASCADE`.

Как изолируются тесты:

- не транзакциями и rollback;
- а полным `TRUNCATE` перед каждым test case;
- suite выполняется последовательно, что уменьшает гонки.

Что важно помнить:

- tests нельзя проектировать в расчёте на параллельный запуск;
- данные должны создаваться внутри каждого теста;
- нельзя опираться на остатки от предыдущего test case.

`TEST_DATABASE_URL` в коде не найден.

TODO: уточнить, нужен ли отдельный env alias для CI, или `DATABASE_URL` останется единственным источником.

## Test helpers

| Helper | Файл | Назначение |
|---|---|---|
| `test-env` | `backend/tests/setup/test-env.js` | Загружает test env, отключает Redis requirement/queue/rate limit, управляет lifecycle hooks |
| `ensureTestDatabase` | `backend/tests/setup/test-db.js` | Создаёт test DB при отсутствии |
| `resetDatabase` | `backend/tests/setup/test-db.js` | Полностью очищает все таблицы `public`, кроме `pgmigrations` |
| `buildPostbackSignature` | `backend/tests/helpers/postback.js` | Строит HMAC SHA-256 подпись postback payload |

## Factories / fixtures

| Factory / fixture | Файл | Что создаёт |
|---|---|---|
| `createTestUser` | `backend/tests/helpers/factories.js` | Базового пользователя и пароль |
| `createTestAffiliate` | `backend/tests/helpers/factories.js` | Партнёра (`affiliate`) |
| `createTestAffiliateUser` | `backend/tests/helpers/factories.js` | Affiliate user + linked affiliate |
| `createTestAdminUser` | `backend/tests/helpers/factories.js` | Admin или manager user |
| `createTestAdvertiser` | `backend/tests/helpers/factories.js` | Рекламодателя |
| `createTestAdvertiserUser` | `backend/tests/helpers/factories.js` | Advertiser user + linked advertiser |
| `createTestOffer` | `backend/tests/helpers/factories.js` | Offer с advertiser, статусом, visibility, duplicate-click settings |
| `createTestOfferGoal` | `backend/tests/helpers/factories.js` | Goal для offer |
| `createTestOfferGoalAffiliateRate` | `backend/tests/helpers/factories.js` | Affiliate-specific payout/revenue rate для goal |
| `grantAffiliateAccess` | `backend/tests/helpers/factories.js` | Запись доступа партнёра к offer |
| `hideAffiliateFromOffer` | `backend/tests/helpers/factories.js` | Hidden override для offer/affiliate |
| `addGeoRule` | `backend/tests/helpers/factories.js` | GEO rule для offer |

Дополнительные локальные фикстуры внутри test files встречаются часто:

- `loginAndGetToken`;
- `authenticateAdvertiser`;
- `seedConversion`;
- `seedClick`;
- `seedPostbackLog`;
- `createAdjustmentFixtures`;
- `seedSummaryFixtures`.

Это не общие helpers, а file-local patterns.

## Как это работает

Типичный integration test в этом проекте устроен так:

1. В начале файла создаётся `const app = createApp();`.
2. Тест создаёт сущности через factories или model helpers.
3. Если нужен auth context, тест логинится в `/api/v1/auth/login` и получает `token`.
4. Запросы идут через `request(app)` из `supertest`.
5. Проверяется:
   - HTTP status;
   - `response.body`;
   - side effects в БД через `pool.query(...)` или model finders.

Важно: tests не используют mock app и не мокают БД. Это реальные integration/API tests поверх реального Express приложения и реальной PostgreSQL базы.

## Как добавить тест на новый API endpoint

1. Найти существующий test file в том же домене или создать новый файл в `backend/tests/integration/`.
2. Импортировать `request` из `supertest` и `createApp` из `backend/src/app.js`.
3. Создать `const app = createApp();` на уровне файла.
4. Подготовить данные через `backend/tests/helpers/factories.js`.
5. Если endpoint требует auth, создать пользователя нужной роли и залогиниться через `/api/v1/auth/login`.
6. Вызвать endpoint через `request(app)`.
7. Проверить `status code`.
8. Проверить `response body`.
9. Проверить database side effects через model helper или `pool.query`.
10. Добавить negative cases: forbidden, validation, not found.
11. Не добавлять ручной cleanup, если хватает глобального `resetDatabase()` перед следующим тестом.

Простейший шаблон по текущему стилю:

```js
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createTestAdminUser } from '../helpers/factories.js';

const app = createApp();

async function loginAndGetToken(email, password) {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });

  expect(res.status).toBe(200);
  return res.body.data.token;
}
```

## Patterns

### Authenticated request

Текущий типовой паттерн:

- создать пользователя фабрикой;
- отправить `POST /api/v1/auth/login`;
- взять `response.body.data.token`;
- передавать `Authorization: Bearer <token>`.

Примеры:

- `backend/tests/integration/auth-me.test.js`;
- `backend/tests/integration/critical-path.test.js`;
- `backend/tests/integration/advertiser-finance.test.js`.

### Validation error

Текущий паттерн:

- отправить заведомо неверный payload/query;
- ожидать `400`;
- проверять `error.code === 'VALIDATION_ERROR'` или структуру ошибок.

Примеры:

- `register.test.js`;
- `admin-list-filters-stage12.test.js`;
- `questionnaires.test.js`.

### Forbidden

Текущий паттерн:

- залогиниться пользователем неподходящей роли;
- вызвать endpoint;
- ожидать `403`.

Примеры:

- `advertiser-security.test.js`;
- `advertiser-offers.test.js`;
- `admin-adjustments-stage14.test.js`;
- `manager-assignment.test.js`.

### Not found

Текущий паттерн:

- использовать чужой `offerId`/`postbackId`/lookup id;
- ожидать `404`, а не утечку данных.

Примеры:

- `advertiser-offers.test.js`;
- `advertiser-postbacks.test.js`;
- `advertiser-finance.test.js`.

### Database side effect

Текущий паттерн:

- после запроса читать БД через model helpers или `pool.query`.

Примеры:

- `register.test.js` проверяет сохранённого пользователя и affiliate/advertiser linkage;
- `critical-path.test.js` читает `offerRequests`, `conversions`;
- `admin-adjustments-stage14.test.js` проверяет schema/indexes и записи после apply;
- `daily-stats-stage16.test.js` проверяет persistent daily stats.

### Idempotency

Текущий паттерн подтверждён для tracking/postback доменов.

Где смотреть:

- `critical-path.test.js` проверяет duplicate click behaviour и dedup window;
- `postback-goal-awareness-stage8_1.test.js` проверяет goal-aware duplicate logic и `external_transaction_id`;
- `offer-goals-stage8.test.js` проверяет limit handling.

## Critical integration scenarios

### Auth

- login success: подтверждён косвенно почти во всех auth-required tests;
- login invalid credentials: `TODO: добавить отдельный test`;
- me/current user: покрыто в `auth-me.test.js`;
- forbidden role: покрыто в advertiser/manager/admin suites.

### Offers

- admin creates offer: `TODO: добавить отдельный CRUD test file, если create endpoint критичен`;
- partner sees available offer: покрыто в `critical-path.test.js` и `offer-visibility-stage7.test.js`;
- private offer hidden: покрыто;
- by-request offer restricted: покрыто;
- grant/revoke access: покрыто.

### Tracking click

- valid click creates record: покрыто в `critical-path.test.js`;
- inactive offer rejected/fallback: `TODO: добавить отдельный test, если поведение поддерживается`;
- no affiliate access: покрыто через offer visibility/access flows;
- GEO blocked/fallback: покрыто в `critical-path.test.js`;
- duplicate click behaviour: покрыто в `critical-path.test.js`;
- redirect URL: покрыто в `critical-path.test.js`.

### Postback/conversion

- valid postback creates conversion: покрыто;
- missing click id: `TODO: добавить`;
- unknown click id: `TODO: добавить`;
- unknown goal: покрыто в `postback-goal-awareness-stage8_1.test.js`;
- invalid status: частично покрыто в `conversion-status-stage15.test.js`, но не весь postback слой;
- duplicate postback: покрыто;
- status history created: покрыто в `conversion-status-stage15.test.js`.

### Stats

- clicks included: покрыто в `advertiser-stats.test.js` и `daily-stats-stage16.test.js`;
- conversions grouped by status: покрыто;
- date filters: покрыто;
- role visibility: покрыто для admin/manager/advertiser;
- partner stats: `TODO: добавить, если partner stats API есть и критичен`.

### Adjustments

- CSV validation: покрыто в `admin-adjustments-stage14.test.js`;
- batch apply: покрыто;
- partial failure: `TODO: добавить`;
- stats recalculation: частично покрыто через adjusted data + daily stats, но не отдельным сценарием end-to-end.

## Частые ошибки

| Ошибка | Причина | Как исправить |
|---|---|---|
| Tests fail because DB state leaks | Нет cleanup/isolation | Проверить `resetDatabase()` и не полагаться на данные соседнего теста |
| Auth tests flaky | Token/session не сбрасывается или логин helper использует неверные данные | Всегда создавать пользователя внутри теста и заново логиниться |
| Integration test passes alone but fails in suite | Общие данные конфликтуют | Использовать factories и уникальные email/title/click id |
| Migration missing in test DB | Test setup не применяет migrations | Проверить `beforeAll -> ensureDatabaseSetup()` и `.env.test` |
| Foreign-key ошибки при подготовке данных | Тест создаёт сущности в неверном порядке | Сначала user/affiliate/advertiser, затем offer, затем goal/access/conversion |
| Test ломается только на CI/staging DB | Среда использует другой `DATABASE_URL` | Проверить `.env.test` и настройки runner/CI |

## Как добавить / расширить

1. Сначала решить, нужен ли общий helper или достаточно file-local fixture.
2. Если повторяется логин/seed pattern в нескольких файлах, вынести helper в `backend/tests/helpers/`.
3. Если новый домен требует типовую сущность, расширить `factories.js`, не дублируя SQL по test files.
4. Если endpoint имеет сложный lifecycle, добавить happy path и минимум один negative matrix.
5. Если тест проверяет миграции или схему, читать `information_schema`/`pg_indexes`, как уже сделано в stage-based suites.
6. Если тест относится к деньгам, postback или stats, обязательно проверять side effects в БД.
7. После добавления файла обновить эту документацию и coverage map в `test-strategy.md`.

## Definition of Done

- Разработчик знает, что runner это `Vitest`.
- Понятны реальные команды запуска.
- Понятно, что app поднимается через `createApp()`.
- Понятно, как создаётся и очищается test DB.
- Есть список текущих test files по доменам.
- Описаны реальные helpers и factories.
- Есть пошаговая инструкция для нового endpoint test.
- Negative patterns и DB side effects описаны.
- Отсутствующие детали отмечены `TODO`.

## Known limitations

- Нет unit tests.
- Нет frontend tests.
- Нет Playwright/Cypress.
- Test isolation сделан через `TRUNCATE`, а не через rollback transactions.
- `TEST_DATABASE_URL` не подтверждён.
- Нет подтверждённого отдельного smoke suite.
- Не все критичные auth/tracking invalid cases уже покрыты.

## Связанные разделы

- [auth.md](/home/artur/projects/affiliate/docs/dev/api/auth.md)
- [tracking.md](/home/artur/projects/affiliate/docs/dev/api/tracking.md)
- [postbacks-conversions.md](/home/artur/projects/affiliate/docs/dev/domains/postbacks-conversions.md)
- [postback-flow.md](/home/artur/projects/affiliate/docs/dev/data-flow/postback-flow.md)
- [database-migrations.md](/home/artur/projects/affiliate/docs/dev/infra/database-migrations.md)
