# Seed Data

Статус: draft

## Назначение

Документ описывает текущий seed/demo слой backend: какие скрипты и данные уже есть, как они используются для локальной разработки, чем seed отличается от test factories и какой минимальный demo dataset нужен для будущих e2e/smoke сценариев.

## Где находится

| Файл / путь | Назначение |
|---|---|
| `backend/src/seed/index.js` | Точка входа seed-скрипта |
| `backend/src/seed/bootstrap.js` | Основная логика наполнения demo dataset |
| `backend/src/seed/data/advertisers.js` | Seed-данные рекламодателей |
| `backend/src/seed/data/offerTemplates.js` | Шаблоны офферов для seed |
| `backend/src/seed/data/russianNames.js` | Демо-имена и профили для seed |
| `backend/package.json` | Подтверждённая команда `seed` |
| `.env.test` | Test env, не сам seed, но важен для безопасного разделения сред |
| `docs/test-adjustments-clicks.csv` | Пример CSV для manual click adjustments |
| `docs/test-adjustments-conversions.csv` | Пример CSV для manual conversion adjustments |

## Current seed/demo files

| File / script | Purpose |
|---|---|
| `backend/src/seed/index.js` | Импортирует `bootstrap.js` и запускает seed |
| `backend/src/seed/bootstrap.js` | Применяет миграции, проверяет безопасность окружения, генерирует demo users/offers/clicks/conversions |
| `backend/src/seed/data/advertisers.js` | Каталог seed-рекламодателей |
| `backend/src/seed/data/offerTemplates.js` | Набор шаблонов seed-офферов |
| `backend/src/seed/data/russianNames.js` | Имя/фамилия/контактные профили для demo users |
| `docs/test-adjustments-clicks.csv` | Пример данных для проверки adjustments UI/API вручную |
| `docs/test-adjustments-conversions.csv` | Пример данных для проверки conversion adjustments вручную |

## Текущий статус

Seed/demo слой в backend подтверждён.

Что известно по фактам из `backend/src/seed/bootstrap.js`:

- seed использует `faker`;
- seed вызывает `applyMigrations()` перед наполнением;
- seed защищён от опасного запуска на production-подобной базе;
- используется фиксированный `SEED = 20260519`;
- используется фиксированное время `NOW = 2026-05-19T12:00:00.000Z`;
- есть ожидаемые объёмы данных:
  - `managers: 12`;
  - `advertisers: 36`;
  - `partners: 148`;
  - `offers: 37`;
  - `clicks: 1897`;
  - `conversions: 689`;
- email-паттерн для seed users: `%@example.local`.

Чего не найдено:

- отдельного `seed:dev`, `seed:test`, `seed:staging` script;
- отдельного seed validation test;
- формально выделенного smoke dataset именно для Playwright;
- seed-команды в root `package.json`.

## Seed command

Подтверждённая команда:

```bash
npm run seed -w backend
```

Также в `backend/package.json` напрямую указано:

```bash
node src/seed/index.js
```

## Команды

| Command | Что запускает | Где выполнять |
|---|---|---|
| `npm run seed -w backend` | Seed/demo dataset backend | Корень репозитория |
| `npm run migrate:up -w backend` | Миграции перед ручной подготовкой среды | Корень репозитория |
| `TODO: уточнить команду.` | Отдельный smoke/e2e reseed, если он понадобится | `TODO: уточнить` |

## Как это работает

Текущая механика seed слоя:

1. `backend/src/seed/index.js` импортирует `bootstrap.js`.
2. `bootstrap.js` загружает env через `../config/load-env.js`.
3. Затем вызывает `applyMigrations()`.
4. Далее запускает `ensureSafeEnvironment()`, которая:
   - запрещает запуск в `NODE_ENV=production`;
   - анализирует `DATABASE_URL`;
   - проверяет host и DB name на признаки production;
   - отказывается работать с подозрительными non-local/prod БД.
5. После этого seed генерирует demo dataset на основе фиксированного random seed и предсказуемых шаблонов.

Практически это означает:

- seed ориентирован на локальную/dev/test среду;
- запуск против production-похожей базы специально блокируется;
- набор данных детерминирован достаточно хорошо для демонстрации и smoke.

## Recommended demo dataset

