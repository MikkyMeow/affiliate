# How to Add Migration

Статус: draft

## Назначение

Инструкция помогает безопасно добавить новую migration в проект с `node-pg-migrate`.

## Когда использовать

- меняется схема PostgreSQL;
- добавляется таблица, колонка, индекс, constraint;
- нужно синхронизировать схему и backend code.

## Перед началом

- Проверить существующие миграции в `backend/migrations/`.
- Убедиться, что изменение нельзя внести через старую migration.
- Подготовить локальную БД и backup, если тестируете на shared среде.

## Шаги

1. Создать migration file.
   ```bash
   cd backend
   npm run migrate:create -- add_new_table
   ```
2. Заполнить `up` и `down` в созданном файле.
   По текущему проекту миграции пишутся в JS с `export const up/down`.
3. Добавить schema changes.
   Использовать `pgm.createTable`, `pgm.addColumn`, `pgm.addConstraint`, `pgm.createIndex` и `pgm.sql(...)` только там, где без SQL нельзя.
4. Добавить indexes/constraints.
   Не оставлять новую таблицу без необходимых индексов на FK и часто используемых фильтрах.
5. Применить migration локально.
   ```bash
   npm run migrate:up
   ```
6. Проверить схему.
   ```bash
   psql "postgres://affiliate:affiliate@localhost:55432/affiliate" -c '\d+ your_table'
   ```
7. Обновить model/repository.
   Изменить `backend/src/models/**`, если меняются поля или SQL.
8. Обновить service logic.
   Изменить `backend/src/services/**`, если появились новые бизнес-правила.
9. Обновить tests.
   Проверить integration tests и seed flow, если схема участвует в bootstrap.
10. Обновить docs.

## Что изменить

| Слой | Где менять | Что менять |
|---|---|---|
| Migration | `backend/migrations/*.js` | Новая migration |
| DB access | `backend/src/models/*.js` | SQL-поля, mapping |
| Business logic | `backend/src/services/**/*.js` | Работа с новой схемой |
| Tests | `backend/tests/integration/*.test.js` | Кейсы на новую схему |
| Docs | `docs/dev/infra/database-migrations.md` и связанные | Описание изменения |

## Проверка

```bash
cd backend && npm run migrate:up
```

```bash
psql "postgres://affiliate:affiliate@localhost:55432/affiliate" -c 'select * from pgmigrations order by run_on desc limit 5;'
```

```bash
cd backend && npm test
```

## Частые ошибки

| Ошибка | Причина | Как исправить |
|---|---|---|
| Migration создали, но не обновили code | Backend читает старую схему | Обновить models/services/tests |
| Нет rollback | Заполнен только `up` | Добавить корректный `down`, если rollback реалистичен |
| Долгий lock на больших таблицах | Изменение делается в лоб | Разбить migration на несколько шагов |
| Нет индекса на FK/фильтрах | Учтена только схема, не runtime нагрузка | Добавить `createIndex` |
| TS/types и DB разошлись | Не обновлены сериализаторы и DTO | Проверить `models`, `services`, frontend clients |

## Безопасность

- Destructive changes только через отдельный план.
- На больших таблицах осторожно с locks.
- Indexes на больших таблицах требуют внимания.
- Перед staging/prod нужен backup.
- Schema и TypeScript types должны совпадать.

## Definition of Done

- [ ] Создан новый migration file
- [ ] Заполнены `up` и `down`
- [ ] Добавлены нужные indexes/constraints
- [ ] Migration применена локально
- [ ] Проверена схема
- [ ] Обновлены models/services/tests
- [ ] Обновлена документация

## Связанные разделы

- [Database Migrations](../infra/database-migrations.md)
- [Database Architecture](../architecture/04-database.md)
