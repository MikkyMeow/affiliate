# How to Add API Route

Статус: draft

## Назначение

Инструкция помогает добавить новый backend endpoint в Express-приложение без смешивания route, validation, service и data access.

## Когда использовать

- нужен новый REST endpoint;
- появляется новая admin/partner/advertiser ручка;
- frontend должен вызывать новую backend функцию.

## Перед началом

- Найти подходящую route group в `backend/src/routes/`.
- Проверить, есть ли похожий validator в `backend/src/validators/`.
- Проверить, где должна лежать бизнес-логика: `backend/src/services/`.
- Найти подходящую модель/репозиторий в `backend/src/models/`.

## Шаги

1. Найти нужную route group.
   Все route groups подключаются централизованно в `backend/src/app.js`.
2. Добавить route handler в соответствующий файл `backend/src/routes/*.js`.
3. Добавить validator/schema.
   В проекте используются ручные validators, не zod. Примеры: `backend/src/validators/offers.js`, `backend/src/validators/postback.js`, `backend/src/validators/stats.js`.
4. Добавить service method.
   Бизнес-логика должна жить в `backend/src/services/**`.
5. Добавить repository/model method.
   SQL-доступ обычно лежит в `backend/src/models/**`.
6. Добавить permissions.
   Использовать `authenticate`, `authorizeRole(...)`, `authorizeAdminArea`, `authorizeAdminOnly` или специализированные middleware.
7. Добавить error handling.
   Использовать `ApiError`, `asyncHandler`, `sendSuccess`, `ERROR_CODES`.
8. Добавить tests.
   Предпочтительно integration tests в `backend/tests/integration/`.
9. Если нужен frontend, подключить API client в `frontend/src/lib/*.ts`.
10. Обновить docs/dev/api.

## Что изменить

| Слой | Где менять | Что менять |
|---|---|---|
| Route | `backend/src/routes/*.js` | Новый endpoint |
| Validation | `backend/src/validators/*.js` | Проверка query/body/params |
| Service | `backend/src/services/**/*.js` | Бизнес-логика |
| Model | `backend/src/models/*.js` | SQL и mapping |
| Auth | `backend/src/middleware/*.js` | Role/ownership checks |
| Tests | `backend/tests/integration/*.test.js` | API tests |
| Frontend client | `frontend/src/lib/*.ts` | Если endpoint нужен UI |

## Проверка

```bash
cd backend && npm test
```

Точечный smoke-test после запуска backend:

```bash
curl -i http://localhost:4000/health
```

И затем уже конкретный endpoint с корректным `Authorization`, если он защищён.

## Частые ошибки

| Ошибка | Причина | Как исправить |
|---|---|---|
| Бизнес-логика написана прямо в route | Route разросся и дублируется | Перенести код в `services` |
| Нет валидации query/body | Handler читает `req.body` напрямую | Добавить validator и `ApiError` на ошибки |
| Нет проверки роли | Забыт `authorizeRole(...)` или `authorizeAdminArea` | Добавить middleware на route |
| Нет ownership check | Проверили только роль, но не владение сущностью | Добавить сервисную проверку по `req.user` |
| Разные response formats | Возврат сырых `res.json(...)` без общего формата | Использовать `sendSuccess` |
| Endpoint не покрыт тестом | Проверен только вручную | Добавить integration test на `200/400/401/403` |

## Definition of Done

- [ ] Route добавлен в нужный router
- [ ] Router подключён в `backend/src/app.js` или уже использует существующую группу
- [ ] Есть validator для body/query/params
- [ ] Бизнес-логика вынесена в service
- [ ] SQL вынесен в model/repository
- [ ] Добавлены auth и ownership checks
- [ ] Есть integration tests
- [ ] Если нужно, frontend client обновлён
- [ ] Обновлена API docs

## Связанные разделы

- [Backend Architecture](../architecture/03-backend.md)
- [Admin API](../api/admin.md)
- [Tracking API](../api/tracking.md)