Ниже рекомендуемый минимальный набор для разработки и будущих e2e/smoke. Это не описание уже подтверждённых конкретных логинов из seed-кода, а целевой состав demo dataset поверх текущего seed слоя.

### Users

| Role | Email example | Purpose |
|---|---|---|
| `admin` | `admin@example.test` | Управление платформой |
| `manager` | `manager@example.test` | Проверка manager flows |
| `partner` | `partner@example.test` | Проверка affiliate cabinet |
| `advertiser` | `advertiser@example.test` | Проверка advertiser cabinet |

Важно:

- в текущем seed-коде подтверждён паттерн `@example.local`, а не `.test`;
- для документации и будущих smoke users безопаснее использовать `.test`;
- если будут заводиться специальные e2e users, лучше отделить их от общего demo seed.

### Advertisers

Минимум нужен такой набор:

- `1 active advertiser`;
- `1 inactive/disabled advertiser`, если такие статусы реально используются в UI/API.

Текущий seed создаёт много рекламодателей, но отдельная карта "какой из них inactive" в dev docs пока не подтверждена.

TODO: уточнить, создаёт ли текущий seed гарантированно disabled advertiser.

### Affiliates

Минимум нужен такой набор:

- `1 active affiliate`;
- `1 affiliate without offer access`;
- `1 affiliate with custom payout`, если это поддерживается текущим доменом goal affiliate rates.

Поддержка кастомных ставок подтверждена factories и integration tests.

### Offers

Минимальный demo набор:

- public offer;
- private offer;
- by-request/on-request offer;
- inactive offer;
- GEO-restricted offer;
- offer with multiple goals.

Текущий seed создаёт много офферов по шаблонам. Наличие всех указанных разновидностей нужно проверить отдельно на уровне seed validation.

TODO: добавить явную проверку, что seed гарантирует все критичные offer modes.

### Goals

Минимально нужны:

- lead goal;
- sale goal;
- default goal;
- goal with payout/revenue;
- affiliate-specific rate, если поддерживается.

Поддержка multiple goals и affiliate-specific rates подтверждена integration tests и factories.

### Tracking / clicks

Для smoke/e2e полезно иметь:

- valid click;
- duplicate click;
- GEO blocked/fallback click;
- click with `sub` params.

Текущий seed создаёт большой массив clicks, но конкретные smoke-friendly идентификаторы в документации не подтверждены.

TODO: выделить небольшой стабильный поднабор click fixtures для smoke.

### Conversions

Минимально нужны:

- pending conversion;
- approved conversion;
- rejected conversion;
- conversion with status history;
- conversion from postback;
- conversion affected by adjustment.

Поддержка этих состояний на доменном уровне подтверждена тестами, но не гарантированным seed contract.

TODO: уточнить, какие именно conversion statuses и history rows seed создаёт всегда.

### Stats

Для dashboard/stats smoke нужны данные:

- across multiple dates;
- across multiple offers;
- across multiple affiliates;
- across multiple statuses.

Текущий seed по масштабу подходит для этого, так как генерирует много clicks/conversions и фиксированное `NOW`.

### Questionnaires

Нужны состояния:

- unanswered questionnaire;
- completed questionnaire;
- invalid/incomplete answers, если нужен QA/demo сценарий.

Текущий общий seed это не подтверждает.

TODO: уточнить, создаёт ли seed готовые questionnaire demo states.

## Demo data rules

- Использовать безопасные email-домены `.test` или `.example.local`.
- Не использовать реальные персональные данные.
- Не использовать реальные токены.
- Не использовать production credentials.
- Делать seed идемпотентным или предсказуемым по результату.
- Давать уникальные slugs/ids там, где это важно для UI и API.
- Разделять local/dev/staging seed policy.
- Для smoke users фиксировать договорённый список логинов/ролей отдельно от большого demo dataset.

## How seed data supports tests

| Test type | Seed data usage |
|---|---|
| Integration | Prefer factories over global seed |
| E2E | Use stable demo dataset |
| Staging smoke | Use dedicated smoke users/data |

## Factories vs seed

Разделение обязанностей в текущем проекте должно быть таким:

- factories лучше для integration tests;
- seed лучше для локальной демонстрации и будущих e2e smoke;
- integration tests не должны зависеть от большого глобального seed, если можно создать данные внутри теста.

