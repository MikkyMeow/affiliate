# Database Migrations

Статус: draft

## Назначение

Этот раздел описывает, где лежат миграции, какой инструмент используется и как безопасно работать со схемой базы данных.

## Где находится

| Файл / путь | Назначение |
|---|---|
| `backend/migrations/` | Основной каталог миграций `node-pg-migrate` |
| `backend/src/migrate.js` | Программный запуск миграций |
| `backend/src/db.js` | Автоматически вызывает миграции через `ensureDatabaseSetup()` |
| `backend/package.json` | CLI scripts для `migrate:*` |
| `backend/src/scripts/run-daily-rollup.js` | Отдельный CLI-скрипт для rollup, не для схемы |
| `services/migrations/` | TODO: уточнить, используется ли этот каталог; в текущем коде подтверждения нет |

## Migration files

| Path | Purpose |
|---|---|
| `backend/migrations/*.js` | Все подтверждённые schema migrations |
| `backend/migrations/1716470400000_create_core_tables.js` | Базовые таблицы `users`, `refresh_tokens`, `advertisers` |
| `backend/migrations/1729216800000_create_processed_async_events_table.js` | Дедупликация async jobs |
| `backend/migrations/1738100000000_stage15_conversion_status_history.js` | История статусов конверсий |

## Как это работает

Проект использует `node-pg-migrate`. Backend не ждёт отдельного ручного шага: при старте `backend/src/index.js` вызывает `ensureDatabaseSetup()`, а тот вызывает `applyMigrations()` из `backend/src/migrate.js`.

Миграции читаются из каталога `backend/migrations`, хранятся в таблице `pgmigrations` и применяются в направлении `up`.

Подключение к БД берётся либо из `DATABASE_URL`, либо из `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD`. При `DB_SSL=true` включается SSL c `rejectUnauthorized: false`.

Большинство migration-файлов содержит и `up`, и `down`, поэтому rollback частично поддерживается.

## Commands

| Command | Purpose | Environment |
|---|---|---|
| `cd backend && npm run migrate` | Применить все новые миграции | local / staging, опасно на shared DB |
| `cd backend && npm run migrate:up` | Явно выполнить `up` | local / staging |
| `cd backend && npm run migrate:down` | Откатить последнюю миграцию | local, опасно на staging/prod |
| `cd backend && npm run migrate:create -- add_new_table` | Создать новый migration stub | local |
| `cd backend && npm run dev` | Старт backend c авто-применением миграций | local |
| `docker compose logs -f api` | Проверить, прошли ли auto-migrations при старте контейнера | local / staging |

## Локальный запуск

Поднять инфраструктуру:

```bash
cp .env.example .env
docker compose up -d postgres redis
```

Применить миграции вручную:

```bash
cd backend
npm run migrate:up
```

Проверить текущую схему:

```bash
psql "postgres://affiliate:affiliate@localhost:55432/affiliate" -c '\dt'
psql "postgres://affiliate:affiliate@localhost:55432/affiliate" -c 'select * from pgmigrations order by run_on desc limit 20;'
```

## Staging / deploy

На staging отдельный шаг `migrate` в workflow не найден. По текущему коду миграции применяются косвенно при старте контейнера `api`, который поднимается через `docker compose up -d --build`.

Это значит, что staging deploy зависит от успешного старта backend-контейнера.

TODO: уточнить, запускается ли на сервере отдельный безопасный migration step до перезапуска приложения.

## Проверка работоспособности

```bash
cd backend && npm run migrate:up
```

```bash
curl -fsS http://localhost:4000/ready
```

```bash
psql "postgres://affiliate:affiliate@localhost:55432/affiliate" -c 'select count(*) from pgmigrations;'
```

Успешные признаки:

- команда `migrate:up` завершается без ошибок;
- backend после старта не падает на схеме;
- таблица `pgmigrations` содержит последние версии;
- API и worker работают на новой схеме без runtime SQL ошибок.

## Частые проблемы

| Проблема | Что проверить | Где смотреть |
|---|---|---|
| Миграция не применяется | Правильный ли `DATABASE_URL` или `DB_*` | `.env`, `backend/src/migrate.js` |
| Backend падает после deploy | Не было ли breaking schema change без совместимости | `docker compose logs api`, migration file |
| Rollback ломается | Есть ли корректный `down` в миграции | `backend/migrations/*.js` |
| Индексы не созданы | Был ли завершён `up` полностью | `pgmigrations`, `psql \d <table>` |
| Worker пишет SQL ошибки | Совпадает ли новая схема с кодом rollup/queue handlers | `backend/src/workers/registerJobs.js`, `backend/src/services/stats/rollup.service.js` |

## Безопасность

- Не удалять колонки без плана миграции данных.
- Не делать destructive changes на staging/production без backup.
- Проверять indexes/constraints.
- Учитывать большие таблицы `clicks`, `conversions`, `daily_stats`.
- Автоматическое применение миграций при старте backend удобно локально, но рискованно для staging/prod без pre-check и backup.
- `npm run migrate:down` на staging/prod считать опасной командой.

## Known limitations

- Отдельный rollback process для staging не документирован. TODO: уточнить.
- В репозитории есть каталог `services/migrations`, но runtime-код использует `backend/migrations`. TODO: уточнить, нужен ли каталог `services/migrations`.
- Workflow или deploy script не содержит явного шага smoke-check конкретной версии схемы после миграций.

## Связанные разделы

- [Database Architecture](../architecture/04-database.md)
- [How to Add Migration](../maintenance/how-to-add-migration.md)
