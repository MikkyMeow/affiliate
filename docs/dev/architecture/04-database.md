# Database architecture

Статус: draft

## Назначение

Этот документ объясняет, как проект хранит данные, где искать PostgreSQL-схему, миграции и SQL-логику, и какие сущности важны для tracking, conversions, stats, questionnaires, audit и finance.

## Технологии

Подтверждённые технологии:

- PostgreSQL
- `pg` для runtime-доступа к БД
- `node-pg-migrate` для миграций
- raw SQL в model layer
- `pg.Pool` для connection pooling
- seed/bootstrap scripts в `backend/src/seed`

Что видно по коду:

- соединение создаётся в `backend/src/db.js`;
- при старте backend вызывает `ensureDatabaseSetup()` и автоматически применяет миграции;
- отдельный ORM или query builder поверх `pg` в runtime не используется.

## Где лежит database layer

| Путь | Назначение |
|---|---|
| `backend/src/db.js` | PostgreSQL pool и startup setup |
| `backend/src/migrate.js` | Программный запуск миграций |
| `backend/migrations` | Migration files |
| `backend/src/models` | Data access и raw SQL |
| `backend/tests/setup/test-db.js` | Test DB setup |
| `backend/src/seed` | Seed/demo/bootstrap data |

## Основные таблицы / сущности

| Сущность | Примерные таблицы | Назначение | Связанные домены |
|---|---|---|---|
| users | `users` | Базовые учётные записи, роли, auth-поля, timezone | users, auth, managers |
| refresh tokens | `refresh_tokens` | Хранение refresh token сессий | auth |
| affiliates | `affiliates` | Профили партнёров, привязка к user и менеджеру | affiliates |
| advertisers | `advertisers` | Профили рекламодателей, привязка к user и менеджеру | advertisers |
| managers | `users` + manager links в `affiliates`/`advertisers` | Отдельной таблицы managers не найдено; роль живёт в `users`, связи добавлены миграцией | managers |
| offers | `offers` | Основная сущность оффера | offers |
| offer goals | `offer_goals`, `offer_goal_affiliate_rates` | Цели оффера и персональные payout/rate rules | offer goals, finance |
| offer access | `offer_affiliate_access`, `offer_requests`, `offer_affiliate_hidden` | Access control и visibility офферов для партнёров | offer access |
| geo rules | `offer_geo_rules` | GEO targeting и redirect rules | geo targeting |
| clicks | `clicks`, `click_dedup_registry` | Raw tracking clicks и dedupe registry | tracking clicks |
| conversions | `conversions` | Конверсии по кликам и ручным корректировкам | conversions, finance |
| conversion status history | `conversion_status_history` | История смены статусов conversion | conversions |
| postback logs | `postback_logs` | Логи принятых/ошибочных postback запросов | postbacks |
| adjustments | `conversions`, `clicks` c `source='manual_adjustment'` | Отдельной таблицы adjustments не найдено; корректировки материализуются как manual click/conversion rows | adjustments |
| adjustment batches | `manual_adjustment_batches` | Батчи ручных корректировок | adjustments |
| stats / daily stats | `daily_stats`, `processed_async_events` | Агрегаты и защита от повторной async обработки | stats |
| questionnaires | `registration_questionnaires`, `registration_questionnaire_answers` | Шаблоны анкет и ответы пользователей | questionnaires |
| audit logs | `audit_events` | Audit trail доменных действий | audit |
| finance / payments | `conversions`, `offer_goal_affiliate_rates` | Отдельной таблицы payments пока не найдено | finance |
| user action tokens | `user_action_tokens` | Email verification / user action workflows | auth |

## Связи данных на верхнем уровне

```txt
user
  -> affiliate profile
  -> advertiser profile

advertiser
  -> offers

offer
  -> offer goals
  -> geo rules
  -> access rules
  -> clicks
  -> conversions

affiliate
  -> offer access
  -> clicks
  -> conversions

click
  -> conversion

conversion
  -> status history
  -> daily stats
```

С учётом текущей схемы полезно добавить ещё две связи:

```txt
manual adjustment batch
  -> manual clicks
  -> manual conversions

processed async event
  -> click/conversion rollup dedupe
```

## Click and conversion storage

Клики:

