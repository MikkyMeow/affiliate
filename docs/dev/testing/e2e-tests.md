# E2E Tests

Статус: draft

## Назначение

Документ фиксирует текущий статус e2e слоя и будущую стратегию для UI-smoke и пользовательских сценариев. На этом этапе важно честно зафиксировать, что e2e в репозитории пока не подтверждены, и описать, какие сценарии должны стать первыми после внедрения Playwright.

## Где находится

| Файл / путь | Назначение |
|---|---|
| `docs/dev/testing/e2e-tests.md` | Стратегия текущего/будущего e2e слоя |
| `frontend/src/app/` | UI, который в будущем должен покрываться e2e |
| `backend/src/seed/` | Источник demo dataset для будущих e2e/smoke сценариев |
| `backend/tests/integration/` | Текущая API-основа, на которую должен опираться e2e слой |

Пути `playwright.config.*`, `cypress.config.*`, каталоги `e2e/`, `playwright/`, `cypress/` в проекте не найдены.

## Current status

Playwright в текущем проекте не подтверждён.

Что реально найдено:

- `frontend` существует и активно развивается;
- backend integration tests существуют и покрывают критичный API;
- seed/demo data слой существует;
- e2e toolchain, config files и test files не найдены.

Что не найдено:

- `playwright.config.*`;
- `cypress.config.*`;
- `tests/e2e/`;
- scripts в `frontend/package.json` или root `package.json` для e2e;
- CI integration для e2e.

TODO: добавить Playwright для smoke/e2e сценариев.

## Команды

| Command | Что запускает | Где выполнять |
|---|---|---|
| `TODO: уточнить команду.` | Playwright/e2e runner пока не подтверждён | `TODO: уточнить` |
| `npm run seed -w backend` | Готовит demo dataset, который в будущем можно использовать для e2e | Корень репозитория |
| `npm test -w backend` | Текущий базовый слой, который должен оставаться зелёным до e2e | Корень репозитория |

## Why E2E is needed

Почему e2e всё равно нужен, несмотря на уже существующий integration слой:

- integration tests доказывают, что API и БД работают;
- e2e tests должны доказать, что пользовательский путь реально работает через UI;
- для проекта с несколькими ролями критичны navigation, redirects, forms, dashboards и роль-зависимая видимость;
- tracking/postback/stats flows уже покрыты на API, но не подтверждены в реальном UI маршруте.

Особенно важно для:

- auth smoke;
- role-based navigation;
- offer creation/editing forms;
- partner tracking-link flow;
- advertiser stats/finance dashboards;
- questionnaire gating;
- post-deploy smoke на staging.

## Recommended tool

Так как инструмент в проекте пока не установлен, рекомендуемый будущий выбор: `Playwright`.

Причины:

- хорошо подходит для multi-role веб-приложения;
- поддерживает browser automation + network assertions;
- удобен для smoke и regression happy paths;
- легко встраивается в CI/staging;
- позволяет частично готовить данные через API, а не только через UI.

На этом этапе зависимость не добавляется.

Рекомендуемая будущая структура:

```txt
tests/e2e/
  auth.spec.ts
  admin-offer-flow.spec.ts
  partner-tracking-flow.spec.ts
  advertiser-postback-flow.spec.ts
  questionnaire-gating.spec.ts
  smoke.spec.ts
playwright.config.ts
```

Адаптация под текущий проект:

- backend остаётся источником seed/demo данных;
- e2e должен использовать реальные роли `admin`, `manager`, `partner`, `advertiser`;
- setup test data лучше делать через API/seed, а не через длинные UI-preconditions.

## Текущий статус

С точки зрения реальности проекта:

- текущий e2e слой отсутствует;
- Playwright не установлен;
- Cypress не установлен;
- будущий e2e слой должен опираться на уже существующие backend integration tests, а не заменять их.

## Как это работает

Текущей реализации нет.

Будущая рекомендуемая механика:

1. Поднять backend и frontend локально.
2. Подготовить dedicated demo/test data через seed или API setup.
3. Запускать Playwright только на критичных happy-path и smoke сценариях.
4. Проверять UI + ключевой side effect:
   - redirect;
   - visible dashboard data;
   - доступность страниц по ролям;
   - факт появления conversion/stats.

## Critical E2E scenarios

### Auth smoke

Сценарий:

- admin logs in
- dashboard opens
- role-specific navigation visible

Подтверждение в коде:

- backend auth API есть;
- frontend dashboard страницы есть;
- e2e test пока отсутствует.

### Admin creates offer

Сценарий:

- admin logs in
- creates advertiser
- creates affiliate
- creates offer
- creates goal
- grants affiliate access

Основание:

- backend покрывает related flows отдельными integration tests;
- UI e2e пока нет.

### Partner starts traffic

Сценарий:

- partner logs in
- opens offers
- opens offer detail
- gets tracking link
- tracking link redirects
- click appears in partner clicks

Основание:

- API flow подтверждён `critical-path.test.js`;
- UI e2e не подтверждён.

### Advertiser postback

Сценарий:

