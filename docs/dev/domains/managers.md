# Менеджеры

Статус: draft

## Назначение

Домен описывает роль `manager`, CRUD manager users, временные пароли, назначение менеджеров на affiliates/advertisers и ограничения видимости/прав в admin area.

## Основные пользовательские сценарии

- администратор создаёт manager user;
- менеджер логинится и использует часть admin area;
- admin/manager назначает manager на affiliate или advertiser;
- администратор обновляет или удаляет manager user;
- manager меняет свой пароль.

## Frontend files

| Файл / папка | Назначение |
|---|---|
| `frontend/src/app/dashboard/managers/page.tsx` | admin UI для списка/создания/редактирования/удаления managers |
| `frontend/src/app/dashboard/affiliates/[id]/edit/page.tsx` | назначение manager на affiliate |
| `frontend/src/app/dashboard/advertisers/[id]/edit/page.tsx` | назначение manager на advertiser |
| `frontend/src/lib/auth/roles.ts` | manager считается частью admin area на frontend |
| `frontend/src/lib/auth/routes.ts` | manager home path -> `/dashboard` |

## Backend routes

| Route / файл | Назначение | Роли |
|---|---|---|
| `GET /api/v1/admin/managers/lookup` (`backend/src/routes/admin-managers.routes.js`) | lookup managers для assignment UI | `admin`, `manager` |
| `GET /api/v1/admin/managers` (`backend/src/routes/admin-managers.routes.js`) | список managers | `admin` |
| `POST /api/v1/admin/managers` (`backend/src/routes/admin-managers.routes.js`) | создать manager | `admin` |
| `PATCH /api/v1/admin/managers/:id` (`backend/src/routes/admin-managers.routes.js`) | update manager | `admin` |
| `POST /api/v1/admin/managers/:id/reset-password` (`backend/src/routes/admin-managers.routes.js`) | reset password manager | `admin` |
| `DELETE /api/v1/admin/managers/:id` (`backend/src/routes/admin-managers.routes.js`) | delete manager | `admin` |
| `PATCH /api/v1/affiliates/:id/manager` (`backend/src/routes/affiliates.js`) | assign/unassign manager to affiliate | `admin`, `manager` |
| `PATCH /api/v1/advertisers/:id/manager` (`backend/src/routes/advertisers.js`) | assign/unassign manager to advertiser | `admin`, `manager` |
| `POST /api/v1/auth/change-password` (`backend/src/routes/auth.js`) | self password change | любой аутентифицированный, включая `manager` |

## Validators

| Файл / схема | Что валидирует |
|---|---|
| `backend/src/validators/users.js#validateCreateManagerDto` | создание manager |
| `backend/src/validators/users.js#validateUpdateManagerDto` | изменение email/displayName |
| `backend/src/validators/users.js#validateManagerListQuery` | список/lookup managers |
| `backend/src/validators/affiliates.js#validateAssignAffiliateManagerDto` | payload manager assignment для affiliate |
| `backend/src/validators/advertisers.js#validateAssignAdvertiserManagerDto` | payload manager assignment для advertiser |

## Services

| Service / файл | Ответственность |
|---|---|
| `backend/src/services/managers.service.js` | manager CRUD, temp password, self password change |
| `backend/src/services/affiliates.service.js#assignAffiliateManager` | назначение manager на affiliate |
| `backend/src/services/advertisers.service.js#assignAdvertiserManager` | назначение manager на advertiser |
| `backend/src/services/audit.service.js` | аудит manager create/update/delete/password |

## Models / repositories

| Model / repository / файл | Ответственность |
|---|---|
| `backend/src/models/userModel.js` | users с `role='manager'` |
| `backend/src/models/affiliateModel.js` | хранение `manager_user_id` у affiliate |
| `backend/src/models/advertiserModel.js` | хранение `manager_user_id` у advertiser |
| `backend/src/models/refreshTokenModel.js` | revoke refresh tokens при reset/change password |

## Database tables

| Таблица | Назначение | Важные связи |
|---|---|---|
| `users` | manager user storage | `role='manager'` |
| `affiliates` | ссылка на ответственного manager | `manager_user_id -> users.id` |
| `advertisers` | ссылка на ответственного manager | `manager_user_id -> users.id` |
| `refresh_tokens` | токены manager user | удаляются при password reset/delete |
| `audit_events` | аудит manager CRUD и assignment | actor/context |

## Main data flow

```txt
Admin managers page
  -> /api/v1/admin/managers
  -> users validators
  -> managers.service
  -> userModel
  -> users table
  -> temporary password / audit event

Affiliate/Advertiser edit page
  -> PATCH /affiliates/:id/manager or /advertisers/:id/manager
  -> assignment validator
  -> affiliates/advertisers service
  -> requireAssignableManagerUser
  -> update *_manager_user_id
  -> audit_events
```

## Permissions / roles

- manager входит в `ADMIN_AREA_ROLES`, поэтому видит часть admin area и может читать lookup managers.
- Полный manager management (`list/create/update/delete/reset-password`) доступен только `admin` через `authorizeManagerManagement = authorizeAdminOnly`.
- manager может назначать менеджера на affiliate/advertiser, что подтверждено тестами.
- manager не может создавать новых manager users и не может просматривать полный список managers.

## Edge cases

- manager assignment duplicated как отдельная ошибка не возникает: запись просто обновляется на того же manager;
- manager не найден -> 404;
- выбранный user не имеет роли `manager` -> 422;
- manager удалён, но связи остались -> foreign key ссылается на `users`; поведение при delete надо учитывать. TODO: уточнить фактическую стратегию удаления/обнуления ссылок на manager;
- manager имеет доступ в admin area, но не во все admin endpoints;
- невалидный current password при change-password -> ошибка из `changeOwnPassword`.

## Known limitations

- Отдельной manager-only cabinet вне `/dashboard` нет.
- Видимость данных по assigned affiliates/advertisers в коде partially expressed через assignment, но не видно полного глобального фильтра на всех admin endpoints. TODO: уточнить, где менеджер видит только назначенные записи, а где все.
- Нет отдельной таблицы `managers`; используется `users.role='manager'`.

## Tests

| Тест | Что проверяет |
|---|---|
| `backend/tests/integration/manager-admin.test.js` | manager CRUD, login, restrictions, audit |
| `backend/tests/integration/manager-assignment.test.js` | assignment на affiliate/advertiser, unassign, permission matrix |
| `backend/tests/integration/advertiser-security.test.js` | manager косвенно не участвует, но подтверждает role boundaries |

## Связанные разделы

- [Users](./users.md)
- [Affiliates](./affiliates.md)
- [Advertisers](./advertisers.md)