Почему это важно именно здесь:

- текущий test suite очищает БД перед каждым test case;
- integration tests уже опираются на `factories.js`, а не на глобальный dataset;
- seed создаёт большой и удобный для ручной проверки набор, но он слишком тяжёлый и неявный для детерминированного unit/integration test.

## How seed data supports local development

Текущий seed нужен разработчику для:

- открытия dashboard не на пустой базе;
- ручной проверки ролей и кабинетов;
- проверки stats/finance/reporting страниц;
- проверки adjustment flows на реалистичном объёме данных;
- воспроизведения tracking/postback сценариев без ручного создания сотен сущностей.

## How seed data supports E2E

После появления Playwright seed нужен для:

- подготовки стабильных логинов по ролям;
- наличия хотя бы одного доступного offer;
- наличия уже существующих clicks/conversions для dashboard smoke;
- проверки questionnaire gating;
- валидации advertiser and partner cabinet paths.

Но для e2e лучше выделить небольшой отдельный smoke contract поверх существующего большого dataset.

## How to avoid polluting production/staging

Текущая защита уже встроена в `backend/src/seed/bootstrap.js`.

Она:

- отказывается работать в `NODE_ENV=production`;
- валидирует `DATABASE_URL`;
- отклоняет suspicious host/database combinations;
- отказывается работать с `prod/production`-похожими именами БД;
- не даёт запускать seed на непредсказуемо опасной среде.

Операционные правила:

- запускать seed только на local/dev/test БД;
- для staging иметь отдельный осознанный smoke dataset и отдельный process;
- не направлять staging smoke на production credentials;
- не смешивать ручные demo данные и реальные коммерческие данные.

## Как добавить / расширить

1. Если нужен новый demo scenario, сначала решить: это seed или factory.
2. Если данные нужны только тесту, добавлять factory/helper, а не seed.
3. Если данные нужны для ручной демонстрации, QA или e2e smoke, расширять `backend/src/seed/`.
4. Для новых ролей/flows держать явный contract: какой логин, какая роль, какой ожидаемый кабинет.
5. Для критичных offer/tracking/postback demo cases заводить стабильные примеры, а не случайный поиск по большой базе.
6. После изменения seed обновить этот документ и список smoke users.

## Частые ошибки

| Ошибка | Причина | Как исправить |
|---|---|---|
| Seed случайно запускают не в той среде | Неправильный `DATABASE_URL` или нет проверки окружения | Оставлять и усиливать safety checks в `bootstrap.js` |
| Integration tests начинают зависеть от seed | Тест использует глобальный dataset вместо factories | Создавать данные внутри теста через `factories.js` |
| Demo dataset слишком большой для smoke | Один seed пытается решать все задачи | Выделить небольшой стабильный smoke contract |
| Неясно, какие пользователи использовать для QA | Нет документа с фиксированными role accounts | Завести отдельный список smoke/demo users |

## Definition of Done

- Подтверждены реальные seed files и команда запуска.
- Описано, как работает текущий seed bootstrap.
- Зафиксированы safety rules против production pollution.
- Понятно, как seed использовать для local dev и будущих e2e.
- Понятно, чем seed отличается от factories.
- Неподтверждённые детали помечены `TODO`.

## Known limitations

- Нет отдельного automated seed validation test.
- Нет подтверждённых e2e-specific users и команд reseed.
- Не описан стабильный contract по конкретным demo логинам из текущего seed.
- Не подтверждено, какие именно inactive/private/questionnaire states seed гарантирует всегда.
- CSV examples лежат в `docs/`, но не подключены к test suite автоматически.

## Связанные разделы

- [integration-tests.md](/home/artur/projects/affiliate/docs/dev/testing/integration-tests.md)
- [e2e-tests.md](/home/artur/projects/affiliate/docs/dev/testing/e2e-tests.md)
- [offers.md](/home/artur/projects/affiliate/docs/dev/domains/offers.md)
- [tracking-clicks.md](/home/artur/projects/affiliate/docs/dev/domains/tracking-clicks.md)
- [postbacks-conversions.md](/home/artur/projects/affiliate/docs/dev/domains/postbacks-conversions.md)
