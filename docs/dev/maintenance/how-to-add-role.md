# How to Add Role

Статус: draft

## Назначение

Инструкция помогает добавить новую роль в backend, frontend и схему доступа без рассинхронизации между слоями.

## Когда использовать

- добавляется новая бизнес-роль;
- нужно открыть отдельный кабинет или раздел;
- меняются правила доступа к API и навигации.

## Перед началом

- Найти все текущие места с ролями: `backend/src/middleware/accessControl.js`, `backend/src/middleware/authorizeRole.js`, `frontend/src/context/AuthContext.tsx`, `frontend/src/lib/auth/roles.ts`, `frontend/src/lib/auth/routes.ts`.
- Проверить, нужно ли менять DB constraint на `users.role`.
- Понять, нужен ли для новой роли отдельный профиль, layout, questionnaire и navigation.

## Шаги

1. Найти текущий источник truth по ролям.
   Сейчас роли зафиксированы в нескольких местах, а единого shared enum между backend и frontend нет.
2. Добавить новую роль в frontend type union.
   Обновить `frontend/src/context/AuthContext.tsx`, тип `UserRole`.
3. Добавить новую роль в backend auth payload и access control.
   Проверить `backend/src/routes/auth.js`, `backend/src/middleware/authorizeRole.js`, `backend/src/middleware/accessControl.js`.
4. Обновить database constraint или migration.
   В проекте есть миграции, которые меняли `users.role`; новую роль нужно добавить через новую migration, а не правкой старой.
5. Обновить backend guards.
   Если роль должна видеть admin area или отдельный route group, обновить `authorizeRole(...)` и/или helper'ы в `accessControl.js`.
6. Обновить домашний route и профильный route на frontend.
   Изменить `frontend/src/lib/auth/routes.ts` и `frontend/src/lib/auth/roles.ts`.
7. Обновить navigation/sidebar.
   Изменить `frontend/src/components/AppNavbar.tsx` и, если нужен отдельный кабинет, создать links-массив и layout.
8. Добавить role-based layout guard.
   По аналогии с `frontend/src/app/partner/layout.tsx`, `frontend/src/app/advertiser/layout.tsx`, `frontend/src/app/dashboard/layout.tsx`.
9. Проверить backend route permissions.
   Найти маршруты через `authorizeRole`, `authorizeAdminArea`, `authorizeAdminOnly`.
10. Добавить тесты forbidden/allowed сценариев.
    Проверить integration tests в `backend/tests/integration/`.
11. Обновить dev docs.

## Что изменить

| Слой | Где менять | Что менять |
|---|---|---|
| Frontend types | `frontend/src/context/AuthContext.tsx` | Добавить новую роль в `UserRole` |
| Frontend auth helpers | `frontend/src/lib/auth/roles.ts`, `frontend/src/lib/auth/routes.ts` | Лейблы, home path, profile path, доступ к admin area |
| Frontend navigation | `frontend/src/components/AppNavbar.tsx` | Ссылки в sidebar/top nav |
| Frontend layouts | `frontend/src/app/*/layout.tsx` | Guard и redirect logic |
| Backend auth | `backend/src/routes/auth.js` | Payload токена и выдача auth context, если нужны новые поля |
| Backend guards | `backend/src/middleware/authorizeRole.js`, `backend/src/middleware/accessControl.js` | Разрешённые роли на route groups |
| Backend validators/services | по месту | Business rules по новой роли |
| Database | `backend/migrations/*.js` | Изменить role constraint через новую migration |
| Tests | `backend/tests/integration/*` | Allowed/forbidden кейсы |

## Проверка

```bash
rg -n "admin|manager|affiliate|advertiser" backend/src frontend/src
```

```bash
cd backend && npm test
```

Ручные проверки:

- новая роль получает корректный home route;
- navigation показывает только нужные разделы;
- API запрещает доступ чужим ролям с `403`;
- login/refresh возвращают новый `role` в payload.

## Частые ошибки

| Ошибка | Причина | Как исправить |
|---|---|---|
| Роль добавили на frontend, но не на backend | Изменили только `UserRole` | Обновить guards, auth payload и DB constraint |
| Роль есть в БД, но нет в TypeScript union | Не обновили `UserRole` | Исправить `frontend/src/context/AuthContext.tsx` |
| Navigation показывает лишнее | Не обновили `AppNavbar.tsx` | Добавить фильтрацию ссылок по роли |
| API не защищён | Route не использует `authorizeRole(...)` | Добавить middleware на router/group |
| Тесты не покрывают forbidden cases | Проверили только happy path | Добавить `401/403` integration tests |

## Definition of Done

- [ ] Новая роль добавлена в frontend type union
- [ ] Новая роль добавлена в backend access control
- [ ] Обновлены home/profile routes
- [ ] Обновлена navigation
- [ ] Если нужно, добавлена новая migration для `users.role`
- [ ] Есть tests для allowed/forbidden сценариев
- [ ] Обновлена dev docs

## Связанные разделы

- [Auth Domain](../domains/auth.md)
- [Users Domain](../domains/users.md)
- [Backend Architecture](../architecture/03-backend.md)
- [Frontend Architecture](../architecture/02-frontend.md)