- advertiser or test script sends postback
- conversion appears
- status is visible
- stats update

Основание:

- backend postback/stats/finance already covered;
- UI-to-backend smoke пока не автоматизирован.

### Stats smoke

Сценарий:

- admin/partner/advertiser opens stats
- filters by date
- sees expected clicks/conversions

Статус:

- admin/advertiser API части уже покрыты;
- partner e2e/stat UI smoke: `TODO: добавить`.

### Questionnaire gating

Сценарий:

- new user logs in
- questionnaire required
- fills answers
- cabinet access opens

Основание:

- backend gating покрыт `questionnaires.test.js`;
- UI сценарий пока отсутствует.

## Test data requirements

| Scenario | Required users | Required data |
|---|---|---|
| Auth smoke | `admin@example.test` или отдельный smoke admin | Активный admin user |
| Admin creates offer | admin, advertiser, partner | Чистый advertiser/partner dataset или возможность создать через UI |
| Partner starts traffic | partner | Offer с доступом, target URL, при необходимости GEO rules |
| Advertiser postback | advertiser, partner | Offer, goal, click, postback token |
| Stats smoke | admin / partner / advertiser | Clicks + conversions на нескольких датах |
| Questionnaire gating | new affiliate или advertiser user | Questionnaire schema + незаполненный пользователь |

## How to make E2E stable

- Использовать dedicated test data.
- Не зависеть от mutable production/staging data.
- Использовать уникальные names/slugs, если сценарий создаёт сущности.
- Лучше иметь isolated environment или регулярный reset dataset.
- Не тестировать всё через UI. Критичные preconditions быстрее готовить через API setup или seed.
- Держать e2e только для happy paths, smoke и role/navigation regressions.
- Для tracking/postback smoke проверять не всю аналитику, а факт базового прохода сценария.

## Как добавить / расширить

1. Подтвердить выбор Playwright и добавить toolchain отдельным этапом.
2. Определить минимальный набор e2e env vars:
   - `APP_ORIGIN`;
   - `API_BASE_URL`;
   - credentials smoke users;
   - возможно, seed toggles.
3. Подготовить стабильный demo dataset.
4. Начать с `smoke.spec.ts` и `auth.spec.ts`.
5. Затем добавить один full-flow для partner tracking и один для advertiser/admin.
6. Проверки postback лучше частично готовить API helper-ом, а UI использовать для подтверждения результата.
7. После появления реальных e2e файлов обновить этот документ реальными путями и командами.

## CI / staging

Как e2e должны запускаться в будущем:

- на CI после backend integration tests;
- на staging перед релизом или сразу после deploy;
- минимум один smoke job на `login -> dashboard -> track -> postback -> stats`.

Что понадобится:

- стабильный frontend URL;
- backend API URL;
- dedicated smoke users;
- isolated dataset или регулярный reseed;
- артефакты: screenshots, traces, videos только для падений.

При flaky tests:

- сначала искать нестабильность в data/setup, а не увеличивать таймауты;
- уменьшать количество UI preconditions;
- переносить подготовку данных в API/seed;
- запускать flaky test отдельно против чистого окружения.

Текущий факт:

`TODO: уточнить CI integration для Playwright.`

## Частые ошибки

| Ошибка | Причина | Как исправить |
|---|---|---|
| E2E ломается из-за старых данных | Тест зависит от уже изменённого demo dataset | Использовать dedicated smoke users и предсказуемый seed |
| Один сценарий слишком длинный | В тесте слишком много UI setup | Подготовить данные через API/seed, оставить UI только для проверки пользовательского пути |
| Flaky redirect/stat checks | Проверка идёт раньше, чем данные появились | Добавить явное ожидание результата и упростить assertions до критичного минимума |
| Документация вводит в заблуждение | Playwright описан как существующий | Явно писать, что Playwright не подтверждён |

## Definition of Done

- Честно зафиксировано, что Playwright/Cypress пока не найдены.
- Понятно, зачем проекту нужен e2e слой поверх integration tests.
- Есть рекомендуемый инструмент и будущая структура файлов.
- Перечислены критичные e2e сценарии.
- Описаны требования к данным.
- Описаны правила стабильности и CI/staging usage.
- Неподтверждённые места помечены `TODO`.

## Known limitations

- Реального e2e runner в репозитории нет.
- Команды запуска e2e не подтверждены.
- CI/staging integration не подтверждена.
- Нет browser automation config.
- Нет smoke users/dataset, формально выделенных именно под e2e.

## Связанные разделы

- [seed-data.md](/home/artur/projects/affiliate/docs/dev/testing/seed-data.md)
- [integration-tests.md](/home/artur/projects/affiliate/docs/dev/testing/integration-tests.md)
- [deploy-staging.md](/home/artur/projects/affiliate/docs/dev/infra/deploy-staging.md)
- [how-to-debug-tracking.md](/home/artur/projects/affiliate/docs/dev/maintenance/how-to-debug-tracking.md)
- [how-to-debug-postbacks.md](/home/artur/projects/affiliate/docs/dev/maintenance/how-to-debug-postbacks.md)