- хранятся в `clicks`;
- модель: `backend/src/models/clicks.model.js`;
- дедупликация дополнительно использует `click_dedup_registry`;
- есть поля для GEO/device/redirect context и `canonical_click_id`.

Конверсии:

- хранятся в `conversions`;
- модель: `backend/src/models/conversions.model.js`;
- связаны с `click_id`, `offer_id`, `affiliate_id`, `goal_id`;
- содержат `status`, `external_transaction_id`, `revenue_amount`, `payout_amount`, `payout_rub`, `source`, `is_test`.

Связь click -> conversion:

- основная связь идёт через `conversions.click_id`;
- для goal-aware postbacks есть отдельные индексы по `click_id` и `goal_id`.

Где хранится status:

- текущее состояние лежит прямо в `conversions.status`.

Где хранится история status:

- `conversion_status_history`;
- модель: `backend/src/models/conversionStatusHistory.model.js`.

## Stats storage

Raw data:

- `clicks`
- `conversions`

Агрегаты:

- `daily_stats`

Судя по моделям и worker flow:

- `daily_stats` хранит агрегаты по `date`, `timezone`, `offer_id`, `affiliate_id`, `advertiser_id`, `goal_id`;
- в extended схеме там есть breakdown по статусам, revenue/payout, manual/test counters;
- `processed_async_events` используется для защиты от повторной rollup-обработки.

Обновление daily stats:

- через async worker на события `click_created` и `conversion_created`;
- через batch-агрегацию `runDailyStatsRollup(...)`;
- модели: `backend/src/models/daily-stats.model.js` и `stats-aggregator.model.js`.

## Migrations

Миграции лежат в:

- `backend/migrations`

Именование:

- timestamp prefix + snake case description;
- примеры: `1724025600000_create_clicks_table.js`, `1738100000000_stage15_conversion_status_history.js`.

Подтверждённые команды из `backend/package.json`:

- `npm run migrate --workspace backend`
- `npm run migrate:up --workspace backend`
- `npm run migrate:down --workspace backend`
- `npm run migrate:create --workspace backend`

Дополнительно backend на старте вызывает `ensureDatabaseSetup()`, поэтому в dev runtime миграции могут применяться автоматически.

Как добавить новую миграцию:

1. Создать migration через `migrate:create`.
2. Описать таблицу, индексы и constraints.
3. Добавить model/repository методы.
4. Протянуть сервисную логику и tests.

## Seed / demo data

Подтверждённые пути:

- `backend/src/seed/index.js`
- `backend/src/seed/bootstrap.js`

Подтверждённая команда:

- `npm run seed --workspace backend`

Есть ли полноценные demo datasets для всех ролей и доменов:

- TODO: уточнить состав seed данных и покрытие по доменам.

## Как добавить новую таблицу

1. Создать migration в `backend/migrations`.
2. Добавить constraints и indexes сразу в migration.
3. Добавить SQL access methods в `backend/src/models`.
4. Добавить service logic в `backend/src/services`.
5. Добавить integration tests.
6. Обновить `docs/dev/domains` для соответствующего домена.

## Индексы и ограничения

Подтверждённые примеры:

- unique constraints на:
  `processed_async_events.event_key`, user/profile links, часть access таблиц, `daily_stats` composite uniqueness;
- partial indexes на:
  `conversions` для goal-aware postbacks и некоторые статусы `click_id`/`goal_id` combinations;
- check constraints на:
  `conversions.status`, `conversions.source`, `clicks.source`, ограничения финансовой модели `offer_goals`.

Почему это важно:

- tracking и postback flows чувствительны к duplicate events;
- без уникальных и частичных индексов легко получить повторные conversion rows;
- daily stats требуют строгого уникального ключа по dimension set;
- check constraints не дают сохранить невалидный `status`, `source` или broken payout model.

Для полного списка ограничений лучше смотреть конкретные migration files, а не overview-документ.

## Known database TODO

- TODO: уточнить, есть ли отдельные payment/payout таблицы вне текущего `backend/migrations`.
- TODO: уточнить, какие seed данные создаются по умолчанию и какие роли они покрывают.
- TODO: уточнить, используется ли каталог `services/migrations` из корня проекта в актуальном deploy pipeline.
